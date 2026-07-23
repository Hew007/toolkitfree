import { useCallback, useEffect, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  validateImageFile,
} from '../lib/image-processing';
import { removeBackgroundInWorker, type BackgroundProgress } from '../lib/background-remover';

interface ProcessedFile {
  name: string;
  size: number;
  url: string;
}

const INITIAL_PROGRESS: BackgroundProgress = {
  stage: 'runtime',
  label: 'Loading background removal runtime',
  percent: null,
};

export default function BackgroundRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<BackgroundProgress | null>(null);
  const [result, setResult] = useState<ProcessedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('transparent');
  const objectUrls = useObjectUrlRegistry();
  const processingController = useRef<AbortController | null>(null);

  const cancelProcessing = useCallback(() => {
    processingController.current?.abort();
    processingController.current = null;
  }, []);

  useEffect(() => cancelProcessing, [cancelProcessing]);

  const clearResult = useCallback(() => {
    objectUrls.revoke('background:result');
    setResult(null);
  }, [objectUrls]);

  const handleFiles = useCallback(
    (files: File[]) => {
      const nextFile = files[0];
      if (!nextFile) return;
      try {
        validateImageFile(nextFile);
        clearResult();
        setFile(nextFile);
        setPreviewUrl(objectUrls.replace('background:preview', nextFile));
        setError(null);
        setProgress(null);
      } catch (fileError) {
        setError(getImageProcessingErrorMessage(fileError));
      }
    },
    [clearResult, objectUrls]
  );

  const handleRemove = useCallback(() => {
    cancelProcessing();
    objectUrls.revokeAll();
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setProgress(null);
  }, [cancelProcessing, objectUrls]);

  const removeBackground = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    clearResult();
    setProgress(INITIAL_PROGRESS);
    const controller = new AbortController();
    processingController.current = controller;

    try {
      setProgress({ stage: 'model-initialization', label: 'Initializing AI model', percent: null });
      const removedBlob = await removeBackgroundInWorker(file, setProgress, controller.signal);

      let finalBlob = removedBlob;
      if (bgColor !== 'transparent') {
        setProgress({
          stage: 'model-initialization',
          label: 'Applying background color',
          percent: null,
        });
        const removedFile = new File([removedBlob], 'removed-background.png', {
          type: removedBlob.type || 'image/png',
        });
        const image = await loadImage(removedFile, { allowedTypes: ['image/png'] });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = getCanvas2dContext(canvas);
        context.fillStyle = bgColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        finalBlob = await exportCanvas(canvas, 'image/png');
      }

      const url = objectUrls.replace('background:result', finalBlob);
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
      setResult({ name: `${baseName}_no_bg.png`, size: finalBlob.size, url });
      setProgress(null);
    } catch (processingError) {
      if (processingError instanceof DOMException && processingError.name === 'AbortError') {
        setError('Background removal was canceled.');
        setProgress(null);
        return;
      }
      const standardMessage = getImageProcessingErrorMessage(processingError);
      setError(
        standardMessage === 'Image processing failed. Please try another file.'
          ? 'Background removal could not finish. On first use, check your connection and available device memory, then retry.'
          : standardMessage
      );
      setProgress(null);
    } finally {
      if (processingController.current === controller) processingController.current = null;
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    try {
      downloadUrl(result.url, result.name);
    } catch (downloadError) {
      setError(getImageProcessingErrorMessage(downloadError));
    }
  };

  return (
    <div data-background-stage={progress?.stage ?? 'idle'} aria-busy={processing}>
      {!file ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="background"
          onFilesSelected={handleFiles}
        />
      ) : (
        <>
          <div className="file-item" style={{ marginBottom: '1rem' }}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Original preview"
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
              />
            )}
            <span className="file-item-name">{file.name}</span>
            <span className="file-item-size">{formatSize(file.size)}</span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              className="file-item-remove"
              onClick={handleRemove}
              disabled={processing}
            >
              x
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                display: 'block',
                marginBottom: '0.5rem',
              }}
            >
              Background Color
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { value: 'transparent', label: 'Transparent', color: '#fff' },
                { value: '#ffffff', label: 'White', color: '#ffffff' },
                { value: '#ff0000', label: 'Red', color: '#ff0000' },
                { value: '#0000ff', label: 'Blue', color: '#0000ff' },
                { value: '#008000', label: 'Green', color: '#008000' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-background-color={option.value}
                  aria-pressed={bgColor === option.value}
                  disabled={processing}
                  onClick={() => {
                    setBgColor(option.value);
                    clearResult();
                  }}
                  style={{
                    padding: '0.375rem 1rem',
                    borderRadius: 6,
                    border: bgColor === option.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: option.color,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    color: ['#0000ff', '#008000', '#ff0000'].includes(option.value)
                      ? '#fff'
                      : '#1f2937',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={removeBackground}
            disabled={processing}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {processing ? 'Processing...' : result ? 'Process Again' : 'Remove Background'}
          </button>
          {processing && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancelProcessing}
              style={{ fontSize: '1rem', padding: '0.75rem 2rem', marginLeft: '0.5rem' }}
            >
              Cancel
            </button>
          )}
          <p style={{ marginTop: '0.5rem', color: '#6b7280', fontSize: '0.8125rem' }}>
            First use downloads a sizable AI model and requires a network connection. Later offline
            use depends on whether your browser keeps that model cached. Processing speed and
            maximum image size depend on device memory.
          </p>
        </>
      )}

      {progress && (
        <div
          className="status status-processing"
          role="status"
          aria-live="polite"
          data-progress-stage={progress.stage}
        >
          {progress.label}
          {progress.percent === null ? '...' : `: ${progress.percent}%`}
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            {previewUrl && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Original
                </div>
                <img
                  src={previewUrl}
                  alt="Original"
                  style={{
                    maxWidth: 200,
                    maxHeight: 200,
                    borderRadius: 4,
                    border: '1px solid #e5e7eb',
                  }}
                />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                Result
              </div>
              <img
                src={result.url}
                alt="Result"
                style={{
                  maxWidth: 200,
                  maxHeight: 200,
                  borderRadius: 4,
                  border: '1px solid #e5e7eb',
                  backgroundImage:
                    bgColor === 'transparent'
                      ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                      : undefined,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />
            </div>
          </div>
          <div className="result-item" data-background-result={result.name}>
            <div className="result-info">
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">{formatSize(result.size)}</div>
              </div>
            </div>
            <button type="button" onClick={handleDownload} className="btn btn-primary">
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
