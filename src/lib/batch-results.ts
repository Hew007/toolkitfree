import JSZip from 'jszip';
import { normalizeDownloadFilename } from './image-processing.ts';

export interface BatchSuccessResult {
  sourceId: string;
  sourceName: string;
  outputName: string;
  originalSize: number;
  outputSize: number;
  blob: Blob;
}

export interface BatchFailureResult {
  sourceId: string;
  name: string;
  message: string;
}

export interface BatchTotals {
  successCount: number;
  failureCount: number;
  originalSize: number;
  outputSize: number;
}

export interface CreateBatchArchiveOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export class BatchArchiveCancelledError extends Error {
  constructor() {
    super('ZIP creation was cancelled.');
    this.name = 'BatchArchiveCancelledError';
  }
}

function splitExtension(filename: string): { stem: string; extension: string } {
  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === filename.length - 1) {
    return { stem: filename, extension: '' };
  }
  return {
    stem: filename.slice(0, extensionIndex),
    extension: filename.slice(extensionIndex),
  };
}

export function createUniqueArchiveNames(filenames: readonly string[]): string[] {
  const used = new Set<string>();

  return filenames.map((filename) => {
    const normalized = normalizeDownloadFilename(filename);
    const { stem, extension } = splitExtension(normalized);
    let candidate = normalized;
    let suffix = 2;

    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = `${stem} (${suffix})${extension}`;
      suffix += 1;
    }

    used.add(candidate.toLocaleLowerCase());
    return candidate;
  });
}

export function calculateBatchTotals(
  successes: readonly BatchSuccessResult[],
  failures: readonly BatchFailureResult[]
): BatchTotals {
  return {
    successCount: successes.length,
    failureCount: failures.length,
    originalSize: successes.reduce((total, result) => total + result.originalSize, 0),
    outputSize: successes.reduce((total, result) => total + result.outputSize, 0),
  };
}

export async function createBatchArchive(
  results: readonly BatchSuccessResult[],
  options: CreateBatchArchiveOptions = {}
): Promise<Blob> {
  if (results.length === 0) {
    throw new Error('At least one successful result is required to create a ZIP file.');
  }
  if (options.signal?.aborted) throw new BatchArchiveCancelledError();

  const archive = new JSZip();
  const filenames = createUniqueArchiveNames(results.map((result) => result.outputName));
  const contents = await Promise.all(
    results.map(async (result) => new Uint8Array(await result.blob.arrayBuffer()))
  );
  if (options.signal?.aborted) throw new BatchArchiveCancelledError();
  contents.forEach((content, index) => archive.file(filenames[index], content));

  const blob = await archive.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      streamFiles: true,
      mimeType: 'application/zip',
    },
    (metadata) => {
      if (options.signal?.aborted) throw new BatchArchiveCancelledError();
      options.onProgress?.(Math.min(100, Math.max(0, metadata.percent)));
    }
  );
  if (options.signal?.aborted) throw new BatchArchiveCancelledError();
  return blob;
}
