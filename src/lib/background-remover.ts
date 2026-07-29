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

export interface BackgroundProgress {
  stage: BackgroundProgressStage;
  label: string;
  percent: number | null;
}

export type BackgroundWorkerRequest = {
  type: 'process';
  file: File;
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

export async function removeBackgroundInWorker(
  file: File,
  onProgress: (progress: BackgroundProgress) => void,
  signal?: AbortSignal
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException('Background removal was canceled.', 'AbortError');

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
            ? 180_000
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
    worker.addEventListener('error', () => {
      finish(() => reject(new Error('The background removal worker stopped unexpectedly.')));
    });
    signal?.addEventListener('abort', handleAbort, { once: true });

    const request: BackgroundWorkerRequest = { type: 'process', file };
    armWatchdog(60_000);
    worker.postMessage(request);
  });
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
