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
import {
  BACKGROUND_PRESETS,
  TRANSPARENT_BACKGROUND,
  backgroundLabelColor,
  normalizeHexColor,
  removeBackgroundInWorker,
  type BackgroundProgress,
} from '../lib/background-remover';

const CHECKERBOARD =
  'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)';

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
  const [bgColor, setBgColor] = useState(TRANSPARENT_BACKGROUND);
  const [hexDraft, setHexDraft] = useState('');
  const [hexError, setHexError] = useState<string | null>(null);
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

  const applyColor = useCallback(
    (value: string) => {
      setBgColor(value);
      setHexError(null);
      setHexDraft(value === TRANSPARENT_BACKGROUND ? '' : value);
      clearResult();
    },
    [clearResult]
  );

  const commitHex = useCallback(() => {
    if (hexDraft.trim() === '') {
      setHexError(null);
      return;
    }
    const normalized = normalizeHexColor(hexDraft);
    if (!normalized) {
      setHexError('Enter a colour like #ff7a45.');
      return;
    }
    applyColor(normalized);
  }, [applyColor, hexDraft]);

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
      // The 'runtime' stage above must stay visible until the worker reports its
      // first progress event. Overwriting it here batched into the same render,
      // so the user never saw it and it never reached the DOM.
      const removedBlob = await removeBackgroundInWorker(file, setProgress, controller.signal);

      let finalBlob = removedBlob;
      if (bgColor !== TRANSPARENT_BACKGROUND) {
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

  const isCustomColor =
    bgColor !== TRANSPARENT_BACKGROUND &&
    !BACKGROUND_PRESETS.some((preset) => preset.value === bgColor);

  return (
    // `data-active-background` intentionally differs from the presets' `data-background-color`
    // so a selector for a preset swatch never matches this wrapper instead.
    <div
      data-background-stage={progress?.stage ?? 'idle'}
      data-active-background={bgColor}
      aria-busy={processing}
    >
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {BACKGROUND_PRESETS.map((option) => {
                const selected = bgColor === option.value;
                const isTransparent = option.value === TRANSPARENT_BACKGROUND;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-background-color={option.value}
                    aria-pressed={selected}
                    disabled={processing}
                    onClick={() => applyColor(option.value)}
                    style={{
                      padding: '0.375rem 1rem',
                      borderRadius: 6,
                      border: selected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                      background: isTransparent ? CHECKERBOARD : option.swatch,
                      backgroundSize: isTransparent ? '12px 12px' : undefined,
                      backgroundPosition: isTransparent
                        ? '0 0, 0 6px, 6px -6px, -6px 0px'
                        : undefined,
                      cursor: processing ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem',
                      color: backgroundLabelColor(option.swatch),
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}

              <span aria-hidden="true" style={{ color: '#d1d5db' }}>
                |
              </span>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8rem',
                }}
              >
                <span>Custom</span>
                <input
                  type="color"
                  data-testid="bg-color-picker"
                  value={isCustomColor ? bgColor : '#3b82f6'}
                  disabled={processing}
                  onChange={(event) => applyColor(event.target.value)}
                  style={{
                    width: 36,
                    height: 30,
                    padding: 2,
                    border: isCustomColor ? '2px solid #2563eb' : '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: processing ? 'not-allowed' : 'pointer',
                    background: 'none',
                  }}
                />
              </label>

              <input
                type="text"
                data-testid="bg-color-hex"
                aria-label="Background colour hex value"
                aria-invalid={hexError !== null}
                placeholder="#ff7a45"
                value={hexDraft}
                disabled={processing}
                maxLength={7}
                onChange={(event) => {
                  setHexDraft(event.target.value);
                  setHexError(null);
                }}
                onBlur={commitHex}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitHex();
                }}
                style={{
                  width: '7.5rem',
                  padding: '0.375rem 0.5rem',
                  borderRadius: 6,
                  border: hexError ? '1px solid #ef4444' : '1px solid #d1d5db',
                  fontSize: '0.8rem',
                  fontFamily: 'ui-monospace, monospace',
                }}
              />
            </div>
            {hexError && (
              <p
                role="alert"
                style={{ margin: '0.375rem 0 0', color: '#ef4444', fontSize: '0.75rem' }}
              >
                {hexError}
              </p>
            )}
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
                  backgroundImage: bgColor === TRANSPARENT_BACKGROUND ? CHECKERBOARD : undefined,
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
