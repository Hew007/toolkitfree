import { exportCanvas, getCanvas2dContext } from './image-processing.ts';
import { colorContrastRatio } from './qr-data.ts';

export type BackgroundProgressStage =
  'runtime' | 'model-download' | 'model-initialization' | 'inference';

export interface BackgroundPreset {
  /** Canvas fillStyle value, or the `transparent` sentinel. */
  value: string;
  label: string;
  /** Colour painted on the swatch itself; differs from `value` only for transparent. */
  swatch: string;
}

export const TRANSPARENT_BACKGROUND = 'transparent';

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  { value: TRANSPARENT_BACKGROUND, label: 'Transparent', swatch: '#ffffff' },
  { value: '#ffffff', label: 'White', swatch: '#ffffff' },
  { value: '#ff0000', label: 'Red', swatch: '#ff0000' },
  { value: '#0000ff', label: 'Blue', swatch: '#0000ff' },
  { value: '#008000', label: 'Green', swatch: '#008000' },
];

/**
 * Accepts `abc`, `#abc`, `aabbcc`, `#AABBCC` and returns lowercase `#rrggbb`.
 * Returns null for anything else — the caller must never pass an unvalidated
 * string to `context.fillStyle`, which silently keeps the previous value.
 */
export function normalizeHexColor(input: string): string | null {
  const digits = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(digits)) {
    return `#${digits
      .toLowerCase()
      .split('')
      .map((digit) => digit + digit)
      .join('')}`;
  }
  if (/^[0-9a-f]{6}$/i.test(digits)) return `#${digits.toLowerCase()}`;
  return null;
}

const LIGHT_LABEL = '#ffffff';
const DARK_LABEL = '#1f2937';

/** Picks whichever label colour reads better on the given swatch. */
export function backgroundLabelColor(swatch: string): string {
  const normalized = normalizeHexColor(swatch);
  if (!normalized) return DARK_LABEL;
  return colorContrastRatio(LIGHT_LABEL, normalized) >= colorContrastRatio(DARK_LABEL, normalized)
    ? LIGHT_LABEL
    : DARK_LABEL;
}

/**
 * Paints `color` behind a transparent cutout and returns a PNG.
 *
 * The model run and the background choice are deliberately separate: once the
 * cutout exists, switching colours only needs this local recomposition, so the
 * caller must never re-run the model just to change the background. Only the
 * cutout blob is worth keeping between calls — the decoded bitmap and its
 * canvas are full-size buffers, so they are created here and released again
 * before the promise settles.
 */
export async function composeBackgroundColor(cutout: Blob, color: string): Promise<Blob> {
  const bitmap = await createImageBitmap(cutout);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = getCanvas2dContext(canvas);
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    return await exportCanvas(canvas, 'image/png');
  } finally {
    bitmap.close();
  }
}

export interface BackgroundProgress {
  stage: BackgroundProgressStage;
  label: string;
  percent: number | null;
}

export type BackgroundWorkerRequest = {
  type: 'process';
  file: File;
  /** Thread count the worker pins ONNX Runtime to; omitted means "leave it alone". */
  threads?: number;
};

export type BackgroundWorkerResponse =
  | {
      type: 'progress';
      key: string;
      current: number;
      total: number;
    }
  | {
      type: 'result';
      blob: Blob;
    }
  | {
      type: 'error';
      message: string;
    };

/** Threads beyond this measured slower, not faster, so nothing asks for more. */
const MAX_INFERENCE_THREADS = 4;

/**
 * How long one `compute:inference` report may go unanswered before the run is
 * abandoned. The library emits that key exactly once, so whichever value is armed
 * has to cover the entire inference rather than a step of it.
 *
 * A threaded attempt gets the shorter budget because it can still fall back, and
 * the fallback cannot be free: whatever the threaded attempt burns is added to the
 * single-threaded retry that follows. 90s is roughly fifteen times the 5.98s a
 * sixteen-core machine measured on four threads, and the model resizes its input
 * to a fixed size, so inference does not grow with the image the way the decode
 * and compose steps do. A machine slow enough to exceed this is one where the
 * threaded path is not delivering anyway.
 *
 * This does treat a hang and mere slowness the same, since from outside the worker
 * they are indistinguishable — the run reports nothing either way. That is the
 * intended trade: a hung threaded attempt is exactly what the fallback exists for,
 * and the margin above is what keeps a working-but-slow run from being killed.
 */
const THREADED_INFERENCE_TIMEOUT_MS = 90_000;

/** No fallback left to fund, so the single-threaded path gets the full budget. */
const SINGLE_THREAD_INFERENCE_TIMEOUT_MS = 180_000;

/** A finished run, with the thread decision that produced it. */
export interface BackgroundRemovalRun {
  blob: Blob;
  /** Threads the attempt that produced `blob` asked ONNX Runtime for. */
  threads: number;
  /** True when a threaded attempt failed and this is the single-threaded retry. */
  fellBack: boolean;
}

/**
 * Chooses how many threads the first attempt asks ONNX Runtime for.
 *
 * Without cross-origin isolation there is no `SharedArrayBuffer`, so the WASM
 * build runs on one thread whatever it is told; saying 1 makes that explicit
 * rather than pretending the request matters.
 *
 * When isolation *is* in effect, one thread per logical core — what the library
 * asks for on its own — is too many. Measured on four cores against the same
 * image: 17.9s at one thread, 8.8s at two, 11.6s at four, 25.9s at sixteen. So
 * halve the logical count, which lands near one thread per physical core on
 * hyper-threaded machines, and cap it before the regime where threading loses.
 */
export function plannedThreadCount(cores: number | undefined, isolated: boolean): number {
  if (!isolated) return 1;
  const logical = typeof cores === 'number' && Number.isFinite(cores) ? Math.floor(cores) : 4;
  if (logical <= 1) return 1;
  return Math.max(2, Math.min(MAX_INFERENCE_THREADS, Math.floor(logical / 2)));
}

/**
 * Runs the model once, in a worker, with a fixed thread count.
 *
 * `inferenceTimeoutMs` is separate because the library reports `compute:inference`
 * exactly once, before the session runs: that one watchdog has to cover the whole
 * inference, so a threaded attempt gets a shorter budget than the single-threaded
 * fallback it can still fall back to.
 */
function runBackgroundWorker(
  file: File,
  threads: number,
  inferenceTimeoutMs: number,
  onProgress: (progress: BackgroundProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  // An `AbortSignal` that is already aborted never fires `abort` again, so the
  // listener below would never run and the worker would spend a full inference on
  // work nobody wants. This is the only check — the guarantee belongs here rather
  // than to whichever caller remembers to make it, and both entry paths below reach
  // this function before anything is spawned.
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Background removal was canceled.', 'AbortError'));
  }

  const worker = new Worker(new URL('../workers/background-removal.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise<Blob>((resolve, reject) => {
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const armWatchdog = (timeoutMs: number) => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        finish(() =>
          reject(
            new Error('Background removal stopped because the model made no progress for too long.')
          )
        );
      }, timeoutMs);
    };

    const cleanup = () => {
      if (watchdog) clearTimeout(watchdog);
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () =>
      finish(() => reject(new DOMException('Background removal was canceled.', 'AbortError')));

    worker.addEventListener('message', (event: MessageEvent<BackgroundWorkerResponse>) => {
      const response = event.data;
      if (response.type === 'progress') {
        armWatchdog(
          response.key === 'compute:inference'
            ? inferenceTimeoutMs
            : response.key.startsWith('fetch:')
              ? 60_000
              : 120_000
        );
        onProgress(mapBackgroundProgress(response.key, response.current, response.total));
      } else if (response.type === 'result') {
        finish(() => resolve(response.blob));
      } else {
        finish(() => reject(new Error(response.message)));
      }
    });
    // An `ErrorEvent` here is the worker itself dying — the thrown value never made
    // it through `postMessage`. Keep whatever detail the event carries; a failure
    // reported as "stopped unexpectedly" and nothing else is a failure nobody can fix.
    worker.addEventListener('error', (event: ErrorEvent) => {
      const where = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
      finish(() =>
        reject(
          new Error(
            event.message
              ? `The background removal worker stopped unexpectedly: ${event.message}${where}`
              : 'The background removal worker stopped unexpectedly.'
          )
        )
      );
    });
    signal?.addEventListener('abort', handleAbort, { once: true });

    const request: BackgroundWorkerRequest = { type: 'process', file, threads };
    armWatchdog(60_000);
    worker.postMessage(request);
  });
}

/**
 * Removes the background, preferring the threaded path but never depending on it.
 *
 * Threading is the whole reason this route would be cross-origin isolated, and it
 * has broken on real hardware once before, in a way that was never reproduced. So
 * a threaded attempt that fails for any reason other than the user canceling is
 * retried on the single thread the tool used before threading existed: the fast
 * path is an improvement when it works, and cannot make the tool worse than the
 * slow path when it does not.
 *
 * The returned `threads` and `fellBack` are what make a timing number readable
 * afterwards. A fallback is otherwise invisible in the result — the caller gets a
 * correct cutout either way — so a slow run could be four threads losing to
 * contention or one thread doing its best, and nothing in the timing would say
 * which. That ambiguity is how the sixteen-thread defect survived two releases.
 */
export async function removeBackgroundInWorker(
  file: File,
  onProgress: (progress: BackgroundProgress) => void,
  signal?: AbortSignal
): Promise<BackgroundRemovalRun> {
  const threads = plannedThreadCount(navigator.hardwareConcurrency, self.crossOriginIsolated);
  if (threads <= 1) {
    const blob = await runBackgroundWorker(
      file,
      1,
      SINGLE_THREAD_INFERENCE_TIMEOUT_MS,
      onProgress,
      signal
    );
    return { blob, threads: 1, fellBack: false };
  }

  try {
    const blob = await runBackgroundWorker(
      file,
      threads,
      THREADED_INFERENCE_TIMEOUT_MS,
      onProgress,
      signal
    );
    return { blob, threads, fellBack: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (signal?.aborted) throw error;
    // `warn`, not `debug`: the tool still produced an image, but it fell back, and
    // that is the signal that the threaded path is broken on this machine.
    console.warn(
      `[toolkitfree] background removal failed on ${threads} threads, retrying single-threaded`,
      error
    );
    const blob = await runBackgroundWorker(
      file,
      1,
      SINGLE_THREAD_INFERENCE_TIMEOUT_MS,
      onProgress,
      signal
    );
    return { blob, threads: 1, fellBack: true };
  }
}

function percent(current: number, total: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

export function mapBackgroundProgress(
  key: string,
  current: number,
  total: number
): BackgroundProgress {
  if (key.startsWith('fetch:')) {
    return {
      stage: 'model-download',
      label: 'Downloading AI model',
      percent: percent(current, total),
    };
  }
  if (key === 'compute:inference') {
    return {
      stage: 'inference',
      label: 'Removing background',
      percent: percent(current, total),
    };
  }
  return {
    stage: 'model-initialization',
    label: 'Initializing AI model',
    percent: percent(current, total),
  };
}
