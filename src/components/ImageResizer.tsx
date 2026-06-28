import { useCallback, useState } from 'react';
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
  RESIZE_PRESETS,
  calculateResizeDimensions,
  type ResizePresetKey,
} from '../lib/image-resizer';

interface ResizedFile {
  sourceId: string;
  sourceName: string;
  outputName: string;
  name: string;
  originalSize: number;
  outputSize: number;
  newSize: number;
  blob: Blob;
  width: number;
  height: number;
  url: string;
}

interface ResizeFailure {
  sourceId: string;
  name: string;
  message: string;
}

interface ImageResizerProps {
  defaultPreset?: ResizePresetKey;
}

const OUTPUT_FORMATS: Record<ImageOutputMimeType, { label: string; extension: string }> = {
  'image/jpeg': { label: 'JPG', extension: 'jpg' },
  'image/png': { label: 'PNG', extension: 'png' },
  'image/webp': { label: 'WebP', extension: 'webp' },
};

export default function ImageResizer({ defaultPreset = 'custom' }: ImageResizerProps) {
  const initialPreset = RESIZE_PRESETS[defaultPreset];
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState<ResizePresetKey>(defaultPreset);
  const [width, setWidth] = useState<number>(initialPreset.width);
  const [height, setHeight] = useState<number>(initialPreset.height);
  const [maintainRatio, setMaintainRatio] = useState(defaultPreset === 'custom');
  const [format, setFormat] = useState<ImageOutputMimeType>('image/jpeg');
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ResizedFile[]>([]);
  const [failures, setFailures] = useState<ResizeFailure[]>([]);
  const objectUrls = useObjectUrlRegistry();

  const clearResults = useCallback(() => {
    objectUrls.revokePrefix('resizer:result:');
    setResults([]);
    setFailures([]);
  }, [objectUrls]);

  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles((current) => [...current, ...newFiles]);
    clearResults();
  }, [clearResults]);

  const handleRemove = useCallback((index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    clearResults();
  }, [clearResults]);

  const handlePresetChange = (value: ResizePresetKey) => {
    setPreset(value);
    const nextPreset = RESIZE_PRESETS[value];
    setWidth(nextPreset.width);
    setHeight(nextPreset.height);
    setMaintainRatio(value === 'custom');
    clearResults();
  };

  const handleWidthChange = (value: number) => {
    setWidth(value);
    setPreset('custom');
    clearResults();
  };

  const handleHeightChange = (value: number) => {
    setHeight(value);
    setPreset('custom');
    clearResults();
  };

  const resizeImage = async (file: File, index: number): Promise<ResizedFile> => {
    const image = await loadImage(file);
    const outputDimensions = calculateResizeDimensions(
      { width: image.naturalWidth, height: image.naturalHeight },
      { width, height },
      preset === 'custom' && maintainRatio
    );
    const canvas = document.createElement('canvas');
    canvas.width = outputDimensions.width;
    canvas.height = outputDimensions.height;
    const context = getCanvas2dContext(canvas);

    if (format === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await exportCanvas(canvas, format, format === 'image/png' ? undefined : quality / 100);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'resized-image';
    const outputName = `${baseName}.${OUTPUT_FORMATS[format].extension}`;
    const url = objectUrls.replace(`resizer:result:${index}`, blob);

    return {
      sourceId: `file-${index}`,
      sourceName: file.name,
      outputName,
      name: outputName,
      originalSize: file.size,
      outputSize: blob.size,
      newSize: blob.size,
      blob,
      width: canvas.width,
      height: canvas.height,
      url,
    };
  };

  const handleResize = async () => {
    if (files.length === 0 || width < 1 || height < 1) return;
    setProcessing(true);
    clearResults();

    const settled = await Promise.allSettled(files.map((file, index) => resizeImage(file, index)));
    const nextResults: ResizedFile[] = [];
    const nextFailures: ResizeFailure[] = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        nextResults.push(outcome.value);
      } else {
        nextFailures.push({
          sourceId: `file-${index}`,
          name: files[index].name,
          message: getImageProcessingErrorMessage(outcome.reason),
        });
      }
    });
    setResults(nextResults);
    setFailures(nextFailures);
    setProcessing(false);
  };

  return (
    <div data-resizer-preset={preset} aria-busy={processing}>
      {processing && <div className="visually-hidden" role="status" aria-live="polite">Resizing images.</div>}
      <FileUploader accept="image/jpeg,image/png,image/webp" multiple={true} onFilesSelected={handleFiles} />
      <FileList files={files} onRemove={handleRemove} />

      {files.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label htmlFor="resize-preset" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Preset</label>
              <select id="resize-preset" data-testid="resize-preset" value={preset} onChange={(event) => handlePresetChange(event.target.value as ResizePresetKey)} style={{ width: '100%' }}>
                {Object.entries(RESIZE_PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="resize-width" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                {preset === 'custom' && maintainRatio ? 'Max width (px)' : 'Width (px)'}
              </label>
              <input id="resize-width" data-testid="resize-width" type="number" value={width} onChange={(event) => handleWidthChange(Number(event.target.value))} min={1} max={10000} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem' }} />
            </div>
            <div>
              <label htmlFor="resize-height" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                {preset === 'custom' && maintainRatio ? 'Max height (px)' : 'Height (px)'}
              </label>
              <input id="resize-height" data-testid="resize-height" type="number" value={height} onChange={(event) => handleHeightChange(Number(event.target.value))} min={1} max={10000} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.875rem' }} />
            </div>
            <div>
              <label htmlFor="resize-format" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Format</label>
              <select id="resize-format" data-testid="resize-format" value={format} onChange={(event) => { setFormat(event.target.value as ImageOutputMimeType); clearResults(); }} style={{ width: '100%' }}>
                {Object.entries(OUTPUT_FORMATS).map(([mimeType, value]) => <option key={mimeType} value={mimeType}>{value.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem' }}>
              <input data-testid="resize-maintain-ratio" type="checkbox" checked={maintainRatio} disabled={preset !== 'custom'} onChange={(event) => { setMaintainRatio(event.target.checked); clearResults(); }} />{' '}
              Maintain aspect ratio
            </label>
            <div style={{ marginTop: '0.25rem', color: '#6b7280', fontSize: '0.8125rem' }}>
              {preset === 'custom' && maintainRatio
                ? 'Each image fits inside the maximum width and height without stretching.'
                : preset === 'custom'
                  ? 'The exact width and height are used; the image may be stretched.'
                  : 'Platform presets use their exact width and height.'}
            </div>
          </div>

          {format !== 'image/png' && (
            <div style={{ maxWidth: '300px', marginBottom: '1rem' }}>
              <label htmlFor="resize-quality" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Quality: {quality}%</label>
              <input id="resize-quality" data-testid="resize-quality" type="range" min="10" max="100" value={quality} onChange={(event) => { setQuality(Number(event.target.value)); clearResults(); }} />
            </div>
          )}

          <button type="button" className="btn btn-primary" onClick={handleResize} disabled={processing || width < 1 || height < 1} style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            {processing ? 'Resizing...' : `Resize ${files.length} image${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      <BatchResultsSummary
        successes={results}
        failures={failures}
        archiveName="toolkitfree-resized-images.zip"
      />

      {results.length > 0 && (
        <div>
          {results.map((result) => (
            <div key={result.url} className="result-item" data-resize-result={result.name} data-width={result.width} data-height={result.height}>
              <div className="result-info">
                <img src={result.url} alt={result.name} className="result-preview" />
                <div>
                  <div className="file-item-name">{result.name}</div>
                  <div className="file-item-size">{result.width}x{result.height} - {formatSize(result.newSize)}</div>
                </div>
              </div>
              <a href={result.url} download={result.name} className="btn btn-primary">Download</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}