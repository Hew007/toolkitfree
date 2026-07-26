import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { AnimationMetadata, AnimationResourceBudget } from './animation-converter';

interface FfmpegAssetManifest {
  version: string;
  totalSize: number;
  sha256: string;
  coreFile: string;
  parts: Array<{ file: string; size: number; sha256: string }>;
}

interface ImageDecoderFrame {
  image: VideoFrame;
  complete: boolean;
}

interface BrowserImageDecoder {
  tracks: {
    ready: Promise<void>;
    selectedTrack?: { frameCount: number; repetitionCount: number };
  };
  decode(options: { frameIndex: number; completeFramesOnly?: boolean }): Promise<ImageDecoderFrame>;
  close(): void;
}

interface BrowserImageDecoderConstructor {
  new (options: {
    data: ArrayBuffer;
    type: string;
    preferAnimation?: boolean;
  }): BrowserImageDecoder;
  isTypeSupported(type: string): Promise<boolean>;
}

const ASSET_BASE = '/generated/ffmpeg/0.12.10';
const DOWNLOAD_PROGRESS_START = 0.02;
const DOWNLOAD_PROGRESS_END = 0.2;
const LOAD_STALL_TIMEOUT_MS = 30_000;

async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const value = bytes instanceof Uint8Array ? Uint8Array.from(bytes) : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readResponseBytes(
  response: Response,
  expectedSize: number,
  onBytesRead: (bytes: number) => void
): Promise<Uint8Array> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onBytesRead(bytes.byteLength);
    return bytes;
  }

  const output = new Uint8Array(expectedSize);
  const reader = response.body.getReader();
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.byteLength > output.byteLength) {
      await reader.cancel();
      throw new Error('A local conversion engine part exceeded its declared size.');
    }
    output.set(value, offset);
    offset += value.byteLength;
    onBytesRead(value.byteLength);
  }
  if (offset !== expectedSize) {
    throw new Error('A local conversion engine part was downloaded incompletely.');
  }
  return output;
}

async function loadFfmpegAssetUrls(
  signal: AbortSignal | undefined,
  onDownloadProgress: (downloaded: number, total: number) => void
): Promise<{
  coreURL: string;
  wasmURL: string;
}> {
  const response = await fetch(`${ASSET_BASE}/manifest.json`, { signal });
  if (!response.ok) throw new Error('The local conversion engine manifest could not be loaded.');
  const manifest = (await response.json()) as FfmpegAssetManifest;
  let downloaded = 0;
  const reportBytes = (bytes: number) => {
    downloaded += bytes;
    onDownloadProgress(downloaded, manifest.totalSize);
  };
  const [coreResponse, chunks] = await Promise.all([
    fetch(`${ASSET_BASE}/${manifest.coreFile}`, { signal }),
    Promise.all(
      manifest.parts.map(async (part) => {
        const chunkResponse = await fetch(`${ASSET_BASE}/${part.file}`, { signal });
        if (!chunkResponse.ok)
          throw new Error('A local conversion engine part could not be loaded.');
        const bytes = await readResponseBytes(chunkResponse, part.size, reportBytes);
        if (bytes.byteLength !== part.size || (await sha256Hex(bytes)) !== part.sha256) {
          throw new Error('A local conversion engine part failed its integrity check.');
        }
        return bytes;
      })
    ),
  ]);
  if (!coreResponse.ok) throw new Error('The local conversion engine script could not be loaded.');
  const coreScript = await coreResponse.arrayBuffer();
  const wasm = new Uint8Array(manifest.totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    wasm.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (offset !== manifest.totalSize || (await sha256Hex(wasm)) !== manifest.sha256) {
    throw new Error('The local conversion engine failed its integrity check.');
  }
  return {
    coreURL: URL.createObjectURL(new Blob([coreScript], { type: 'text/javascript' })),
    wasmURL: URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' })),
  };
}

export async function detectAnimationRuntimeCapabilities(): Promise<{
  animatedWebpInput: boolean;
  reason?: string;
}> {
  const Decoder = (
    globalThis as typeof globalThis & { ImageDecoder?: BrowserImageDecoderConstructor }
  ).ImageDecoder;
  if (!Decoder) {
    return {
      animatedWebpInput: false,
      reason: 'This browser cannot decode animated WebP frames for conversion.',
    };
  }
  try {
    const supported = await Decoder.isTypeSupported('image/webp');
    return supported
      ? { animatedWebpInput: true }
      : {
          animatedWebpInput: false,
          reason: 'This browser does not expose animated WebP decoding.',
        };
  } catch {
    return {
      animatedWebpInput: false,
      reason: 'Animated WebP input capability could not be confirmed.',
    };
  }
}

export class AnimationFfmpegRuntime {
  ffmpeg: FFmpeg | null = null;

  async load(
    signal: AbortSignal | undefined,
    onProgress: (progress: number) => void
  ): Promise<FFmpeg> {
    if (this.ffmpeg?.loaded) return this.ffmpeg;
    const loadController = new AbortController();
    let stalled = false;
    let stallTimeout = 0;
    let loadingFfmpeg: FFmpeg | null = null;
    const forwardAbort = () => loadController.abort();
    const abortForStall = () => {
      stalled = true;
      loadController.abort();
    };
    const armStallTimeout = () => {
      window.clearTimeout(stallTimeout);
      stallTimeout = window.setTimeout(abortForStall, LOAD_STALL_TIMEOUT_MS);
    };
    if (signal?.aborted) loadController.abort();
    else signal?.addEventListener('abort', forwardAbort, { once: true });
    armStallTimeout();
    onProgress(DOWNLOAD_PROGRESS_START);
    try {
      const [{ FFmpeg }, urls] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        loadFfmpegAssetUrls(loadController.signal, (downloaded, total) => {
          armStallTimeout();
          const ratio = total > 0 ? Math.min(1, downloaded / total) : 0;
          onProgress(
            DOWNLOAD_PROGRESS_START + ratio * (DOWNLOAD_PROGRESS_END - DOWNLOAD_PROGRESS_START)
          );
        }),
      ]);
      window.clearTimeout(stallTimeout);
      onProgress(0.22);
      const ffmpeg = new FFmpeg();
      loadingFfmpeg = ffmpeg;
      try {
        await ffmpeg.load(
          { coreURL: urls.coreURL, wasmURL: urls.wasmURL },
          { signal: loadController.signal }
        );
      } finally {
        URL.revokeObjectURL(urls.coreURL);
        URL.revokeObjectURL(urls.wasmURL);
      }
      this.ffmpeg = ffmpeg;
      return ffmpeg;
    } catch (error) {
      if (loadingFfmpeg && !loadingFfmpeg.loaded) loadingFfmpeg.terminate();
      if (stalled) {
        throw new Error(
          'The conversion engine download made no progress for 30 seconds. Check your connection and try again.'
        );
      }
      if (error instanceof DOMException && error.name === 'AbortError' && !signal?.aborted) {
        throw new Error(
          'The conversion engine download was interrupted. Check your connection and try again.'
        );
      }
      throw error;
    } finally {
      window.clearTimeout(stallTimeout);
      signal?.removeEventListener('abort', forwardAbort);
    }
  }

  terminate(): void {
    this.ffmpeg?.terminate();
    this.ffmpeg = null;
  }
}

async function frameToPng(frame: VideoFrame): Promise<Blob> {
  const width = frame.displayWidth;
  const height = frame.displayHeight;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare an animated WebP frame.');
    context.drawImage(frame, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare an animated WebP frame.');
  context.drawImage(frame, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode a temporary frame.'))),
      'image/png'
    );
  });
}

export async function writeAnimatedWebpFrames(
  ffmpeg: FFmpeg,
  file: File,
  budget: AnimationResourceBudget,
  signal: AbortSignal,
  onProgress: (progress: number) => void
): Promise<{ inputName: string; metadata: AnimationMetadata; temporaryFiles: string[] }> {
  const Decoder = (
    globalThis as typeof globalThis & { ImageDecoder?: BrowserImageDecoderConstructor }
  ).ImageDecoder;
  if (!Decoder || !(await Decoder.isTypeSupported('image/webp'))) {
    throw new Error('Animated WebP input is not supported in this browser.');
  }

  const decoder = new Decoder({
    data: await file.arrayBuffer(),
    type: 'image/webp',
    preferAnimation: true,
  });
  const temporaryFiles: string[] = [];
  try {
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const frameCount = track?.frameCount || 0;
    if (frameCount < 2) throw new Error('This is a static WebP. Use the Image Converter instead.');
    if (frameCount > budget.maxWebpInputFrames) {
      throw new Error(
        `This animated WebP exceeds the ${budget.maxWebpInputFrames}-frame input limit.`
      );
    }

    const concatLines: string[] = [];
    let totalDuration = 0;
    let width = 0;
    let height = 0;
    let lastName = '';
    for (let index = 0; index < frameCount; index += 1) {
      if (signal.aborted) throw new DOMException('Conversion cancelled.', 'AbortError');
      const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
      try {
        width ||= image.displayWidth;
        height ||= image.displayHeight;
        const durationSeconds = Math.max(0.01, (image.duration || 100_000) / 1_000_000);
        totalDuration += durationSeconds;
        const name = `webp-frame-${String(index).padStart(4, '0')}.png`;
        const blob = await frameToPng(image);
        await ffmpeg.writeFile(name, new Uint8Array(await blob.arrayBuffer()), { signal });
        temporaryFiles.push(name);
        concatLines.push(`file '${name}'`, `duration ${durationSeconds.toFixed(6)}`);
        lastName = name;
      } finally {
        image.close();
      }
      onProgress(0.25 + ((index + 1) / frameCount) * 0.25);
    }
    concatLines.push(`file '${lastName}'`);
    const inputName = 'webp-frames.txt';
    await ffmpeg.writeFile(inputName, `${concatLines.join('\n')}\n`, { signal });
    temporaryFiles.push(inputName);
    return {
      inputName,
      metadata: { width, height, durationSeconds: totalDuration, frameCount },
      temporaryFiles,
    };
  } finally {
    decoder.close();
  }
}
