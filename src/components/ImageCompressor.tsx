import { useCallback, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';
import BatchResultsSummary from './BatchResultsSummary';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  type ImageOutputMimeType,
} from '../lib/image-processing';
import {
  compressToTargetSize,
  dimensionsForMaxWidth,
  type CompressionMode,
} from '../lib/image-compressor';

interface QueuedFile {
  id: string;
  file: File;
}

type CompressionStatus =
  | 'optimized'
  | 'target-met'
  | 'target-not-met'
  | 'kept-original'
  | 'larger';

interface CompressedFile {
  sourceId: string;
  sourceName: string;
  outputName: string;
  name: string;
  originalSize: number;
  outputSize: number;
  compressedSize: number;
  blob: Blob;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  quality: number | null;
  attempts: number;
  status: CompressionStatus;
  message: string;
  url: string;
  previewUrl: string;
}

interface FailedFile {
  sourceId: string;
  name: string;
  message: string;
}

type CompressionOutcome =
  | { status: 'success'; value: CompressedFile }
  | { status: 'failure'; value: FailedFile };

interface Props {
  defaultMode?: CompressionMode;
  defaultTargetKB?: number;
  defaultFormat?: string;
}

const INPUT_FORMATS: Record<string, { accept: string; allowedTypes: readonly string[]; hint: string }> = {
  PNG: { accept: 'image/png', allowedTypes: ['image/png'], hint: 'PNG' },
  JPG: { accept: 'image/jpeg', allowedTypes: ['image/jpeg'], hint: 'JPG or JPEG' },
  Any: {
    accept: 'image/jpeg,image/png,image/webp',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    hint: 'JPG, PNG, or WebP',
  },
};

function resultColor(status: CompressionStatus): string {
  if (status === 'optimized' || status === 'target-met') return '#059669';
  if (status === 'target-not-met' || status === 'larger') return '#b45309';
  return '#6b7280';
}

export default function ImageCompressor({
  defaultMode = 'quality',
  defaultTargetKB = 100,
  defaultFormat = 'Any',
}: Props) {
  const inputFormat = INPUT_FORMATS[defaultFormat] ?? INPUT_FORMATS.Any;
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [mode, setMode] = useState<CompressionMode>(defaultMode);
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(0);
  const [targetKB, setTargetKB] = useState(defaultTargetKB);
  const [compressing, setCompressing] = useState(false);
  const [results, setResults] = useState<CompressedFile[]>([]);
  const [failures, setFailures] = useState<FailedFile[]>([]);
  const nextFileId = useRef(0);
  const objectUrls = useObjectUrlRegistry();

  const clearResults = useCallback(() => {
    objectUrls.revokePrefix('result:');
    setResults([]);
    setFailures([]);
  }, [objectUrls]);

  const handleFiles = useCallback((newFiles: File[]) => {
    if (newFiles.length === 0) return;
    clearResults();
    setFiles((previous) => [
      ...previous,
      ...newFiles.map((file) => ({ id: `file-${++nextFileId.current}`, file })),
    ]);
  }, [clearResults]);

  const handleRemove = useCallback((index: number) => {
    clearResults();
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  }, [clearResults]);

  const processFile = async (queuedFile: QueuedFile): Promise<CompressedFile> => {
    const image = await loadImage(queuedFile.file, {
      allowedTypes: inputFormat.allowedTypes,
    });
    const outputType = queuedFile.file.type as ImageOutputMimeType;
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    const startDimensions = dimensionsForMaxWidth(originalWidth, originalHeight, maxWidth);

    const encode = async (width: number, height: number, encodeQuality?: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = getCanvas2dContext(canvas);
      context.drawImage(image, 0, 0, width, height);
      return exportCanvas(canvas, outputType, outputType === 'image/png' ? undefined : encodeQuality);
    };

    let blob: Blob;
    let width = startDimensions.width;
    let height = startDimensions.height;
    let outputQuality: number | null = outputType === 'image/png' ? null : quality / 100;
    let attempts = 1;
    let status: CompressionStatus;
    let message: string;

    if (mode === 'target') {
      const targetBytes = Math.round(targetKB * 1024);
      if (queuedFile.file.size <= targetBytes) {
        blob = queuedFile.file;
        width = originalWidth;
        height = originalHeight;
        outputQuality = null;
        attempts = 0;
        status = 'target-met';
        message = `Already within the ${targetKB} KB target; original kept.`;
      } else {
        const targetResult = await compressToTargetSize({
          sourceWidth: width,
          sourceHeight: height,
          outputType,
          targetBytes,
          encode,
        });
        blob = targetResult.blob;
        width = targetResult.width;
        height = targetResult.height;
        outputQuality = targetResult.quality;
        attempts = targetResult.attempts;

        if (targetResult.metTarget) {
          status = 'target-met';
          message = `Target met: ${formatSize(blob.size)} is within ${targetKB} KB.`;
        } else if (blob.size >= queuedFile.file.size) {
          blob = queuedFile.file;
          width = originalWidth;
          height = originalHeight;
          outputQuality = null;
          status = 'target-not-met';
          message = `Target not met after ${attempts} attempts; original kept because no smaller result was found.`;
        } else {
          status = 'target-not-met';
          message = `Target not met after ${attempts} attempts; closest result kept.`;
        }
      }
    } else {
      const candidate = await encode(width, height, outputQuality ?? undefined);
      const dimensionsChanged = width !== originalWidth || height !== originalHeight;

      if (!dimensionsChanged && candidate.size >= queuedFile.file.size) {
        blob = queuedFile.file;
        width = originalWidth;
        height = originalHeight;
        outputQuality = null;
        status = 'kept-original';
        message = 'No smaller result was found; original kept.';
      } else {
        blob = candidate;
        status = candidate.size < queuedFile.file.size ? 'optimized' : 'larger';
        message = status === 'optimized'
          ? 'File size reduced.'
          : 'Dimensions changed, but the output file is larger than the original.';
      }
    }

    const url = objectUrls.replace(`result:${queuedFile.id}`, blob);
    return {
      sourceId: queuedFile.id,
      sourceName: queuedFile.file.name,
      outputName: queuedFile.file.name,
      name: queuedFile.file.name,
      originalSize: queuedFile.file.size,
      outputSize: blob.size,
      compressedSize: blob.size,
      blob,
      originalWidth,
      originalHeight,
      width,
      height,
      quality: outputQuality,
      attempts,
      status,
      message,
      url,
      previewUrl: url,
    };
  };

  const handleCompress = async () => {
    if (files.length === 0) return;
    clearResults();
    setCompressing(true);

    try {
      const outcomes: CompressionOutcome[] = await Promise.all(
        files.map(async (queuedFile) => {
          try {
            return { status: 'success', value: await processFile(queuedFile) };
          } catch (processingError) {
            return {
              status: 'failure',
              value: {
                sourceId: queuedFile.id,
                name: queuedFile.file.name,
                message: getImageProcessingErrorMessage(processingError),
              },
            };
          }
        })
      );

      setResults(
        outcomes
          .filter((outcome): outcome is Extract<CompressionOutcome, { status: 'success' }> =>
            outcome.status === 'success'
          )
          .map((outcome) => outcome.value)
      );
      setFailures(
        outcomes
          .filter((outcome): outcome is Extract<CompressionOutcome, { status: 'failure' }> =>
            outcome.status === 'failure'
          )
          .map((outcome) => outcome.value)
      );
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div aria-busy={compressing}>
      {compressing && <div className="visually-hidden" role="status" aria-live="polite">Compressing images.</div>}
      <FileUploader accept={inputFormat.accept} multiple={true} onFilesSelected={handleFiles} />
      <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
        Accepted input: {inputFormat.hint}
      </p>

      <div style={{ marginTop: '1rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
          Compression Mode
        </label>
        <select
          aria-label="Compression Mode"
          value={mode}
          onChange={(event) => {
            clearResults();
            setMode(event.target.value as CompressionMode);
          }}
        >
          <option value="quality">Quality and dimensions</option>
          <option value="target">Target file size</option>
        </select>
      </div>

      <FileList files={files.map(({ file }) => file)} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {mode === 'quality' ? (
              <div style={{ minWidth: '200px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Quality: {quality}%
                </label>
                <input
                  aria-label="Compression Quality"
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(event) => {
                    clearResults();
                    setQuality(Number(event.target.value));
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Applies to JPG and WebP. PNG is lossless; resize it to reduce size.
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Target Size (KB)
                </label>
                <input
                  aria-label="Target Size (KB)"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={targetKB}
                  onChange={(event) => {
                    clearResults();
                    setTargetKB(Math.max(1, Number(event.target.value) || 1));
                  }}
                  style={{ width: '120px' }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                Starting Max Width (px)
              </label>
              <select
                aria-label="Starting Max Width"
                value={maxWidth}
                onChange={(event) => {
                  clearResults();
                  setMaxWidth(Number(event.target.value));
                }}
              >
                <option value={0}>Original</option>
                <option value={3840}>3840 (4K)</option>
                <option value={1920}>1920 (Full HD)</option>
                <option value={1280}>1280 (HD)</option>
                <option value={800}>800</option>
                <option value={400}>400</option>
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCompress}
            disabled={compressing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {compressing ? 'Compressing...' : `Compress ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}


      <BatchResultsSummary
        successes={results}
        failures={failures}
        archiveName="toolkitfree-compressed-images.zip"
      />

      {results.length > 0 && (
        <div>

          {results.map((result) => {
            const smaller = result.compressedSize < result.originalSize;
            return (
              <div key={result.sourceId} className="result-item">
                <div className="result-info">
                  <img src={result.previewUrl} alt={result.name} className="result-preview" />
                  <div>
                    <div className="file-item-name">{result.name}</div>
                    <div className="file-item-size">
                      {formatSize(result.originalSize)} to {formatSize(result.compressedSize)}
                      {smaller && ` (-${Math.round((1 - result.compressedSize / result.originalSize) * 100)}%)`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {result.originalWidth}x{result.originalHeight} to {result.width}x{result.height}
                      {result.quality !== null && ` | quality ${Math.round(result.quality * 100)}%`}
                      {mode === 'target' && ` | ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}`}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: resultColor(result.status), fontWeight: 600, marginTop: '0.25rem' }}>
                      {result.message}
                    </div>
                  </div>
                </div>
                <a href={result.url} download={result.name} className="btn btn-primary">
                  Download
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}