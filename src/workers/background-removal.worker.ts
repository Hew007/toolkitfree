import { removeBackground } from '@imgly/background-removal';
import type { BackgroundWorkerRequest, BackgroundWorkerResponse } from '../lib/background-remover';

interface BackgroundWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<BackgroundWorkerRequest>) => void
  ): void;
  postMessage(response: BackgroundWorkerResponse): void;
}

const workerScope = self as unknown as BackgroundWorkerScope;

function post(response: BackgroundWorkerResponse) {
  workerScope.postMessage(response);
}

/**
 * Pins the thread count ONNX Runtime will ask for.
 *
 * `@imgly/background-removal` sets `ort.env.wasm.numThreads` itself, from
 * `navigator.hardwareConcurrency`, and exposes no option to override it — so
 * the only seam is the value it reads. Redefining it on this worker's own
 * navigator affects nothing outside this worker.
 *
 * One thread per core is the wrong ask: measured on a four-core machine with
 * isolation in effect, the same image took 17.9s on one thread, 8.8s on two,
 * 11.6s on four, and 25.9s on sixteen — past a couple of threads the runtime
 * loses to contention, and at sixteen it is slower than not threading at all.
 */
function applyThreadLimit(threads: number | undefined) {
  if (typeof threads !== 'number' || !Number.isFinite(threads) || threads < 1) return;
  Object.defineProperty(self.navigator, 'hardwareConcurrency', {
    value: Math.floor(threads),
    configurable: true,
  });
}

workerScope.addEventListener('message', async (event: MessageEvent<BackgroundWorkerRequest>) => {
  if (event.data.type !== 'process') return;

  try {
    applyThreadLimit(event.data.threads);
    const blob = await removeBackground(event.data.file, {
      // The quantized model halves the initial download and substantially reduces peak memory.
      // Keeping all inference inside this worker prevents it from freezing the page UI.
      publicPath: new URL('/generated/background-removal/1.7.0/', self.location.origin).href,
      model: 'isnet_quint8',
      progress: (key: string, current: number, total: number) => {
        post({ type: 'progress', key, current, total });
      },
    });
    post({ type: 'result', blob });
  } catch (error) {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : 'Background removal failed.',
    });
  }
});

export {};
