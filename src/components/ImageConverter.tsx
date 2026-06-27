import { useCallback, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import FileList from './FileList';
import DownloadResult from './DownloadResult';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  type ImageOutputMimeType,
} from '../lib/image-processing';
import {
  OUTPUT_FORMAT_LABELS,
  createUniqueOutputNames,
  getConverterInputConfig,
  getConverterOutputMime,
} from '../lib/image-converter';

interface QueuedFile {
  id: string;
  file: File;
}

interface ConvertedFile {
  sourceId: string;
  name: string;
  originalSize: number;
  size: number;
  url: string;
  previewUrl: string;
}

interface FailedFile {
  sourceId: string;
  name: string;
  message: string;
}

type ConversionOutcome =
  | { status: 'success'; value: ConvertedFile }
  | { status: 'failure'; value: FailedFile };

interface Props {
  defaultFrom?: string;
  defaultTo?: string;
}

export default function ImageConverter({ defaultFrom, defaultTo }: Props) {
  const inputConfig = getConverterInputConfig(defaultFrom);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [outputFormat, setOutputFormat] = useState<ImageOutputMimeType>(() =>
    getConverterOutputMime(defaultTo)
  );
  const [quality, setQuality] = useState(92);
  const [converting, setConverting] = useState(false);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const [failures, setFailures] = useState<FailedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nextFileId = useRef(0);
  const objectUrls = useObjectUrlRegistry();

  const clearResults = useCallback(() => {
    objectUrls.revokePrefix('result:');
    setResults([]);
    setFailures([]);
    setError(null);
  }, [objectUrls]);

  const handleFiles = useCallback((newFiles: File[]) => {
    if (newFiles.length === 0) return;
    clearResults();
    setFiles((previous) => [
      ...previous,
      ...newFiles.map((file) => ({
        id: `file-${++nextFileId.current}`,
        file,
      })),
    ]);
  }, [clearResults]);

  const handleRemove = useCallback((index: number) => {
    clearResults();
    setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
  }, [clearResults]);

  const convertImage = async (
    queuedFile: QueuedFile,
    format: ImageOutputMimeType,
    outputName: string
  ): Promise<ConvertedFile> => {
    const image = await loadImage(queuedFile.file, {
      allowedTypes: inputConfig.allowedTypes,
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = getCanvas2dContext(canvas);
    if (format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);

    const blob = await exportCanvas(
      canvas,
      format,
      format === 'image/png' ? undefined : quality / 100
    );
    const url = objectUrls.replace(`result:${queuedFile.id}`, blob);

    return {
      sourceId: queuedFile.id,
      name: outputName,
      originalSize: queuedFile.file.size,
      size: blob.size,
      url,
      previewUrl: url,
    };
  };

  const handleConvert = async () => {
    if (files.length === 0) return;

    clearResults();
    setConverting(true);
    const outputNames = createUniqueOutputNames(
      files.map(({ file }) => file.name),
      outputFormat
    );

    try {
      const outcomes: ConversionOutcome[] = await Promise.all(
        files.map(async (queuedFile, index) => {
          try {
            return {
              status: 'success',
              value: await convertImage(queuedFile, outputFormat, outputNames[index]),
            };
          } catch (conversionError) {
            return {
              status: 'failure',
              value: {
                sourceId: queuedFile.id,
                name: queuedFile.file.name,
                message: getImageProcessingErrorMessage(conversionError),
              },
            };
          }
        })
      );

      setResults(
        outcomes
          .filter((outcome): outcome is Extract<ConversionOutcome, { status: 'success' }> =>
            outcome.status === 'success'
          )
          .map((outcome) => outcome.value)
      );
      setFailures(
        outcomes
          .filter((outcome): outcome is Extract<ConversionOutcome, { status: 'failure' }> =>
            outcome.status === 'failure'
          )
          .map((outcome) => outcome.value)
      );
    } finally {
      setConverting(false);
    }
  };

  const handleDownloadAll = () => {
    try {
      results.forEach((result) => downloadUrl(result.url, result.name));
    } catch (downloadError) {
      setError(getImageProcessingErrorMessage(downloadError));
    }
  };

  const totalOriginalSize = results.reduce((sum, result) => sum + result.originalSize, 0);
  const totalConvertedSize = results.reduce((sum, result) => sum + result.size, 0);

  return (
    <div>
      <FileUploader
        accept={inputConfig.accept}
        multiple={true}
        onFilesSelected={handleFiles}
      />
      <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
        Accepted input: {inputConfig.hint}
      </p>

      <FileList files={files.map(({ file }) => file)} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                Output Format
              </label>
              <select
                aria-label="Output Format"
                value={outputFormat}
                onChange={(event) => {
                  clearResults();
                  setOutputFormat(event.target.value as ImageOutputMimeType);
                }}
              >
                {Object.entries(OUTPUT_FORMAT_LABELS).map(([mime, label]) => (
                  <option key={mime} value={mime}>{label}</option>
                ))}
              </select>
            </div>

            {outputFormat !== 'image/png' && (
              <div style={{ minWidth: '200px' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                  Quality: {quality}%
                </label>
                <input
                  aria-label="Output Quality"
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(event) => {
                    clearResults();
                    setQuality(Number(event.target.value));
                  }}
                />
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleConvert}
            disabled={converting}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {converting ? 'Converting...' : `Convert ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}

      {failures.length > 0 && (
        <div className="status status-error" style={{ marginTop: '1rem' }}>
          <strong>{failures.length} file{failures.length > 1 ? 's' : ''} could not be converted:</strong>
          <ul style={{ margin: '0.5rem 0 0 1.25rem' }}>
            {failures.map((failure) => (
              <li key={failure.sourceId}><strong>{failure.name}:</strong> {failure.message}</li>
            ))}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.125rem' }}>
              Results ({results.length}/{files.length})
              {totalOriginalSize > 0 && (
                <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                  {formatSize(totalOriginalSize)} to {formatSize(totalConvertedSize)}
                  {totalConvertedSize < totalOriginalSize && (
                    <span style={{ color: '#10b981' }}>
                      {' '}(-{Math.round((1 - totalConvertedSize / totalOriginalSize) * 100)}%)
                    </span>
                  )}
                </span>
              )}
            </h3>
            {results.length > 1 && (
              <button className="btn btn-secondary" onClick={handleDownloadAll}>
                Download All
              </button>
            )}
          </div>
          {results.map((result) => (
            <DownloadResult key={result.sourceId} {...result} />
          ))}
        </div>
      )}
    </div>
  );
}