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
  type ImageOutputMimeType,
} from '../lib/image-processing';
import {
  CROP_ASPECT_PRESETS,
  createInitialCropRect,
  moveCropRect,
  resizeCropRect,
  toPixelCropRect,
  type CropAspectPresetKey,
  type CropBounds,
  type CropHandle,
  type CropRect,
} from '../lib/image-cropper';

interface CropResult {
  name: string;
  newSize: number;
  width: number;
  height: number;
  url: string;
}

interface DragState {
  handle: CropHandle;
  pointerId: number;
  startX: number;
  startY: number;
  startRect: CropRect;
}

interface ImageCropperProps {
  defaultAspectPreset?: CropAspectPresetKey;
}

const OUTPUT_FORMATS: Record<ImageOutputMimeType, { label: string; extension: string }> = {
  'image/png': { label: 'PNG', extension: 'png' },
  'image/jpeg': { label: 'JPG', extension: 'jpg' },
  'image/webp': { label: 'WebP', extension: 'webp' },
};

const EMPTY_BOUNDS: CropBounds = { width: 0, height: 0 };
const EMPTY_CROP: CropRect = { x: 0, y: 0, width: 0, height: 0 };

export default function ImageCropper({ defaultAspectPreset = 'free' }: ImageCropperProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBounds, setImageBounds] = useState<CropBounds>(EMPTY_BOUNDS);
  const [aspectPreset, setAspectPreset] = useState<CropAspectPresetKey>(defaultAspectPreset);
  const [cropRect, setCropRect] = useState<CropRect>(EMPTY_CROP);
  const [displayScale, setDisplayScale] = useState(1);
  const [format, setFormat] = useState<ImageOutputMimeType>('image/png');
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CropResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  const objectUrls = useObjectUrlRegistry();
  const aspectRatio = CROP_ASPECT_PRESETS[aspectPreset].ratio;

  const clearResult = useCallback(() => {
    objectUrls.revoke('cropper:result');
    setResult(null);
  }, [objectUrls]);

  const updateDisplayScale = useCallback(() => {
    const image = imageRef.current;
    if (!image?.naturalWidth) return;
    setDisplayScale(image.clientWidth / image.naturalWidth || 1);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateDisplayScale);
    return () => {
      window.removeEventListener('resize', updateDisplayScale);
      cleanupDragRef.current?.();
    };
  }, [updateDisplayScale]);

  const handleFiles = useCallback((newFiles: File[]) => {
    const nextFile = newFiles[0];
    if (!nextFile) return;
    try {
      validateImageFile(nextFile);
      clearResult();
      setFile(nextFile);
      setImageBounds(EMPTY_BOUNDS);
      setCropRect(EMPTY_CROP);
      setImageUrl(objectUrls.replace('cropper:preview', nextFile));
      setError(null);
    } catch (fileError) {
      setError(getImageProcessingErrorMessage(fileError));
    }
  }, [clearResult, objectUrls]);

  const handleRemove = useCallback(() => {
    cleanupDragRef.current?.();
    objectUrls.revoke('cropper:preview');
    clearResult();
    setFile(null);
    setImageUrl(null);
    setImageBounds(EMPTY_BOUNDS);
    setCropRect(EMPTY_CROP);
    setError(null);
  }, [clearResult, objectUrls]);

  const handleImageLoad = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;
    const bounds = { width: image.naturalWidth, height: image.naturalHeight };
    setImageBounds(bounds);
    setCropRect(createInitialCropRect(bounds, aspectRatio));
    updateDisplayScale();
  }, [aspectRatio, updateDisplayScale]);

  const handleAspectChange = (nextPreset: CropAspectPresetKey) => {
    setAspectPreset(nextPreset);
    clearResult();
    if (imageBounds.width > 0 && imageBounds.height > 0) {
      setCropRect(createInitialCropRect(imageBounds, CROP_ASPECT_PRESETS[nextPreset].ratio));
    }
  };

  const handlePointerDown = (handle: CropHandle, event: React.PointerEvent) => {
    if (imageBounds.width <= 0 || imageBounds.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    cleanupDragRef.current?.();
    dragRef.current = {
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRect: { ...cropRect },
    };

    const onMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || moveEvent.pointerId !== drag.pointerId) return;
      moveEvent.preventDefault();
      const scale = displayScale || 1;
      const dx = (moveEvent.clientX - drag.startX) / scale;
      const dy = (moveEvent.clientY - drag.startY) / scale;
      const nextRect = drag.handle === 'move'
        ? moveCropRect(drag.startRect, dx, dy, imageBounds)
        : resizeCropRect(drag.startRect, drag.handle, dx, dy, imageBounds, aspectRatio);
      setCropRect(nextRect);
      clearResult();
    };

    const cleanup = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      cleanupDragRef.current = null;
    };
    cleanupDragRef.current = cleanup;
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  const handleCrop = async () => {
    if (!file || imageBounds.width <= 0 || imageBounds.height <= 0) return;
    setProcessing(true);
    setError(null);
    clearResult();

    try {
      const image = await loadImage(file);
      const pixelCrop = toPixelCropRect(cropRect, imageBounds);
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const context = getCanvas2dContext(canvas);
      if (format === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const blob = await exportCanvas(canvas, format, format === 'image/png' ? undefined : quality / 100);
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'cropped-image';
      const outputName = `${baseName}-cropped.${OUTPUT_FORMATS[format].extension}`;
      const url = objectUrls.replace('cropper:result', blob);
      setResult({
        name: outputName,
        newSize: blob.size,
        width: canvas.width,
        height: canvas.height,
        url,
      });
    } catch (cropError) {
      setError(getImageProcessingErrorMessage(cropError));
    } finally {
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

  const scaled = {
    left: cropRect.x * displayScale,
    top: cropRect.y * displayScale,
    width: cropRect.width * displayScale,
    height: cropRect.height * displayScale,
  };

  return (
    <div data-crop-aspect={aspectPreset}>
      {!imageUrl ? (
        <FileUploader accept="image/jpeg,image/png,image/webp" multiple={false} onFilesSelected={handleFiles} />
      ) : (
        <div>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', marginBottom: '1rem', userSelect: 'none', touchAction: 'none' }}>
            <img ref={imageRef} src={imageUrl} onLoad={handleImageLoad} alt="Crop preview" style={{ display: 'block', maxWidth: '100%', height: 'auto' }} draggable={false} />
            {cropRect.width > 0 && (
              <div style={{ position: 'absolute', inset: 0 }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
                  <defs>
                    <mask id="crop-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect x={scaled.left} y={scaled.top} width={scaled.width} height={scaled.height} fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
                </svg>

                <div
                  data-testid="crop-box"
                  data-crop-x={cropRect.x}
                  data-crop-y={cropRect.y}
                  data-crop-width={cropRect.width}
                  data-crop-height={cropRect.height}
                  style={{
                    position: 'absolute',
                    ...scaled,
                    border: '2px solid #fff',
                    boxSizing: 'border-box',
                    cursor: 'move',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                    touchAction: 'none',
                  }}
                  onPointerDown={(event) => handlePointerDown('move', event)}
                >
                  <div style={{ position: 'absolute', left: '33.33%', top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ position: 'absolute', left: '66.66%', top: 0, width: 1, height: '100%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ position: 'absolute', top: '33.33%', left: 0, height: 1, width: '100%', background: 'rgba(255,255,255,0.4)' }} />
                  <div style={{ position: 'absolute', top: '66.66%', left: 0, height: 1, width: '100%', background: 'rgba(255,255,255,0.4)' }} />

                  {(['nw', 'ne', 'sw', 'se'] as const).map((position) => {
                    const positionStyles: Record<string, React.CSSProperties> = {
                      nw: { top: 0, left: 0, cursor: 'nwse-resize' },
                      ne: { top: 0, right: 0, cursor: 'nesw-resize' },
                      sw: { bottom: 0, left: 0, cursor: 'nesw-resize' },
                      se: { bottom: 0, right: 0, cursor: 'nwse-resize' },
                    };
                    return <div key={position} data-crop-handle={position} onPointerDown={(event) => handlePointerDown(position, event)} style={{ position: 'absolute', width: 14, height: 14, background: '#fff', border: '2px solid #2563eb', borderRadius: 2, touchAction: 'none', ...positionStyles[position] }} />;
                  })}

                  {(['n', 's', 'e', 'w'] as const).map((position) => {
                    const positionStyles: Record<string, React.CSSProperties> = {
                      n: { top: 0, left: '50%', marginLeft: -18, width: 36, height: 12, cursor: 'ns-resize' },
                      s: { bottom: 0, left: '50%', marginLeft: -18, width: 36, height: 12, cursor: 'ns-resize' },
                      e: { right: 0, top: '50%', marginTop: -18, width: 12, height: 36, cursor: 'ew-resize' },
                      w: { left: 0, top: '50%', marginTop: -18, width: 12, height: 36, cursor: 'ew-resize' },
                    };
                    return <div key={position} data-crop-handle={position} onPointerDown={(event) => handlePointerDown(position, event)} style={{ position: 'absolute', background: 'rgba(255,255,255,0.9)', border: '1px solid #2563eb', borderRadius: 2, touchAction: 'none', ...positionStyles[position] }} />;
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{file?.name} - {imageBounds.width}x{imageBounds.height} - {file ? formatSize(file.size) : ''}</span>
            <button type="button" onClick={handleRemove} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>Remove</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Aspect Ratio</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                {Object.entries(CROP_ASPECT_PRESETS).map(([key, value]) => (
                  <button key={key} type="button" data-crop-aspect-option={key} onClick={() => handleAspectChange(key as CropAspectPresetKey)} className="btn" aria-pressed={aspectPreset === key} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem', background: aspectPreset === key ? '#2563eb' : '#f3f4f6', color: aspectPreset === key ? '#fff' : '#374151', border: `1px solid ${aspectPreset === key ? '#2563eb' : '#e5e7eb'}`, borderRadius: 6, cursor: 'pointer' }}>
                    {value.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="crop-format" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Format</label>
              <select id="crop-format" data-testid="crop-format" value={format} onChange={(event) => { setFormat(event.target.value as ImageOutputMimeType); clearResult(); }} style={{ padding: '0.375rem', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                {Object.entries(OUTPUT_FORMATS).map(([mimeType, value]) => <option key={mimeType} value={mimeType}>{value.label}</option>)}
              </select>
            </div>
            {format !== 'image/png' && (
              <div>
                <label htmlFor="crop-quality" style={{ fontSize: '0.875rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Quality: {quality}%</label>
                <input id="crop-quality" data-testid="crop-quality" type="range" min="10" max="100" value={quality} onChange={(event) => { setQuality(Number(event.target.value)); clearResult(); }} style={{ width: 120 }} />
              </div>
            )}
            <div data-testid="crop-size" style={{ fontSize: '0.8125rem', color: '#6b7280', marginLeft: 'auto' }}>Crop: {Math.round(cropRect.width)}x{Math.round(cropRect.height)}</div>
          </div>

          <button type="button" className="btn btn-primary" onClick={handleCrop} disabled={processing || cropRect.width < 1 || cropRect.height < 1} style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
            {processing ? 'Cropping...' : 'Crop Image'}
          </button>
        </div>
      )}

      {error && <div className="status status-error">{error}</div>}
      {result && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Result</h3>
          <div className="result-item" data-crop-result={result.name} data-width={result.width} data-height={result.height}>
            <div className="result-info">
              <img src={result.url} alt={result.name} className="result-preview" />
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">{result.width}x{result.height} - {formatSize(result.newSize)}</div>
              </div>
            </div>
            <button type="button" onClick={handleDownload} className="btn btn-primary">Download</button>
          </div>
        </div>
      )}
    </div>
  );
}
