import { useCallback, useMemo, useState } from 'react';
import FileUploader from './FileUploader';
import IdPhotoEditor from './IdPhotoEditor';
import IdPhotoOptions, { type IdPhotoSettings } from './IdPhotoOptions';
import { getIdPhotoPreset, getSelectableIdPhotoPresets } from '../data/id-photo-presets';
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
  type SourceSize,
} from '../lib/id-photo';

interface DownloadResult {
  name: string;
  url: string;
  size: number;
  width: number;
  height: number;
}

const INITIAL_SETTINGS: IdPhotoSettings = {
  presetId: 'custom',
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
};

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

export default function IdPhotoMaker() {
  const urls = useObjectUrlRegistry();
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [source, setSource] = useState<SourceSize | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [settings, setSettings] = useState<IdPhotoSettings>(INITIAL_SETTINGS);
  const [photo, setPhoto] = useState<DownloadResult | null>(null);
  const [printSheet, setPrintSheet] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

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

  const clearResults = useCallback(() => {
    urls.revoke('id-photo:photo');
    urls.revoke('id-photo:print');
    setPhoto(null);
    setPrintSheet(null);
  }, [urls]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const nextFile = files[0];
      if (!nextFile) return;
      setError(null);
      clearResults();
      try {
        const image = await loadImage(nextFile);
        const nextSource = { width: image.naturalWidth, height: image.naturalHeight };
        setFile(nextFile);
        setSource(nextSource);
        setCrop(cropForRatio(nextSource, ratio));
        setImageUrl(urls.replace('id-photo:source', nextFile));
      } catch (cause) {
        setError(getImageProcessingErrorMessage(cause));
      }
    },
    [clearResults, ratio, urls]
  );

  const reset = () => {
    urls.revoke('id-photo:source');
    clearResults();
    setFile(null);
    setImageUrl(null);
    setSource(null);
    setCrop(null);
    setError(null);
  };

  const handleSettings = (next: IdPhotoSettings) => {
    const nextPreset = getIdPhotoPreset(next.presetId);
    const withPreset =
      next.presetId !== settings.presetId && nextPreset.width && nextPreset.height
        ? {
            ...next,
            width: nextPreset.width.value,
            height: nextPreset.height.value,
            unit: nextPreset.width.unit,
            dpi: nextPreset.recommendedDpi ?? next.dpi,
          }
        : next;
    setSettings(withPreset);
    clearResults();
    if (!source) return;
    try {
      const nextPixels = calculatePixelSize(
        { value: withPreset.width, unit: withPreset.unit },
        { value: withPreset.height, unit: withPreset.unit },
        withPreset.dpi
      );
      setCrop((current) =>
        cropForRatio(source, nextPixels.width / nextPixels.height, current ?? undefined)
      );
    } catch {
      // Keep the last valid frame while the user corrects an incomplete numeric value.
    }
  };

  const generate = async () => {
    if (!file || !source || !crop || !pixelSize) return;
    setProcessing(true);
    setError(null);
    clearResults();
    try {
      const image = await loadImage(file);
      const photoCanvas = document.createElement('canvas');
      photoCanvas.width = pixelSize.width;
      photoCanvas.height = pixelSize.height;
      validateImageDimensions(photoCanvas.width, photoCanvas.height);
      const photoContext = getCanvas2dContext(photoCanvas);
      if (settings.format === 'image/jpeg') {
        photoContext.fillStyle = '#ffffff';
        photoContext.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
      }
      photoContext.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        photoCanvas.width,
        photoCanvas.height
      );
      const photoBlob = await exportCanvas(
        photoCanvas,
        settings.format,
        settings.format === 'image/png' ? undefined : settings.quality / 100
      );
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'id-photo';
      const photoName = `${baseName}-id-photo.${extension(settings.format)}`;
      setPhoto({
        name: photoName,
        url: urls.replace('id-photo:photo', photoBlob),
        size: photoBlob.size,
        ...pixelSize,
      });

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
      const printBlob = await exportCanvas(printCanvas, 'image/png');
      const printName = `${baseName}-${settings.paper}-print-sheet.png`;
      setPrintSheet({
        name: printName,
        url: urls.replace('id-photo:print', printBlob),
        size: printBlob.size,
        width: layout.paper.width,
        height: layout.paper.height,
      });
    } catch (cause) {
      setError(getImageProcessingErrorMessage(cause));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div data-id-photo-maker aria-busy={processing}>
      {!imageUrl || !source || !crop ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="cropper"
          onFilesSelected={handleFiles}
        />
      ) : (
        <>
          <div className="privacy-badge" style={{ marginBottom: '1rem' }}>
            <span style={{ color: '#047857', fontWeight: 600 }}>
              Original-photo mode: this tool only crops, scales, and lays out your image locally.
            </span>
          </div>
          <div className="status status-warning" style={{ marginBottom: '1rem' }}>
            {preset.warning}
          </div>
          <IdPhotoEditor
            imageUrl={imageUrl}
            source={source}
            crop={crop}
            ratio={ratio}
            headHeightRange={headHeightRange}
            onCropChange={(next) => {
              setCrop(next);
              clearResults();
            }}
          />
          <IdPhotoOptions
            presets={getSelectableIdPhotoPresets()}
            settings={settings}
            onChange={handleSettings}
          />
          {pixelSize ? (
            <p data-testid="id-photo-output-size" style={{ margin: '0 0 1rem', color: '#4b5563' }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={generate}
              disabled={processing || !pixelSize}
            >
              {processing ? 'Preparing files...' : 'Prepare photo and print sheet'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Choose another photo
            </button>
          </div>
        </>
      )}
      {processing && (
        <p role="status" aria-live="polite">
          Preparing your local photo files…
        </p>
      )}
      {error && (
        <div className="status status-error" role="alert" style={{ marginTop: '1rem' }}>
          {error}
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
