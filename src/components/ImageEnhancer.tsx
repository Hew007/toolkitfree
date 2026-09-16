import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import FineTune, { FineTuneField } from './FineTune';
import ToolRunNote from './ToolRunNote';
import { useAutoRun } from '../hooks/useAutoRun';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  adjustmentsEqual,
  buildEnhancerCanvasFilter,
  DEFAULT_IMAGE_ENHANCER_PRESET_ID,
  getEnhancedFilename,
  getEnhancerPreviewSize,
  getImageEnhancerPreset,
  IMAGE_ENHANCER_PRESETS,
  sharpenRgbaPixels,
  type ImageEnhancerAdjustments,
  type ImageEnhancerPreset,
  type ImageEnhancerPresetId,
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

const OUTPUT_FORMATS: Record<ImageOutputMimeType, { label: string; extension: string }> = {
  'image/png': { label: 'PNG', extension: 'png' },
  'image/jpeg': { label: 'JPG', extension: 'jpg' },
  'image/webp': { label: 'WebP', extension: 'webp' },
};

/** The chip row is a projection of the preset table, never a second copy of it. */
const PRESET_CHOICES: readonly ToolChoice<ImageEnhancerPresetId>[] = IMAGE_ENHANCER_PRESETS.map(
  (preset) => ({ id: preset.id, label: preset.label, hint: preset.summary })
);

/**
 * How long the settings must sit still before the full-size file is rendered.
 *
 * This is the whole preview/export split: moving a slider repaints the preview
 * immediately on the next frame — a fraction of a megapixel — while the
 * full-resolution render and encode, which can be twenty times that, waits until
 * the drag has finished. Without the wait every pointer move would re-encode the
 * original image and the sliders would stutter.
 */
const ENHANCE_DELAY_MS = 320;

interface EnhanceResult {
  name: string;
  size: number;
  width: number;
  height: number;
  url: string;
}

function renderEnhancedImage(
  targetCanvas: HTMLCanvasElement,
  source: HTMLImageElement,
  adjustments: ImageEnhancerAdjustments,
  width: number,
  height: number
): void {
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

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export default function ImageEnhancer() {
  const [file, setFile] = useState<File | null>(null);
  // The decoded source, kept for the life of the file. Decoding a photo costs far
  // more than drawing it, and with the output following the sliders that decode
  // would otherwise repeat on every run. One decode per file, reused by the
  // preview and by every export.
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [presetId, setPresetId] = useState<ImageEnhancerPresetId>(DEFAULT_IMAGE_ENHANCER_PRESET_ID);
  const initialPreset = getImageEnhancerPreset(DEFAULT_IMAGE_ENHANCER_PRESET_ID);
  const [brightness, setBrightness] = useState(initialPreset.adjustments.brightness);
  const [contrast, setContrast] = useState(initialPreset.adjustments.contrast);
  const [saturation, setSaturation] = useState(initialPreset.adjustments.saturation);
  const [sharpness, setSharpness] = useState(initialPreset.adjustments.sharpness);
  const [blur, setBlur] = useState(initialPreset.adjustments.blur);
  const [grayscale, setGrayscale] = useState(initialPreset.adjustments.grayscale);
  const [format, setFormat] = useState<ImageOutputMimeType>('image/png');
  const [quality, setQuality] = useState(92);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const loadIdRef = useRef(0);
  const objectUrls = useObjectUrlRegistry();

  const preset = getImageEnhancerPreset(presetId);
  const adjustments = useMemo<ImageEnhancerAdjustments>(
    () => ({ brightness, contrast, saturation, sharpness, blur, grayscale }),
    [brightness, contrast, saturation, sharpness, blur, grayscale]
  );
  /** Derived, never stored, so editing a value back to the preset unlights the reset on its own. */
  const tuned = !adjustmentsEqual(adjustments, preset.adjustments);

  const applyPreset = useCallback((next: ImageEnhancerPreset) => {
    setPresetId(next.id);
    setBrightness(next.adjustments.brightness);
    setContrast(next.adjustments.contrast);
    setSaturation(next.adjustments.saturation);
    setSharpness(next.adjustments.sharpness);
    setBlur(next.adjustments.blur);
    setGrayscale(next.adjustments.grayscale);
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
        applyPreset(getImageEnhancerPreset(DEFAULT_IMAGE_ENHANCER_PRESET_ID));
      } catch (cause) {
        if (loadId === loadIdRef.current) setError(getImageProcessingErrorMessage(cause));
      } finally {
        if (loadId === loadIdRef.current) setLoading(false);
      }
    },
    [applyPreset]
  );

  const handleRemove = useCallback(() => {
    loadIdRef.current += 1;
    objectUrls.revokePrefix('enhancer:');
    setFile(null);
    setSource(null);
    setResult(null);
    setElapsedMs(null);
    setPreviewSize({ width: 0, height: 0 });
    setError(null);
    setLoading(false);
    setProcessing(false);
    applyPreset(getImageEnhancerPreset(DEFAULT_IMAGE_ENHANCER_PRESET_ID));
  }, [applyPreset, objectUrls]);

  /**
   * The preview, redrawn on the next frame after any change. It is a downscaled
   * copy — what the column can show, capped by area — so a drag repaints a
   * fraction of the pixels the exported file has.
   */
  const drawPreview = useCallback(() => {
    if (!source) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const size = getEnhancerPreviewSize(
        source.naturalWidth,
        source.naturalHeight,
        canvas.parentElement?.clientWidth ?? 0
      );
      renderEnhancedImage(canvas, source, adjustments, size.width, size.height);
      setPreviewSize((current) =>
        current.width === size.width && current.height === size.height ? current : size
      );
    } catch (cause) {
      setError(getImageProcessingErrorMessage(cause));
    }
  }, [adjustments, source]);

  useEffect(() => {
    if (!source) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawPreview);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawPreview, source]);

  useEffect(() => {
    // A rotated phone or a resized window gives the preview a different column to
    // fill, and a canvas drawn for the old one would be stretched by CSS.
    const handleResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawPreview);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawPreview]);

  /**
   * Everything the exported file depends on, and nothing else. The preset id is
   * absent because it only reaches the output through the adjustments it wrote,
   * and quality is absent for PNG because PNG is lossless.
   */
  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        file: file ? `${file.name}:${file.size}:${file.lastModified}` : null,
        adjustments,
        format,
        quality: format === 'image/png' ? null : quality,
      }),
    [adjustments, file, format, quality]
  );

  // No submit step: the file to download follows the settings.
  useAutoRun({
    key: settingsKey,
    enabled: Boolean(file) && Boolean(source),
    delayMs: ENHANCE_DELAY_MS,
    onInvalidate: () => {
      objectUrls.revoke('enhancer:result');
      // Bail-out writes, because this runs on every input event of a slider drag:
      // handing React the value it already holds ends the update there.
      setResult((current) => (current === null ? current : null));
      setElapsedMs((current) => (current === null ? current : null));
      setError((current) => (current === null ? current : null));
      setProcessing((current) => (current ? false : current));
    },
    run: async (isCurrent) => {
      const sourceFile = file;
      const image = source;
      if (!sourceFile || !image) return;
      setProcessing(true);
      const startedAt = performance.now();

      try {
        const canvas = document.createElement('canvas');
        renderEnhancedImage(canvas, image, adjustments, image.naturalWidth, image.naturalHeight);
        const blob = await exportCanvas(
          canvas,
          format,
          format === 'image/png' ? undefined : quality / 100
        );
        if (!isCurrent()) return;

        // Registered only after the guard: an object URL is shared state, and a
        // superseded run that registers first would revoke the newer run's URL.
        const url = objectUrls.replace('enhancer:result', blob);
        setResult({
          name: getEnhancedFilename(sourceFile.name, format),
          size: blob.size,
          width: canvas.width,
          height: canvas.height,
          url,
        });
        setElapsedMs(Math.round(performance.now() - startedAt));
        setProcessing(false);
      } catch (cause) {
        if (!isCurrent()) return;
        setError(getImageProcessingErrorMessage(cause));
        setProcessing(false);
      }
    },
  });

  const handleDownload = useCallback(() => {
    if (!result) return;
    try {
      downloadUrl(result.url, result.name);
    } catch (cause) {
      setError(getImageProcessingErrorMessage(cause));
    }
  }, [result]);

  const fineTuneSummary = (
    <>
      {preset.label}
      {tuned ? ', edited' : ''} · {OUTPUT_FORMATS[format].label}
      {format === 'image/png' ? '' : ` · quality ${quality}%`}
    </>
  );

  return (
    <div data-image-enhancer aria-busy={processing}>
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
          <div className="enhancer-preview-stage">
            <canvas
              ref={canvasRef}
              data-enhancer-preview
              aria-label="Enhanced image preview"
              className="enhancer-preview-canvas"
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-light)' }}>
              {file?.name} - {source.naturalWidth}x{source.naturalHeight} -{' '}
              {file ? formatSize(file.size) : ''}
            </span>
            <button type="button" className="btn btn-secondary" onClick={handleRemove}>
              Remove image
            </button>
          </div>

          {previewSize.width > 0 && (
            <p className="tool-hint" data-enhancer-preview-note>
              The preview is drawn at {previewSize.width}x{previewSize.height} so it stays smooth
              while you drag. The download below is rendered at the full {source.naturalWidth}x
              {source.naturalHeight}.
            </p>
          )}

          <div className="tool-controls" data-enhancer-controls>
            <ToolChoices
              name="enhancer-correction"
              legend="Which correction?"
              help="Pick a correction and every slider follows it. You can still change each value below."
              choices={PRESET_CHOICES}
              value={presetId}
              onChange={(choice) => applyPreset(getImageEnhancerPreset(choice.id))}
            />

            <FineTune
              summary={fineTuneSummary}
              onReset={tuned ? () => applyPreset(preset) : undefined}
              resetLabel={`Back to the ${preset.label} preset`}
            >
              <AdjustmentSlider
                id="enhancer-brightness"
                label="Brightness"
                value={brightness}
                presetValue={preset.adjustments.brightness}
                min={-100}
                max={100}
                onChange={setBrightness}
              />
              <AdjustmentSlider
                id="enhancer-saturation"
                label="Saturation"
                value={saturation}
                presetValue={preset.adjustments.saturation}
                min={-100}
                max={100}
                onChange={setSaturation}
              />
              <AdjustmentSlider
                id="enhancer-contrast"
                label="Contrast"
                value={contrast}
                presetValue={preset.adjustments.contrast}
                min={-100}
                max={100}
                onChange={setContrast}
              />
              <AdjustmentSlider
                id="enhancer-sharpness"
                label="Sharpness"
                value={sharpness}
                presetValue={preset.adjustments.sharpness}
                min={0}
                max={100}
                hint="Emphasizes edges that are already there. It cannot recover detail the source does not have."
                onChange={setSharpness}
              />
              <AdjustmentSlider
                id="enhancer-blur"
                label="Blur"
                value={blur}
                presetValue={preset.adjustments.blur}
                min={0}
                max={20}
                unit="px"
                onChange={setBlur}
              />

              <FineTuneField htmlFor="enhancer-grayscale" label="Grayscale">
                <button
                  type="button"
                  id="enhancer-grayscale"
                  className={grayscale ? 'btn btn-primary' : 'btn btn-secondary'}
                  aria-pressed={grayscale}
                  style={{ justifySelf: 'start' }}
                  onClick={() => setGrayscale((enabled) => !enabled)}
                >
                  {grayscale ? 'On' : 'Off'}
                </button>
              </FineTuneField>

              <FineTuneField htmlFor="enhancer-format" label="Output format">
                <select
                  id="enhancer-format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ImageOutputMimeType)}
                >
                  {Object.entries(OUTPUT_FORMATS).map(([mimeType, value]) => (
                    <option key={mimeType} value={mimeType}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </FineTuneField>

              <FineTuneField
                htmlFor="enhancer-quality"
                label={`Quality: ${quality}%`}
                hint="PNG is lossless, so quality does not apply to it."
                hidden={format === 'image/png'}
              >
                <input
                  id="enhancer-quality"
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  onChange={(event) => setQuality(Number(event.target.value))}
                />
              </FineTuneField>
            </FineTune>

            <ToolRunNote busy={processing}>
              {processing
                ? 'Rendering the full-size image in your browser…'
                : elapsedMs !== null
                  ? `Rendered in your browser in ${(elapsedMs / 1000).toFixed(1)}s. Nothing was uploaded.`
                  : 'The file below follows the settings above. Nothing is uploaded.'}
            </ToolRunNote>
          </div>
        </div>
      )}

      {processing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Rendering enhanced image.
        </div>
      )}
      {error && (
        <p role="alert" className="status status-error">
          {error}
        </p>
      )}
      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div
            className="result-item"
            data-enhancer-result={result.name}
            data-width={result.width}
            data-height={result.height}
          >
            <div className="result-info">
              <img src={result.url} alt={result.name} className="result-preview" />
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">
                  {result.width}x{result.height} - {formatSize(result.size)}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              data-enhancer-download
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdjustmentSliderProps {
  id: string;
  label: string;
  value: number;
  /** What the current preset set this to. The per-slider reset goes back here, not to zero. */
  presetValue: number;
  min: number;
  max: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
}

function AdjustmentSlider({
  id,
  label,
  value,
  presetValue,
  min,
  max,
  unit,
  hint,
  onChange,
}: AdjustmentSliderProps) {
  const shown = unit ? `${value}${unit}` : signed(value);
  return (
    <FineTuneField htmlFor={id} label={`${label}: ${shown}`} hint={hint}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {/* The visible text is the whole accessible name: it says which slider it
          returns and where to, so it reads the same to everyone. */}
      {value !== presetValue && (
        <button
          type="button"
          className="fine-tune-reset"
          data-reset-adjustment={id}
          onClick={() => onChange(presetValue)}
        >
          Reset {label.toLowerCase()} to {unit ? `${presetValue}${unit}` : signed(presetValue)}
        </button>
      )}
    </FineTuneField>
  );
}
