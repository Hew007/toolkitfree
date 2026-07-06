import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  buildEnhancerCanvasFilter,
  DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS,
  getEnhancedFilename,
  sharpenRgbaPixels,
  type ImageEnhancerAdjustments,
} from '../lib/image-enhancer';
import {
  downloadUrl,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  validateImageDimensions,
  type ImageOutputMimeType,
} from '../lib/image-processing';

function renderEnhancedImage(
  targetCanvas: HTMLCanvasElement,
  source: HTMLImageElement,
  adjustments: ImageEnhancerAdjustments,
  maxWidth?: number
): void {
  let width = source.naturalWidth;
  let height = source.naturalHeight;
  if (maxWidth && maxWidth > 0 && width > maxWidth) {
    width = Math.max(1, Math.round(maxWidth));
    height = Math.max(1, Math.round((source.naturalHeight * width) / source.naturalWidth));
  }
  validateImageDimensions(width, height);

  targetCanvas.width = width;
  targetCanvas.height = height;
  const context = getCanvas2dContext(targetCanvas);
  context.clearRect(0, 0, width, height);
  context.filter = buildEnhancerCanvasFilter(adjustments);
  context.drawImage(source, 0, 0, width, height);
  context.filter = 'none';

  if (adjustments.sharpness > 0) {
    const imageData = context.getImageData(0, 0, width, height);
    const sharpened = sharpenRgbaPixels(
      imageData.data,
      imageData.width,
      imageData.height,
      adjustments.sharpness
    );
    context.putImageData(new ImageData(sharpened, width, height), 0, 0);
  }
}

export default function ImageEnhancer() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [blur, setBlur] = useState(0);
  const [grayscale, setGrayscale] = useState(false);
  const [format, setFormat] = useState<ImageOutputMimeType>('image/png');
  const [quality, setQuality] = useState(92);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const loadIdRef = useRef(0);
  const urls = useObjectUrlRegistry();

  const adjustments = useMemo<ImageEnhancerAdjustments>(
    () => ({ brightness, contrast, saturation, sharpness, blur, grayscale }),
    [brightness, contrast, saturation, sharpness, blur, grayscale]
  );

  const resetAdjustments = useCallback(() => {
    setBrightness(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS.brightness);
    setContrast(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS.contrast);
    setSaturation(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS.saturation);
    setSharpness(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS.sharpness);
    setBlur(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS.blur);
    setGrayscale(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS.grayscale);
  }, []);

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      const nextFile = newFiles[0];
      if (!nextFile) return;

      const loadId = ++loadIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const image = await loadImage(nextFile);
        if (loadId !== loadIdRef.current) return;
        setFile(nextFile);
        setSource(image);
        resetAdjustments();
      } catch (cause) {
        if (loadId === loadIdRef.current) setError(getImageProcessingErrorMessage(cause));
      } finally {
        if (loadId === loadIdRef.current) setLoading(false);
      }
    },
    [resetAdjustments]
  );

  const handleRemove = useCallback(() => {
    loadIdRef.current += 1;
    setFile(null);
    setSource(null);
    setError(null);
    setLoading(false);
    resetAdjustments();
    urls.revokePrefix('enhancer-');
  }, [resetAdjustments, urls]);

  useEffect(() => {
    if (!source) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const availableWidth = canvas.parentElement?.clientWidth;
        renderEnhancedImage(canvas, source, adjustments, availableWidth);
      } catch (cause) {
        setError(getImageProcessingErrorMessage(cause));
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [adjustments, source]);

  const handleDownload = useCallback(async () => {
    if (!source || !file) return;

    setDownloading(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      renderEnhancedImage(canvas, source, adjustments);
      const blob = await exportCanvas(
        canvas,
        format,
        format === 'image/png' ? undefined : quality / 100
      );
      const url = urls.replace('enhancer-download', blob);
      downloadUrl(url, getEnhancedFilename(file.name, format));
      urls.revoke('enhancer-download');
    } catch (cause) {
      setError(getImageProcessingErrorMessage(cause));
    } finally {
      setDownloading(false);
    }
  }, [adjustments, file, format, quality, source, urls]);

  const isModified = Object.entries(adjustments).some(
    ([key, value]) =>
      value !== DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS[key as keyof ImageEnhancerAdjustments]
  );

  return (
    <div data-image-enhancer>
      {!source ? (
        <>
          <FileUploader
            accept="image/jpeg,image/png,image/webp"
            multiple={false}
            budgetProfile="enhancer"
            onFilesSelected={handleFiles}
          />
          {loading && <p role="status">Opening the image safely...</p>}
        </>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <canvas
              ref={canvasRef}
              data-enhancer-preview
              aria-label="Enhanced image preview"
              style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {file?.name} - {file ? formatSize(file.size) : ''}
            </span>
            <button type="button" className="btn btn-secondary" onClick={handleRemove}>
              Remove image
            </button>
          </div>

          <div
            data-enhancer-controls
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <SliderControl
              id="enhancer-brightness"
              label="Brightness"
              value={brightness}
              min={-100}
              max={100}
              onChange={setBrightness}
            />
            <SliderControl
              id="enhancer-saturation"
              label="Saturation"
              value={saturation}
              min={-100}
              max={100}
              onChange={setSaturation}
            />
            <SliderControl
              id="enhancer-contrast"
              label="Contrast"
              value={contrast}
              min={-100}
              max={100}
              onChange={setContrast}
            />
            <SliderControl
              id="enhancer-sharpness"
              label="Sharpness"
              value={sharpness}
              min={0}
              max={100}
              onChange={setSharpness}
            />
            <SliderControl
              id="enhancer-blur"
              label="Blur"
              value={blur}
              min={0}
              max={20}
              onChange={setBlur}
            />
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block' }}>
                Grayscale
              </span>
              <button
                type="button"
                className={grayscale ? 'btn btn-primary' : 'btn btn-secondary'}
                aria-pressed={grayscale}
                onClick={() => setGrayscale((enabled) => !enabled)}
                style={{ marginTop: '0.5rem' }}
              >
                {grayscale ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetAdjustments}
              disabled={!isModified}
            >
              Reset all
            </button>

            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Output format</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value as ImageOutputMimeType)}
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WebP</option>
              </select>
            </label>

            {format !== 'image/png' && (
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Quality: {quality}%</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                />
              </label>
            )}

            <button
              type="button"
              className="btn btn-primary"
              data-enhancer-download
              onClick={handleDownload}
              disabled={downloading}
              style={{ marginLeft: 'auto' }}
            >
              {downloading ? 'Processing...' : 'Download enhanced image'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: '#b91c1c', marginTop: '1rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}

interface SliderControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function SliderControl({ id, label, value, min, max, onChange }: SliderControlProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.25rem',
        }}
      >
        <label htmlFor={id} style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {label}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <output htmlFor={id} style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            {value > 0 ? `+${value}` : value}
          </output>
          {value !== 0 && (
            <button
              type="button"
              onClick={() => onChange(0)}
              className="btn btn-secondary"
              aria-label={`Reset ${label.toLowerCase()}`}
              style={{ padding: '0.2rem 0.45rem', minHeight: 'auto' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
