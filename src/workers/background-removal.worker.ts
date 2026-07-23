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

workerScope.addEventListener('message', async (event: MessageEvent<BackgroundWorkerRequest>) => {
  if (event.data.type !== 'process') return;

  try {
    const blob = await removeBackground(event.data.file, {
      // The quantized model halves the initial download and substantially reduces peak memory.
      // Keeping all inference inside this worker prevents it from freezing the page UI.
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
