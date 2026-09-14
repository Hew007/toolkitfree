import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import FineTune, { FineTuneField } from './FineTune';
import ToolRunNote from './ToolRunNote';
import { useAutoRun } from '../hooks/useAutoRun';
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
const EMPTY_DISPLAY = { width: 0, height: 0 };

/**
 * The shape chips are a projection of the preset table, never a second copy of
 * it, so a label cannot drift away from the ratio it names. This is the control
 * that was already here, moved onto the shared chip so it wraps on a phone and
 * keeps a 44px target; the tool gains no new question it did not already ask.
 */
const ASPECT_CHOICES: readonly ToolChoice<CropAspectPresetKey>[] = (
  Object.keys(CROP_ASPECT_PRESETS) as CropAspectPresetKey[]
).map((key) => ({ id: key, label: CROP_ASPECT_PRESETS[key].label }));

/**
 * Cropping needs no submit step: the crop box *is* the input, so the result
 * follows it. The delay is what keeps a drag smooth — pointer moves land dozens
 * of times a second and each one only invalidates the stale result, while the
 * export waits until the box has been still this long. The key is built from the
 * rounded pixel rect, so a sub-pixel nudge that lands on the same pixels does
 * not re-encode anything.
 */
const CROP_DELAY_MS = 320;

export default function ImageCropper({ defaultAspectPreset = 'free' }: ImageCropperProps) {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBounds, setImageBounds] = useState<CropBounds>(EMPTY_BOUNDS);
  const [aspectPreset, setAspectPreset] = useState<CropAspectPresetKey>(defaultAspectPreset);
  const [cropRect, setCropRect] = useState<CropRect>(EMPTY_CROP);
  const [displayScale, setDisplayScale] = useState(1);
  const [baseDisplaySize, setBaseDisplaySize] = useState(EMPTY_DISPLAY);
  const [zoom, setZoom] = useState(100);
  const [format, setFormat] = useState<ImageOutputMimeType>('image/png');
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CropResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const cleanupDragRef = useRef<(() => void) | null>(null);
  // Decoding a photo costs far more than drawing one region of it, and with the
  // result following the crop box that decode would otherwise repeat after every
  // drag. One decode per file, reused by every run on that file.
  const decodedRef = useRef<{ file: File; image: HTMLImageElement } | null>(null);
  const objectUrls = useObjectUrlRegistry();
  const aspectRatio = CROP_ASPECT_PRESETS[aspectPreset].ratio;

  const clearResult = useCallback(() => {
    objectUrls.revoke('cropper:result');
    setResult(null);
    setElapsedMs(null);
  }, [objectUrls]);

  const decodeSource = useCallback(async (source: File): Promise<HTMLImageElement> => {
    const cached = decodedRef.current;
    if (cached && cached.file === source) return cached.image;
    const image = await loadImage(source);
    decodedRef.current = { file: source, image };
    return image;
  }, []);

  const updateDisplayScale = useCallback(() => {
    const image = imageRef.current;
    if (!image?.naturalWidth) return;
    setDisplayScale(image.getBoundingClientRect().width / image.naturalWidth || 1);
  }, []);

  const measureBaseDisplay = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;
    const bounds = image.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    setBaseDisplaySize({ width: bounds.width, height: bounds.height });
    setDisplayScale(bounds.width / image.naturalWidth || 1);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setBaseDisplaySize(EMPTY_DISPLAY);
      window.requestAnimationFrame(measureBaseDisplay);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupDragRef.current?.();
    };
  }, [measureBaseDisplay]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateDisplayScale);
    return () => window.cancelAnimationFrame(frame);
  }, [updateDisplayScale, zoom]);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      const nextFile = newFiles[0];
      if (!nextFile) return;
      try {
        validateImageFile(nextFile);
        clearResult();
        decodedRef.current = null;
        setFile(nextFile);
        setImageBounds(EMPTY_BOUNDS);
        setCropRect(EMPTY_CROP);
        setBaseDisplaySize(EMPTY_DISPLAY);
        setZoom(100);
        setImageUrl(objectUrls.replace('cropper:preview', nextFile));
        setError(null);
      } catch (fileError) {
        setError(getImageProcessingErrorMessage(fileError));
      }
    },
    [clearResult, objectUrls]
  );

  const handleRemove = useCallback(() => {
    cleanupDragRef.current?.();
    objectUrls.revoke('cropper:preview');
    clearResult();
    decodedRef.current = null;
    setFile(null);
    setImageUrl(null);
    setImageBounds(EMPTY_BOUNDS);
    setCropRect(EMPTY_CROP);
    setBaseDisplaySize(EMPTY_DISPLAY);
    setZoom(100);
    setError(null);
  }, [clearResult, objectUrls]);

  const handleImageLoad = useCallback(() => {
    const image = imageRef.current;
    if (!image) return;
    const bounds = { width: image.naturalWidth, height: image.naturalHeight };
    setImageBounds(bounds);
    setCropRect(createInitialCropRect(bounds, aspectRatio));
    window.requestAnimationFrame(measureBaseDisplay);
  }, [aspectRatio, measureBaseDisplay]);

  const handleAspectChange = (nextPreset: CropAspectPresetKey) => {
    setAspectPreset(nextPreset);
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
      const nextRect =
        drag.handle === 'move'
          ? moveCropRect(drag.startRect, dx, dy, imageBounds)
          : resizeCropRect(drag.startRect, drag.handle, dx, dy, imageBounds, aspectRatio);
      // Only the rect moves here. Dropping the stale result and scheduling the
      // next export both belong to the auto-run, which does the first once and
      // the second no sooner than `CROP_DELAY_MS` after the pointer settles.
      setCropRect(nextRect);
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

  const handleCropKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    if (event.key === 'ArrowRight') dx = step;
    if (event.key === 'ArrowUp') dy = -step;
    if (event.key === 'ArrowDown') dy = step;
    if (dx === 0 && dy === 0) return;

    event.preventDefault();
    setCropRect((current) =>
      event.altKey
        ? resizeCropRect(current, 'se', dx, dy, imageBounds, aspectRatio)
        : moveCropRect(current, dx, dy, imageBounds)
    );
  };

  /**
   * The crop the output will actually have. Rounded to whole pixels on purpose:
   * this is what `run` draws, so keying off it means a drag that ends on the same
   * pixel row does not re-encode, and a re-measured preview never does either.
   */
  const pixelCrop = useMemo(() => {
    if (imageBounds.width < 1 || imageBounds.height < 1) return null;
    if (cropRect.width < 1 || cropRect.height < 1) return null;
    return toPixelCropRect(cropRect, imageBounds);
  }, [cropRect, imageBounds]);

  /**
   * Everything the cropped file depends on, and nothing else. Zoom, display
   * scale and the measured frame are absent because they change how the crop box
   * is drawn, not what comes out of it; the aspect preset is absent because it
   * only reaches the output through the rect it produced.
   */
  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        file: file ? `${file.name}:${file.size}:${file.lastModified}` : null,
        crop: pixelCrop,
        format,
        quality: format === 'image/png' ? null : quality,
      }),
    [file, format, pixelCrop, quality]
  );

  // No submit step: the result follows the crop box.
  useAutoRun({
    key: settingsKey,
    enabled: Boolean(file) && pixelCrop !== null,
    delayMs: CROP_DELAY_MS,
    onInvalidate: () => {
      objectUrls.revoke('cropper:result');
      // Written as bail-outs because this fires on every pointer move of a drag:
      // passing the value React already holds ends the update there, so dragging
      // costs one render per move rather than two.
      setResult((current) => (current === null ? current : null));
      setElapsedMs((current) => (current === null ? current : null));
      setError((current) => (current === null ? current : null));
      setProcessing((current) => (current ? false : current));
    },
    run: async (isCurrent) => {
      const source = file;
      const crop = pixelCrop;
      if (!source || !crop) return;
      setProcessing(true);
      const startedAt = performance.now();

      try {
        const image = await decodeSource(source);
        if (!isCurrent()) return;

        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        const context = getCanvas2dContext(canvas);
        if (format === 'image/jpeg') {
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

        const blob = await exportCanvas(
          canvas,
          format,
          format === 'image/png' ? undefined : quality / 100
        );
        if (!isCurrent()) return;

        const baseName = source.name.replace(/\.[^.]+$/, '') || 'cropped-image';
        const outputName = `${baseName}-cropped.${OUTPUT_FORMATS[format].extension}`;
        const url = objectUrls.replace('cropper:result', blob);
        setResult({
          name: outputName,
          newSize: blob.size,
          width: canvas.width,
          height: canvas.height,
          url,
        });
        setElapsedMs(Math.round(performance.now() - startedAt));
        setProcessing(false);
      } catch (cropError) {
        if (!isCurrent()) return;
        setError(getImageProcessingErrorMessage(cropError));
        setProcessing(false);
      }
    },
  });

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
    <div data-crop-aspect={aspectPreset} aria-busy={processing}>
      {!imageUrl ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          budgetProfile="cropper"
          onFilesSelected={handleFiles}
        />
      ) : (
        <div className="cropper-workspace">
          <div className="cropper-preview-column">
            <div className="cropper-preview-scroll">
              <div
                className={`cropper-preview-frame${baseDisplaySize.width > 0 ? ' is-zoomable' : ''}`}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width:
                    baseDisplaySize.width > 0
                      ? `${baseDisplaySize.width * (zoom / 100)}px`
                      : undefined,
                  height:
                    baseDisplaySize.height > 0
                      ? `${baseDisplaySize.height * (zoom / 100)}px`
                      : undefined,
                  userSelect: 'none',
                  touchAction: 'none',
                }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  onLoad={handleImageLoad}
                  alt="Crop preview"
                  className="cropper-preview-image"
                  style={baseDisplaySize.width > 0 ? { width: '100%', height: '100%' } : undefined}
                  draggable={false}
                />
                {cropRect.width > 0 && (
                  <div style={{ position: 'absolute', inset: 0 }}>
                    <svg
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                      }}
                      aria-hidden="true"
                    >
                      <defs>
                        <mask id="crop-mask">
                          <rect width="100%" height="100%" fill="white" />
                          <rect
                            x={scaled.left}
                            y={scaled.top}
                            width={scaled.width}
                            height={scaled.height}
                            fill="black"
                          />
                        </mask>
                      </defs>
                      <rect
                        width="100%"
                        height="100%"
                        fill="rgba(0,0,0,0.5)"
                        mask="url(#crop-mask)"
                      />
                    </svg>

                    {/* The 2D crop region is intentionally keyboard focusable as one composite control. */}
                    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                    <div
                      data-testid="crop-box"
                      role="group"
                      tabIndex={0}
                      aria-label="Crop selection"
                      aria-describedby="crop-keyboard-instructions"
                      onKeyDown={handleCropKeyDown}
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
                      <div
                        style={{
                          position: 'absolute',
                          left: '33.33%',
                          top: 0,
                          width: 1,
                          height: '100%',
                          background: 'rgba(255,255,255,0.4)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: '66.66%',
                          top: 0,
                          width: 1,
                          height: '100%',
                          background: 'rgba(255,255,255,0.4)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '33.33%',
                          left: 0,
                          height: 1,
                          width: '100%',
                          background: 'rgba(255,255,255,0.4)',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '66.66%',
                          left: 0,
                          height: 1,
                          width: '100%',
                          background: 'rgba(255,255,255,0.4)',
                        }}
                      />

                      {(['nw', 'ne', 'sw', 'se'] as const).map((position) => {
                        const positionStyles: Record<string, React.CSSProperties> = {
                          nw: { top: 0, left: 0, cursor: 'nwse-resize' },
                          ne: { top: 0, right: 0, cursor: 'nesw-resize' },
                          sw: { bottom: 0, left: 0, cursor: 'nesw-resize' },
                          se: { bottom: 0, right: 0, cursor: 'nwse-resize' },
                        };
                        return (
                          <div
                            key={position}
                            data-crop-handle={position}
                            aria-hidden="true"
                            onPointerDown={(event) => handlePointerDown(position, event)}
                            style={{
                              position: 'absolute',
                              width: 14,
                              height: 14,
                              background: '#fff',
                              border: '2px solid #2563eb',
                              borderRadius: 2,
                              touchAction: 'none',
                              ...positionStyles[position],
                            }}
                          />
                        );
                      })}

                      {(['n', 's', 'e', 'w'] as const).map((position) => {
                        const positionStyles: Record<string, React.CSSProperties> = {
                          n: {
                            top: 0,
                            left: '50%',
                            marginLeft: -18,
                            width: 36,
                            height: 12,
                            cursor: 'ns-resize',
                          },
                          s: {
                            bottom: 0,
                            left: '50%',
                            marginLeft: -18,
                            width: 36,
                            height: 12,
                            cursor: 'ns-resize',
                          },
                          e: {
                            right: 0,
                            top: '50%',
                            marginTop: -18,
                            width: 12,
                            height: 36,
                            cursor: 'ew-resize',
                          },
                          w: {
                            left: 0,
                            top: '50%',
                            marginTop: -18,
                            width: 12,
                            height: 36,
                            cursor: 'ew-resize',
                          },
                        };
                        return (
                          <div
                            key={position}
                            data-crop-handle={position}
                            aria-hidden="true"
                            onPointerDown={(event) => handlePointerDown(position, event)}
                            style={{
                              position: 'absolute',
                              background: 'rgba(255,255,255,0.9)',
                              border: '1px solid #2563eb',
                              borderRadius: 2,
                              touchAction: 'none',
                              ...positionStyles[position],
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="cropper-controls-panel">
            <p id="crop-keyboard-instructions" className="tool-hint">
              Arrow keys move the crop. Hold Alt + arrows to resize; Shift uses larger steps.
            </p>

            <div
              className="cropper-file-summary"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span style={{ fontSize: '0.875rem', color: '#6b665c' }}>
                {file?.name} - {imageBounds.width}x{imageBounds.height} -{' '}
                {file ? formatSize(file.size) : ''}
              </span>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Remove
              </button>
            </div>

            <ToolChoices
              name="cropper-aspect"
              legend="Crop shape"
              help="The crop box takes this shape. Drag or nudge it to choose the area — the file below follows it."
              choices={ASPECT_CHOICES}
              value={aspectPreset}
              onChange={(choice) => handleAspectChange(choice.id)}
            />

            <div data-testid="crop-size" style={{ fontSize: '0.8125rem', color: '#6b665c' }}>
              Crop: {pixelCrop ? `${pixelCrop.width}x${pixelCrop.height}` : '0x0'}
            </div>

            <div>
              <label
                htmlFor="crop-zoom"
                style={{
                  display: 'block',
                  marginBottom: '0.35rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Preview zoom
              </label>
              <div className="cropper-zoom-control">
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label="Zoom out"
                  disabled={zoom <= 100}
                  onClick={() => setZoom((current) => Math.max(100, current - 10))}
                >
                  Out
                </button>
                <input
                  id="crop-zoom"
                  data-testid="crop-zoom"
                  type="range"
                  min="100"
                  max="200"
                  step="10"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label="Zoom in"
                  onClick={() => setZoom((current) => Math.min(200, current + 10))}
                >
                  In
                </button>
                <output htmlFor="crop-zoom">{zoom}%</output>
              </div>
            </div>

            <FineTune
              summary={
                <>
                  {OUTPUT_FORMATS[format].label}
                  {format === 'image/png' ? '' : ` · quality ${quality}%`}
                </>
              }
            >
              <FineTuneField htmlFor="crop-format" label="Output format">
                <select
                  id="crop-format"
                  data-testid="crop-format"
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
                htmlFor="crop-quality"
                label={`Quality: ${quality}%`}
                hint="PNG is lossless, so quality does not apply to it."
                hidden={format === 'image/png'}
              >
                <input
                  id="crop-quality"
                  data-testid="crop-quality"
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
                ? 'Cropping in your browser…'
                : elapsedMs !== null
                  ? `Cropped in your browser in ${(elapsedMs / 1000).toFixed(1)}s. Nothing was uploaded.`
                  : 'The cropped file follows the crop box above. Nothing is uploaded.'}
            </ToolRunNote>
          </div>
        </div>
      )}

      {processing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Cropping image.
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
          <div
            className="result-item"
            data-crop-result={result.name}
            data-width={result.width}
            data-height={result.height}
          >
            <div className="result-info">
              <img src={result.url} alt={result.name} className="result-preview" />
              <div>
                <div className="file-item-name">{result.name}</div>
                <div className="file-item-size">
                  {result.width}x{result.height} - {formatSize(result.newSize)}
                </div>
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
