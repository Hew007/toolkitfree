import { useCallback, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { mapWithConcurrency } from '../lib/async-pool';
import FileList from './FileList';
import DownloadResult from './DownloadResult';
import BatchResultsSummary from './BatchResultsSummary';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  exportCanvas,
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
  sourceName: string;
  outputName: string;
  name: string;
  originalSize: number;
  outputSize: number;
  size: number;
  blob: Blob;
  url: string;
  previewUrl: string;
}

interface FailedFile {
  sourceId: string;
  name: string;
  message: string;
}

type ConversionOutcome =
  { status: 'success'; value: ConvertedFile } | { status: 'failure'; value: FailedFile };

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
  const nextFileId = useRef(0);
  const objectUrls = useObjectUrlRegistry();

  const clearResults = useCallback(() => {
    objectUrls.revokePrefix('result:');
    setResults([]);
    setFailures([]);
  }, [objectUrls]);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      if (newFiles.length === 0) return;
      clearResults();
      setFiles((previous) => [
        ...previous,
        ...newFiles.map((file) => ({
          id: `file-${++nextFileId.current}`,
          file,
        })),
      ]);
    },
    [clearResults]
  );

  const handleRemove = useCallback(
    (index: number) => {
      clearResults();
      setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index));
    },
    [clearResults]
  );

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
      sourceName: queuedFile.file.name,
      outputName,
      name: outputName,
      originalSize: queuedFile.file.size,
      outputSize: blob.size,
      size: blob.size,
      blob,
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
      const outcomes: ConversionOutcome[] = await mapWithConcurrency(
        files,
        2,
        async (queuedFile, index) => {
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
        }
      );

      setResults(
        outcomes
          .filter(
            (outcome): outcome is Extract<ConversionOutcome, { status: 'success' }> =>
              outcome.status === 'success'
          )
          .map((outcome) => outcome.value)
      );
      setFailures(
        outcomes
          .filter(
            (outcome): outcome is Extract<ConversionOutcome, { status: 'failure' }> =>
              outcome.status === 'failure'
          )
          .map((outcome) => outcome.value)
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <div aria-busy={converting}>
      {converting && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Converting images.
        </div>
      )}
      <FileUploader
        accept={inputConfig.accept}
        multiple={true}
        budgetProfile="converter"
        currentFiles={files.map(({ file }) => file)}
        onFilesSelected={handleFiles}
      />
      <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
        Accepted input: {inputConfig.hint}
      </p>

      <FileList files={files.map(({ file }) => file)} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label
                htmlFor="converter-output-format"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Output Format
              </label>
              <select
                id="converter-output-format"
                aria-label="Output Format"
                value={outputFormat}
                onChange={(event) => {
                  clearResults();
                  setOutputFormat(event.target.value as ImageOutputMimeType);
                }}
              >
                {Object.entries(OUTPUT_FORMAT_LABELS).map(([mime, label]) => (
                  <option key={mime} value={mime}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {outputFormat !== 'image/png' && (
              <div style={{ minWidth: '200px' }}>
                <label
                  htmlFor="converter-output-quality"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    display: 'block',
                    marginBottom: '0.25rem',
                  }}
                >
                  Quality: {quality}%
                </label>
                <input
                  id="converter-output-quality"
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
            {converting
              ? 'Converting...'
              : `Convert ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      <BatchResultsSummary
        successes={results}
        failures={failures}
        archiveName="toolkitfree-converted-images.zip"
      />

      {results.length > 0 && (
        <div>
          {results.map((result) => (
            <DownloadResult key={result.sourceId} {...result} />
          ))}
        </div>
      )}
    </div>
  );
}
