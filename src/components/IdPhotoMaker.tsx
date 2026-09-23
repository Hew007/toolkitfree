import { useCallback, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import FineTune from './FineTune';
import IdPhotoEditor from './IdPhotoEditor';
import IdPhotoOptions, { type IdPhotoSettings } from './IdPhotoOptions';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import ToolRunNote from './ToolRunNote';
import {
  getIdPhotoPreset,
  getSelectableIdPhotoPresets,
  type IdPhotoDimension,
  type IdPhotoPresetId,
} from '../data/id-photo-presets';
import { useAutoRun } from '../hooks/useAutoRun';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  downloadUrl,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  validateImageDimensions,
} from '../lib/image-processing';
import {
  calculateHeadHeightRange,
  calculatePixelSize,
  calculatePrintLayout,
  convertLength,
  type CropRect,
  type PixelSize,
  type SourceSize,
} from '../lib/id-photo';

interface DownloadResult {
  name: string;
  url: string;
  size: number;
  width: number;
  height: number;
}

/**
 * One artifact's progress. The two outputs are produced by two independent runs,
 * so each carries its own state: a quality change re-encodes the photo while the
 * print sheet on screen stays valid, and the run note can say so.
 */
type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ready'; elapsedMs: number }
  | { status: 'failed'; message: string };

const IDLE: RunState = { status: 'idle' };
const RUNNING: RunState = { status: 'running' };

const UNIT_LABELS: Record<IdPhotoSettings['unit'], string> = {
  px: 'px',
  mm: 'mm',
  in: 'in',
};

/**
 * Everything a preset does not decide. A preset names a document size and the DPI
 * to render it at; paper, format and cut lines belong to the visitor, so they
 * start here and "back to the preset" returns to the same baseline.
 */
const BASE_SETTINGS = {
  width: 35,
  height: 45,
  unit: 'mm',
  dpi: 300,
  format: 'image/jpeg',
  quality: 92,
  paper: '4x6',
  marginMm: 3,
  gapMm: 2,
  cutLines: true,
} as const satisfies Omit<IdPhotoSettings, 'presetId'>;

function settingsForPreset(presetId: IdPhotoPresetId): IdPhotoSettings {
  const preset = getIdPhotoPreset(presetId);
  const settings: IdPhotoSettings = {
    ...BASE_SETTINGS,
    presetId,
    dpi: preset.recommendedDpi ?? BASE_SETTINGS.dpi,
  };
  if (!preset.width || !preset.height) return settings;
  return {
    ...settings,
    width: preset.width.value,
    height: preset.height.value,
    unit: preset.width.unit,
  };
}

/** Every value a preset writes, so a hand-edit of any of them is detectable. */
const SETTING_KEYS = [
  'presetId',
  'width',
  'height',
  'unit',
  'dpi',
  'format',
  'quality',
  'paper',
  'marginMm',
  'gapMm',
  'cutLines',
] as const satisfies readonly (keyof IdPhotoSettings)[];

function describeSize(width: IdPhotoDimension, height: IdPhotoDimension): string {
  return `${width.value} × ${height.value} ${UNIT_LABELS[width.unit]}`;
}

/**
 * The chips answer the one question this tool is really asking — which document
 * is the photo for — and they are a projection of the preset table rather than a
 * second copy of it, so a chip can never name a size the preset no longer sets.
 *
 * The labels are the preset labels verbatim, including the words "size
 * reference". Shortening them to "US passport" would read as a compliance claim,
 * which is exactly what every one of these entries warns it is not.
 */
const DOCUMENT_CHOICES: readonly ToolChoice<IdPhotoPresetId>[] = getSelectableIdPhotoPresets().map(
  (preset) => ({
    id: preset.id,
    label: preset.label,
    hint:
      preset.width && preset.height
        ? `${describeSize(preset.width, preset.height)}${preset.recommendedDpi ? ` · ${preset.recommendedDpi} DPI` : ''}`
        : 'Any width, height, and DPI you enter',
  })
);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cropForRatio(source: SourceSize, ratio: number, previous?: CropRect): CropRect {
  const centerX = previous ? previous.x + previous.width / 2 : source.width / 2;
  const centerY = previous ? previous.y + previous.height / 2 : source.height / 2;
  let height = Math.min(source.height, previous?.height ?? source.height);
  let width = height * ratio;
  if (width > source.width) {
    width = source.width;
    height = width / ratio;
  }
  return {
    width,
    height,
    x: clamp(centerX - width / 2, 0, source.width - width),
    y: clamp(centerY - height / 2, 0, source.height - height),
  };
}

function paperDimensions(paper: IdPhotoSettings['paper']) {
  return paper === '4x6'
    ? { width: { value: 6, unit: 'in' as const }, height: { value: 4, unit: 'in' as const } }
    : { width: { value: 210, unit: 'mm' as const }, height: { value: 297, unit: 'mm' as const } };
}

function extension(format: IdPhotoSettings['format']): string {
  return format === 'image/png' ? 'png' : 'jpg';
}

function baseNameOf(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || 'id-photo';
}

function formatElapsed(elapsedMs: number): string {
  return elapsedMs < 1000 ? `${elapsedMs} ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
}

/**
 * The cropped photo at its output resolution. Both runs build their own copy of
 * it from the cached decode; at well under a millisecond that is cheaper than
 * sharing one canvas between two runs that can be in flight at the same time.
 *
 * The white fill is a matte for a source with transparency. The sheet always
 * applies it because the paper is white; the photo applies it only for JPG,
 * which has no alpha channel to preserve.
 */
function renderPhotoCanvas(
  image: CanvasImageSource,
  crop: CropRect,
  pixelSize: PixelSize,
  matte: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = pixelSize.width;
  canvas.height = pixelSize.height;
  validateImageDimensions(canvas.width, canvas.height);
  const context = getCanvas2dContext(canvas);
  if (matte) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas;
}

export default function IdPhotoMaker() {
  const urls = useObjectUrlRegistry();
  const [file, setFile] = useState<File | null>(null);
  // Identifies the chosen file inside the run keys. A name and size would collide
  // across two different photos saved under the same name.
  const [fileToken, setFileToken] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [source, setSource] = useState<SourceSize | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [settings, setSettings] = useState<IdPhotoSettings>(() => settingsForPreset('custom'));
  const [photo, setPhoto] = useState<DownloadResult | null>(null);
  const [printSheet, setPrintSheet] = useState<DownloadResult | null>(null);
  const [photoRun, setPhotoRun] = useState<RunState>(IDLE);
  const [sheetRun, setSheetRun] = useState<RunState>(IDLE);
  const [error, setError] = useState<string | null>(null);

  /**
   * Decoding the source is the expensive half of a run and it does not change
   * while the crop does: measured here, a 3024 × 4032 phone photo costs about
   * 65 ms to decode against 3 ms to draw and encode the ID photo from it. Cached
   * per file so dragging the frame pays for the draw only.
   */
  const decodedRef = useRef<{ file: File; image: HTMLImageElement } | null>(null);

  const decodeSource = useCallback(async (nextFile: File) => {
    const cached = decodedRef.current;
    if (cached && cached.file === nextFile) return cached.image;
    const image = await loadImage(nextFile);
    decodedRef.current = { file: nextFile, image };
    return image;
  }, []);

  const pixelSize = useMemo(() => {
    try {
      return calculatePixelSize(
        { value: settings.width, unit: settings.unit },
        { value: settings.height, unit: settings.unit },
        settings.dpi
      );
    } catch {
      return null;
    }
  }, [settings.dpi, settings.height, settings.unit, settings.width]);
  const ratio = pixelSize ? pixelSize.width / pixelSize.height : 35 / 45;
  const preset = getIdPhotoPreset(settings.presetId);
  const presetDefaults = useMemo(() => settingsForPreset(settings.presetId), [settings.presetId]);
  const tuned = SETTING_KEYS.some((key) => settings[key] !== presetDefaults[key]);
  const headHeightRange = useMemo(() => {
    if (!preset.headHeightMm) return null;
    try {
      return calculateHeadHeightRange(
        convertLength(settings.height, settings.unit, 'mm', settings.dpi),
        preset.headHeightMm
      );
    } catch {
      return null;
    }
  }, [preset.headHeightMm, settings.dpi, settings.height, settings.unit]);

  /**
   * The frame is a floating-point rectangle, but the export samples whole source
   * pixels. Rounding here keeps a sub-pixel wobble from scheduling a run that
   * would produce the same bytes.
   */
  const cropKey = crop
    ? `${Math.round(crop.x)},${Math.round(crop.y)},${Math.round(crop.width)},${Math.round(crop.height)}`
    : '';

  const photoKey = useMemo(
    () =>
      JSON.stringify({
        fileToken,
        cropKey,
        pixelSize,
        format: settings.format,
        // PNG is lossless, so the quality field cannot change a PNG's bytes.
        quality: settings.format === 'image/png' ? null : settings.quality,
      }),
    [cropKey, fileToken, pixelSize, settings.format, settings.quality]
  );

  /**
   * The sheet tiles the same photo onto paper and is always a PNG, so neither the
   * download format nor the JPG quality changes a single byte of it. Leaving both
   * out of this key is what keeps a drag of the quality slider from re-encoding a
   * 2.6 MB A4 sheet alongside the 33 KB photo that actually changed.
   */
  const sheetKey = useMemo(
    () =>
      JSON.stringify({
        fileToken,
        cropKey,
        pixelSize,
        width: settings.width,
        height: settings.height,
        unit: settings.unit,
        dpi: settings.dpi,
        paper: settings.paper,
        marginMm: settings.marginMm,
        gapMm: settings.gapMm,
        cutLines: settings.cutLines,
      }),
    [
      cropKey,
      fileToken,
      pixelSize,
      settings.cutLines,
      settings.dpi,
      settings.gapMm,
      settings.height,
      settings.marginMm,
      settings.paper,
      settings.unit,
      settings.width,
    ]
  );

  const ready = Boolean(file && crop && pixelSize);

  // No submit button: both files follow the frame and the settings.
  useAutoRun({
    key: photoKey,
    enabled: ready,
    onInvalidate: () => {
      urls.revoke('id-photo:photo');
      // This fires on every pointer move of a drag, so it has to stay cheap and
      // idempotent: handing React back the value it already holds ends the update
      // in place instead of re-rendering.
      setPhoto((current) => (current === null ? current : null));
      setPhotoRun((current) => (current.status === 'idle' ? current : IDLE));
    },
    run: async (isCurrent) => {
      if (!file || !crop || !pixelSize) return;
      const startedAt = performance.now();
      setPhotoRun(RUNNING);
      try {
        const image = await decodeSource(file);
        if (!isCurrent()) return;
        const canvas = renderPhotoCanvas(image, crop, pixelSize, settings.format === 'image/jpeg');
        const blob = await exportCanvas(
          canvas,
          settings.format,
          settings.format === 'image/png' ? undefined : settings.quality / 100
        );
        // Only past this guard does this run own the key. `replace` revokes what
        // the key held, so registering earlier would let a superseded run pull the
        // URL out from under a newer one on its way to abandoning itself.
        if (!isCurrent()) return;
        setPhoto({
          name: `${baseNameOf(file)}-id-photo.${extension(settings.format)}`,
          url: urls.replace('id-photo:photo', blob),
          size: blob.size,
          ...pixelSize,
        });
        setPhotoRun({ status: 'ready', elapsedMs: Math.round(performance.now() - startedAt) });
      } catch (cause) {
        if (!isCurrent()) return;
        setPhotoRun({ status: 'failed', message: getImageProcessingErrorMessage(cause) });
      }
    },
  });

  useAutoRun({
    key: sheetKey,
    enabled: ready,
    onInvalidate: () => {
      urls.revoke('id-photo:print');
      setPrintSheet((current) => (current === null ? current : null));
      setSheetRun((current) => (current.status === 'idle' ? current : IDLE));
    },
    run: async (isCurrent) => {
      if (!file || !crop || !pixelSize) return;
      const startedAt = performance.now();
      setSheetRun(RUNNING);
      try {
        const image = await decodeSource(file);
        if (!isCurrent()) return;
        const photoCanvas = renderPhotoCanvas(image, crop, pixelSize, true);
        const paper = paperDimensions(settings.paper);
        const layout = calculatePrintLayout({
          paperWidth: paper.width,
          paperHeight: paper.height,
          photoWidth: { value: settings.width, unit: settings.unit },
          photoHeight: { value: settings.height, unit: settings.unit },
          dpi: settings.dpi,
          marginMm: settings.marginMm,
          gapMm: settings.gapMm,
        });
        validateImageDimensions(layout.paper.width, layout.paper.height);
        const printCanvas = document.createElement('canvas');
        printCanvas.width = layout.paper.width;
        printCanvas.height = layout.paper.height;
        const printContext = getCanvas2dContext(printCanvas);
        printContext.fillStyle = '#ffffff';
        printContext.fillRect(0, 0, printCanvas.width, printCanvas.height);
        for (const item of layout.items) {
          printContext.drawImage(photoCanvas, item.x, item.y, item.width, item.height);
          if (settings.cutLines) {
            printContext.save();
            printContext.strokeStyle = '#737373';
            printContext.lineWidth = 1;
            printContext.setLineDash([6, 4]);
            printContext.strokeRect(item.x, item.y, item.width, item.height);
            printContext.restore();
          }
        }
        const blob = await exportCanvas(printCanvas, 'image/png');
        if (!isCurrent()) return;
        setPrintSheet({
          name: `${baseNameOf(file)}-${settings.paper}-print-sheet.png`,
          url: urls.replace('id-photo:print', blob),
          size: blob.size,
          width: layout.paper.width,
          height: layout.paper.height,
        });
        setSheetRun({ status: 'ready', elapsedMs: Math.round(performance.now() - startedAt) });
      } catch (cause) {
        if (!isCurrent()) return;
        setSheetRun({ status: 'failed', message: getImageProcessingErrorMessage(cause) });
      }
    },
  });

  const handleFiles = useCallback(
    async (files: File[]) => {
      const nextFile = files[0];
      if (!nextFile) return;
      setError(null);
      try {
        const image = await decodeSource(nextFile);
        const nextSource = { width: image.naturalWidth, height: image.naturalHeight };
        setFile(nextFile);
        setFileToken((token) => token + 1);
        setSource(nextSource);
        setCrop(cropForRatio(nextSource, ratio));
        setImageUrl(urls.replace('id-photo:source', nextFile));
      } catch (cause) {
        setError(getImageProcessingErrorMessage(cause));
      }
    },
    [decodeSource, ratio, urls]
  );

  const reset = () => {
    urls.revokeAll();
    decodedRef.current = null;
    setFile(null);
    setFileToken((token) => token + 1);
    setImageUrl(null);
    setSource(null);
    setCrop(null);
    setPhoto(null);
    setPrintSheet(null);
    setPhotoRun(IDLE);
    setSheetRun(IDLE);
    setError(null);
  };

  const applySettings = (next: IdPhotoSettings) => {
    setSettings(next);
    if (!source) return;
    try {
      const nextPixels = calculatePixelSize(
        { value: next.width, unit: next.unit },
        { value: next.height, unit: next.unit },
        next.dpi
      );
      setCrop((current) =>
        cropForRatio(source, nextPixels.width / nextPixels.height, current ?? undefined)
      );
    } catch {
      // Keep the last valid frame while the user corrects an incomplete numeric value.
    }
  };

  const busy = photoRun.status === 'running' || sheetRun.status === 'running';
  const failures = [photoRun, sheetRun]
    .filter((run): run is Extract<RunState, { status: 'failed' }> => run.status === 'failed')
    .map((run) => run.message);
  const fineTuneSummary = [
    `${settings.width} × ${settings.height} ${UNIT_LABELS[settings.unit]}`,
    `${settings.dpi} DPI`,
    settings.format === 'image/png' ? 'PNG' : `JPG ${settings.quality}%`,
    settings.paper === '4x6' ? '4×6 sheet' : 'A4 sheet',
  ].join(' · ');

  return (
    <div
      data-id-photo-maker
      aria-busy={busy}
      data-tool-input={imageUrl && source && crop ? 'present' : 'empty'}
    >
      {busy && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Preparing your photo and print sheet.
        </div>
      )}
      {!imageUrl || !source || !crop ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="cropper"
          onFilesSelected={handleFiles}
        />
      ) : (
        <div className="id-photo-workspace">
          <div className="id-photo-editor-panel">
            <IdPhotoEditor
              imageUrl={imageUrl}
              source={source}
              crop={crop}
              ratio={ratio}
              headHeightRange={headHeightRange}
              onCropChange={setCrop}
            />
          </div>
          <div className="id-photo-settings-panel">
            <div className="tool-controls">
              <ToolChoices
                name="id-photo-document"
                legend="What is the photo for?"
                help="Choose a document and the size follows. Every exact value is still below."
                choices={DOCUMENT_CHOICES}
                value={settings.presetId}
                onChange={(choice) => applySettings(settingsForPreset(choice.id))}
              />
              <div className="status status-warning">{preset.warning}</div>
              {pixelSize ? (
                <p data-testid="id-photo-output-size" style={{ margin: 0, color: '#4a463e' }}>
                  Digital photo output:{' '}
                  <strong>
                    {pixelSize.width} × {pixelSize.height}px
                  </strong>{' '}
                  at {settings.dpi} DPI. The print sheet is a PNG; choose matching paper and scaling
                  settings in your print dialog.
                </p>
              ) : (
                <p className="status status-error">Enter positive width, height, and DPI values.</p>
              )}
              <FineTune
                summary={fineTuneSummary}
                onReset={tuned ? () => applySettings(presetDefaults) : undefined}
                resetLabel={`Back to the ${preset.label} preset`}
              >
                <IdPhotoOptions settings={settings} onChange={applySettings} />
              </FineTune>
              <ToolRunNote busy={busy}>
                {busy
                  ? 'Rendering in your browser…'
                  : photoRun.status === 'ready' && sheetRun.status === 'ready'
                    ? `Photo rendered in ${formatElapsed(photoRun.elapsedMs)} and the print sheet in ${formatElapsed(sheetRun.elapsedMs)}, both in your browser. Nothing was uploaded.`
                    : 'Both files follow the frame and the settings above. Nothing is uploaded.'}
              </ToolRunNote>
            </div>
            {/*
              Deliberately not `.id-photo-actions`: that row is sticky because it
              used to carry the submit button. Pinning what is left of it floats a
              secondary action over the chip row on a phone, which is where the
              real controls now are.
            */}
            <div>
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Choose another photo
              </button>
            </div>
          </div>
        </div>
      )}
      {(error || failures.length > 0) && (
        <div className="status status-error" role="alert" style={{ marginTop: '1rem' }}>
          {[error, ...failures].filter(Boolean).join(' ')}
        </div>
      )}
      {(photo || printSheet) && (
        <section
          aria-label="Prepared files"
          style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}
        >
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Prepared files</h2>
          {[photo, printSheet]
            .filter((result): result is DownloadResult => Boolean(result))
            .map((result) => (
              <div key={result.name} className="result-item" data-id-photo-result={result.name}>
                <div className="result-info">
                  <img src={result.url} alt={`${result.name} preview`} className="result-preview" />
                  <div>
                    <div className="file-item-name">{result.name}</div>
                    <div className="file-item-size">
                      {result.width} × {result.height}px · {formatSize(result.size)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => downloadUrl(result.url, result.name)}
                >
                  Download
                </button>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
