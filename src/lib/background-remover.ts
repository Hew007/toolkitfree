export type BackgroundProgressStage =
  'runtime' | 'model-download' | 'model-initialization' | 'inference';

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
