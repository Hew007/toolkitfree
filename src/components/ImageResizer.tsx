import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { mapSettledWithConcurrency } from '../lib/async-pool';
import FileList from './FileList';
import BatchResultsSummary from './BatchResultsSummary';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import { useNumberDraft } from '../hooks/useNumberDraft';
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

interface PreviewResizeDrag {
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  pixelsPerDisplayX: number;
  pixelsPerDisplayY: number;
}

interface PreviewBaseline {
  width: number;
  height: number;
}

const OUTPUT_FORMATS: Record<ImageOutputMimeType, { label: string; extension: string }> = {
  'image/jpeg': { label: 'JPG', extension: 'jpg' },
  'image/png': { label: 'PNG', extension: 'png' },
  'image/webp': { label: 'WebP', extension: 'webp' },
};

/**
 * The named presets are exact platform sizes. Most visitors arrive with a
 * simpler intent — "make it fit 1920" — which in this tool is a custom bounding
 * box with the ratio kept, so these shortcuts set exactly that. The full preset
 * list stays available for anyone who needs a specific platform size.
 */
interface FitShortcut {
  id: string;
  label: string;
  hint: string;
  longestEdge: number;
}

const FIT_SHORTCUTS: readonly FitShortcut[] = [
  { id: 'fit-1920', label: 'Fit 1920 px', hint: 'Web pages and large screens', longestEdge: 1920 },
  { id: 'fit-1280', label: 'Fit 1280 px', hint: 'Blog posts and documents', longestEdge: 1280 },
  { id: 'fit-800', label: 'Fit 800 px', hint: 'Email and chat', longestEdge: 800 },
  { id: 'fit-300', label: 'Fit 300 px', hint: 'Thumbnails and avatars', longestEdge: 300 },
];

/**
 * Resizing needs no submit step: the output size is known the moment the
 * numbers change, so the result follows the controls. A newer change abandons
 * the run in flight rather than queueing behind it.
 */
const RESIZE_DELAY_MS = 320;

export default function ImageResizer({ defaultPreset = 'custom' }: ImageResizerProps) {
  const initialPreset = RESIZE_PRESETS[defaultPreset];
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState<ResizePresetKey>(defaultPreset);
  const [width, setWidth] = useState<number>(initialPreset.width);
  const [height, setHeight] = useState<number>(initialPreset.height);
  const [maintainRatio, setMaintainRatio] = useState(defaultPreset === 'custom');
  const [format, setFormat] = useState<ImageOutputMimeType>('image/jpeg');
  const [quality, setQuality] = useState(92);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState({ width: 0, height: 0 });
  const [previewBaseline, setPreviewBaseline] = useState<PreviewBaseline | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ResizedFile[]>([]);
  const [failures, setFailures] = useState<ResizeFailure[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const objectUrls = useObjectUrlRegistry();
  const previewDragRef = useRef<PreviewResizeDrag | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const firstFile = files[0];
    if (!firstFile) {
      objectUrls.revoke('resizer:preview');
      setPreviewUrl(null);
      setPreviewSource({ width: 0, height: 0 });
      setPreviewBaseline(null);
      return;
    }
    setPreviewBaseline(null);
    setPreviewUrl(objectUrls.replace('resizer:preview', firstFile));
  }, [files, objectUrls]);

  const clearResults = useCallback(() => {
    objectUrls.revokePrefix('resizer:result:');
    setResults([]);
    setFailures([]);
  }, [objectUrls]);

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      setFiles((current) => [...current, ...newFiles]);
      clearResults();
    },
    [clearResults]
  );

  const handleRemove = useCallback(
    (index: number) => {
      setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
      clearResults();
    },
    [clearResults]
  );

  const handleFitShortcut = (shortcut: FitShortcut) => {
    setPreset('custom');
    setWidth(shortcut.longestEdge);
    setHeight(shortcut.longestEdge);
    setMaintainRatio(true);
    clearResults();
  };

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

  const widthProps = useNumberDraft({
    value: width,
    min: 1,
    max: 10000,
    onCommit: handleWidthChange,
  });
  const heightProps = useNumberDraft({
    value: height,
    min: 1,
    max: 10000,
    onCommit: handleHeightChange,
  });

  const previewDimensions = useMemo(() => {
    if (previewSource.width < 1 || previewSource.height < 1 || width < 1 || height < 1) return null;
    return calculateResizeDimensions(
      previewSource,
      { width, height },
      preset === 'custom' && maintainRatio
    );
  }, [height, maintainRatio, preset, previewSource, width]);
  const displayedPreviewDimensions = previewDimensions ?? {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
  const previewDisplayScale = previewBaseline
    ? Math.min(320 / previewBaseline.width, 260 / previewBaseline.height)
    : 1;
  const previewMinimumScale = Math.max(
    96 / displayedPreviewDimensions.width,
    72 / displayedPreviewDimensions.height
  );
  const previewMaximumScale = Math.min(
    960 / displayedPreviewDimensions.width,
    760 / displayedPreviewDimensions.height
  );
  const constrainedPreviewScale = Math.min(
    previewMaximumScale,
    Math.max(previewMinimumScale, previewDisplayScale)
  );
  const previewFrameDimensions = {
    width: displayedPreviewDimensions.width * constrainedPreviewScale,
    height: displayedPreviewDimensions.height * constrainedPreviewScale,
  };

  const handlePreviewResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    const frame = event.currentTarget.closest<HTMLElement>('.resizer-preview-frame');
    if (!frame || width < 1 || height < 1) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = frame.getBoundingClientRect();
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: width,
      startHeight: height,
      pixelsPerDisplayX: width / Math.max(bounds.width, 1),
      pixelsPerDisplayY: height / Math.max(bounds.height, 1),
    };
  };

  const handlePreviewResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    let nextWidth = drag.startWidth + deltaX * drag.pixelsPerDisplayX;
    let nextHeight = drag.startHeight + deltaY * drag.pixelsPerDisplayY;

    if (maintainRatio) {
      const useHorizontal = Math.abs(deltaX) >= Math.abs(deltaY);
      const scale = useHorizontal ? nextWidth / drag.startWidth : nextHeight / drag.startHeight;
      nextWidth = drag.startWidth * scale;
      nextHeight = drag.startHeight * scale;
    }

    setWidth(Math.min(10000, Math.max(1, Math.round(nextWidth))));
    setHeight(Math.min(10000, Math.max(1, Math.round(nextHeight))));
    setPreset('custom');
    clearResults();
  };

  const finishPreviewResize = () => {
    previewDragRef.current = null;
  };

  const resizeImage = useCallback(
    async (file: File, index: number): Promise<ResizedFile> => {
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

      const blob = await exportCanvas(
        canvas,
        format,
        format === 'image/png' ? undefined : quality / 100
      );
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
    },
    [format, height, maintainRatio, objectUrls, preset, quality, width]
  );

  /** Any change here invalidates the results on screen. */
  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        files: files.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
        width,
        height,
        maintainRatio,
        preset,
        format,
        quality,
      }),
    [files, format, height, maintainRatio, preset, quality, width]
  );

  // No submit step: the result follows the controls, debounced, and a newer
  // change abandons the run in flight instead of queueing behind it.
  useEffect(() => {
    runIdRef.current += 1;
    objectUrls.revokePrefix('resizer:result:');
    setResults([]);
    setFailures([]);
    setElapsedMs(null);

    if (files.length === 0 || width < 1 || height < 1) {
      setProcessing(false);
      return;
    }

    const runId = runIdRef.current;
    const queued = files;

    const timer = setTimeout(() => {
      void (async () => {
        setProcessing(true);
        const startedAt = performance.now();
        const settled = await mapSettledWithConcurrency(queued, 2, resizeImage);
        if (runIdRef.current !== runId) return;

        const nextResults: ResizedFile[] = [];
        const nextFailures: ResizeFailure[] = [];
        settled.forEach((outcome, index) => {
          if (outcome.status === 'fulfilled') {
            nextResults.push(outcome.value);
          } else {
            nextFailures.push({
              sourceId: `file-${index}`,
              name: queued[index].name,
              message: getImageProcessingErrorMessage(outcome.reason),
            });
          }
        });
        setResults(nextResults);
        setFailures(nextFailures);
        setElapsedMs(Math.round(performance.now() - startedAt));
        setProcessing(false);
      })();
    }, RESIZE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [settingsKey, files, width, height, objectUrls, resizeImage]);

  return (
    <div data-resizer-preset={preset} aria-busy={processing}>
      {processing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Resizing images.
        </div>
      )}
      <FileUploader
        accept="image/jpeg,image/png,image/webp"
        multiple={true}
        budgetProfile="resizer"
        currentFiles={files}
        compact={files.length > 0}
        onFilesSelected={handleFiles}
      />
      <FileList files={files} onRemove={handleRemove} />

      {files.length > 0 && (
        <div className="resizer-workspace">
          <section className="resizer-preview-panel" aria-label="Live resize preview">
            <div className="resizer-preview-heading">
              <div>
                <strong>Live preview</strong>
                <span>{files[0]?.name}</span>
              </div>
              {previewDimensions && (
                <output data-testid="resize-preview-size">
                  {previewDimensions.width} × {previewDimensions.height}px
                </output>
              )}
            </div>
            <div className="resizer-preview-stage">
              {previewUrl && (
                <div
                  className="resizer-preview-frame"
                  data-testid="resize-live-preview"
                  style={{
                    width: `${previewFrameDimensions.width}px`,
                    height: `${previewFrameDimensions.height}px`,
                  }}
                >
                  <img
                    src={previewUrl}
                    alt={`Preview of ${files[0]?.name} at the selected dimensions`}
                    draggable={false}
                    onLoad={(event) => {
                      const source = {
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      };
                      const baseline = calculateResizeDimensions(
                        source,
                        { width, height },
                        preset === 'custom' && maintainRatio
                      );
                      setPreviewSource(source);
                      setPreviewBaseline(baseline);
                    }}
                  />
                  <button
                    type="button"
                    className="resizer-preview-handle"
                    aria-label="Drag to change output dimensions"
                    onPointerDown={handlePreviewResizeStart}
                    onPointerMove={handlePreviewResizeMove}
                    onPointerUp={finishPreviewResize}
                    onPointerCancel={finishPreviewResize}
                  />
                </div>
              )}
            </div>
            <p>Drag the lower-right handle or enter exact pixel values.</p>
          </section>

          <div className="resizer-controls-panel">
            <div className="tool-chip-group">
              <p className="tool-chip-help">
                Common sizes. Each one keeps the aspect ratio and fits the image inside the value.
              </p>
              <div className="tool-chip-row">
                {FIT_SHORTCUTS.map((shortcut) => {
                  const active =
                    preset === 'custom' &&
                    maintainRatio &&
                    width === shortcut.longestEdge &&
                    height === shortcut.longestEdge;
                  return (
                    <button
                      type="button"
                      key={shortcut.id}
                      className={`tool-chip${active ? ' is-selected' : ''}`}
                      aria-pressed={active}
                      onClick={() => handleFitShortcut(shortcut)}
                    >
                      <span className="tool-chip-label">{shortcut.label}</span>
                      <span className="tool-chip-hint">{shortcut.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="resizer-size-fields">
              <div>
                <label htmlFor="resize-preset">Platform size</label>
                <select
                  id="resize-preset"
                  data-testid="resize-preset"
                  value={preset}
                  onChange={(event) => handlePresetChange(event.target.value as ResizePresetKey)}
                >
                  {Object.entries(RESIZE_PRESETS).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="resize-width">
                  {preset === 'custom' && maintainRatio ? 'Max width (px)' : 'Width (px)'}
                </label>
                <input
                  className="field-input"
                  id="resize-width"
                  data-testid="resize-width"
                  type="number"
                  min={1}
                  max={10000}
                  {...widthProps}
                />
              </div>
              <div>
                <label htmlFor="resize-height">
                  {preset === 'custom' && maintainRatio ? 'Max height (px)' : 'Height (px)'}
                </label>
                <input
                  className="field-input"
                  id="resize-height"
                  data-testid="resize-height"
                  type="number"
                  min={1}
                  max={10000}
                  {...heightProps}
                />
              </div>
            </div>

            <div className="resizer-ratio-field">
              <label>
                <input
                  data-testid="resize-maintain-ratio"
                  type="checkbox"
                  checked={maintainRatio}
                  disabled={preset !== 'custom'}
                  onChange={(event) => {
                    setMaintainRatio(event.target.checked);
                    clearResults();
                  }}
                />{' '}
                Maintain aspect ratio
              </label>
              <p className="tool-hint">
                {preset === 'custom' && maintainRatio
                  ? 'Each image fits inside the maximum width and height without stretching.'
                  : preset === 'custom'
                    ? 'The exact width and height are used; the image may be stretched.'
                    : 'Platform presets use their exact width and height.'}
              </p>
            </div>

            <details className="fine-tune">
              <summary>
                <span>Fine-tune</span>
                <span className="fine-tune-summary">
                  {OUTPUT_FORMATS[format].label}
                  {format === 'image/png' ? '' : ` · quality ${quality}%`}
                </span>
              </summary>
              <div className="fine-tune-body">
                <div className="fine-tune-field">
                  <label htmlFor="resize-format">Output format</label>
                  <select
                    id="resize-format"
                    data-testid="resize-format"
                    value={format}
                    onChange={(event) => {
                      setFormat(event.target.value as ImageOutputMimeType);
                      clearResults();
                    }}
                  >
                    {Object.entries(OUTPUT_FORMATS).map(([mimeType, value]) => (
                      <option key={mimeType} value={mimeType}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="fine-tune-field"
                  hidden={format === 'image/png'}
                  aria-hidden={format === 'image/png'}
                >
                  <label htmlFor="resize-quality">Quality: {quality}%</label>
                  <input
                    id="resize-quality"
                    data-testid="resize-quality"
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(event) => {
                      setQuality(Number(event.target.value));
                      clearResults();
                    }}
                  />
                  <p className="tool-hint">PNG is lossless, so quality does not apply to it.</p>
                </div>
              </div>
            </details>

            <p className="tool-run-note">
              <span className={`run-dot${processing ? ' is-busy' : ''}`} aria-hidden="true" />
              {processing
                ? 'Resizing in your browser…'
                : elapsedMs !== null
                  ? `Resized in your browser in ${(elapsedMs / 1000).toFixed(1)}s. Nothing was uploaded.`
                  : 'Results follow the settings above. Nothing is uploaded.'}
            </p>
          </div>
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
            <div
              key={result.url}
              className="result-item"
              data-resize-result={result.name}
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
              <a href={result.url} download={result.name} className="btn btn-primary">
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
