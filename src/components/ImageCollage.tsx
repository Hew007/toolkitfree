import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  calculateCollageLayout,
  DEFAULT_COLLAGE_OPTIONS,
  getCollageFilename,
  recommendCollageCellSize,
  type CollageFitMode,
  type CollageLayout,
  type CollageLayoutMode,
  type CollageOptions,
  type CollagePlacement,
} from '../lib/image-collage';
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

interface CollageItem {
  id: string;
  file: File;
  image: HTMLImageElement;
}

type LayoutChoice = 'auto-grid' | 'columns' | 'horizontal' | 'vertical';

function roundedClip(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const nextRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
  context.closePath();
  context.clip();
}

function drawPlacement(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: CollagePlacement,
  radius: number
): void {
  context.save();
  if (radius > 0) {
    roundedClip(
      context,
      placement.tile.x,
      placement.tile.y,
      placement.tile.width,
      placement.tile.height,
      radius
    );
  }
  context.drawImage(
    image,
    placement.source.x,
    placement.source.y,
    placement.source.width,
    placement.source.height,
    placement.draw.x,
    placement.draw.y,
    placement.draw.width,
    placement.draw.height
  );
  context.restore();
}

function renderCollage(
  canvas: HTMLCanvasElement,
  items: readonly CollageItem[],
  options: CollageOptions
) {
  const layout = calculateCollageLayout(
    items.map((item) => ({ width: item.image.naturalWidth, height: item.image.naturalHeight })),
    options
  );
  validateImageDimensions(layout.width, layout.height);
  canvas.width = layout.width;
  canvas.height = layout.height;

  const context = getCanvas2dContext(canvas);
  context.clearRect(0, 0, layout.width, layout.height);
  context.fillStyle = options.background;
  context.fillRect(0, 0, layout.width, layout.height);

  for (const placement of layout.placements) {
    drawPlacement(context, items[placement.sourceIndex].image, placement, options.borderRadius);
  }
  return layout;
}

function drawDragFeedback(
  canvas: HTMLCanvasElement,
  layout: CollageLayout,
  sourceIndex: number,
  targetIndex: number | null
): void {
  const context = getCanvas2dContext(canvas);
  const lineWidth = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) / 120));

  const highlight = (index: number, fill: string, dashed: boolean) => {
    const placement = layout.placements.find((candidate) => candidate.sourceIndex === index);
    if (!placement) return;
    const inset = lineWidth / 2;
    context.save();
    context.fillStyle = fill;
    context.fillRect(
      placement.tile.x,
      placement.tile.y,
      placement.tile.width,
      placement.tile.height
    );
    context.strokeStyle = '#2563eb';
    context.lineWidth = lineWidth;
    if (dashed) context.setLineDash([lineWidth * 2, lineWidth * 1.5]);
    context.strokeRect(
      placement.tile.x + inset,
      placement.tile.y + inset,
      placement.tile.width - lineWidth,
      placement.tile.height - lineWidth
    );
    context.restore();
  };

  highlight(sourceIndex, 'rgb(37 99 235 / 12%)', true);
  if (targetIndex !== null && targetIndex !== sourceIndex) {
    highlight(targetIndex, 'rgb(37 99 235 / 22%)', false);
  }
}

function NumberControl({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="collage-field">
      {label}
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const layoutChoices: readonly {
  value: LayoutChoice;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: 'auto-grid',
    label: 'Auto',
    description: 'Best grid for your image count',
    icon: '▦',
  },
  {
    value: 'columns',
    label: 'Grid',
    description: 'Choose the number of columns',
    icon: '▥',
  },
  {
    value: 'horizontal',
    label: 'Side by side',
    description: 'Place images from left to right',
    icon: '▤',
  },
  {
    value: 'vertical',
    label: 'Vertical stitch',
    description: 'Stack screenshots top to bottom',
    icon: '▧',
  },
];

export default function ImageCollage() {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>('auto-grid');
  const [columns, setColumns] = useState(2);
  const [fit, setFit] = useState<CollageFitMode>('contain');
  const [cellWidth, setCellWidth] = useState(DEFAULT_COLLAGE_OPTIONS.cellWidth);
  const [cellHeight, setCellHeight] = useState(DEFAULT_COLLAGE_OPTIONS.cellHeight);
  const [gap, setGap] = useState(DEFAULT_COLLAGE_OPTIONS.gap);
  const [margin, setMargin] = useState(DEFAULT_COLLAGE_OPTIONS.margin);
  const [borderRadius, setBorderRadius] = useState(DEFAULT_COLLAGE_OPTIONS.borderRadius);
  const [background, setBackground] = useState(DEFAULT_COLLAGE_OPTIONS.background);
  const [format, setFormat] = useState<ImageOutputMimeType>('image/png');
  const [quality, setQuality] = useState(92);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutSummary, setLayoutSummary] = useState('');
  const [previewDraggedId, setPreviewDraggedId] = useState<string | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const [sortAnnouncement, setSortAnnouncement] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const loadIdRef = useRef(0);
  const itemIdRef = useRef(0);
  const previewLayoutRef = useRef<CollageLayout | null>(null);
  const previewDraggedIdRef = useRef<string | null>(null);
  const previewTargetIdRef = useRef<string | null>(null);
  const previewDraggedNameRef = useRef('');
  const urls = useObjectUrlRegistry();

  const layoutMode: CollageLayoutMode =
    layoutChoice === 'horizontal'
      ? 'horizontal'
      : layoutChoice === 'vertical'
        ? 'vertical'
        : 'grid';

  const collageOptions = useMemo<CollageOptions>(
    () => ({
      layout: layoutMode,
      fit,
      columns: layoutChoice === 'columns' ? columns : undefined,
      gap,
      margin,
      cellWidth,
      cellHeight,
      borderRadius,
      background,
    }),
    [
      background,
      borderRadius,
      cellHeight,
      cellWidth,
      columns,
      fit,
      gap,
      layoutChoice,
      layoutMode,
      margin,
    ]
  );

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      if (newFiles.length === 0) return;
      const loadId = ++loadIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const loaded = await Promise.all(
          newFiles.map(async (file) => ({
            id: `collage-${Date.now()}-${itemIdRef.current++}`,
            file,
            image: await loadImage(file),
          }))
        );
        if (loadId !== loadIdRef.current) return;
        if (items.length === 0) {
          const recommendedSize = recommendCollageCellSize(
            loaded.map((item) => ({
              width: item.image.naturalWidth,
              height: item.image.naturalHeight,
            }))
          );
          setCellWidth(recommendedSize.width);
          setCellHeight(recommendedSize.height);
        }
        setItems((current) => [...current, ...loaded]);
      } catch (cause) {
        if (loadId === loadIdRef.current) setError(getImageProcessingErrorMessage(cause));
      } finally {
        if (loadId === loadIdRef.current) setLoading(false);
      }
    },
    [items.length]
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const getPreviewItemId = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget;
      const layout = previewLayoutRef.current;
      const bounds = canvas.getBoundingClientRect();
      if (!layout || bounds.width === 0 || bounds.height === 0) return null;
      const x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
      const y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
      const placement = layout.placements.find(
        ({ tile }) =>
          x >= tile.x && x <= tile.x + tile.width && y >= tile.y && y <= tile.y + tile.height
      );
      return placement ? (items[placement.sourceIndex]?.id ?? null) : null;
    },
    [items]
  );

  const startPreviewDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!event.isPrimary || event.button !== 0) return;
      const sourceId = getPreviewItemId(event);
      if (!sourceId) return;
      const source = items.find((item) => item.id === sourceId);
      if (!source) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      previewDraggedIdRef.current = sourceId;
      previewTargetIdRef.current = sourceId;
      previewDraggedNameRef.current = source.file.name;
      setPreviewDraggedId(sourceId);
      setPreviewTargetId(sourceId);
      setSortAnnouncement('');
    },
    [getPreviewItemId, items]
  );

  const movePreviewDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!previewDraggedIdRef.current) return;
      event.preventDefault();
      const targetId = getPreviewItemId(event);
      previewTargetIdRef.current = targetId;
      setPreviewTargetId(targetId);
    },
    [getPreviewItemId]
  );

  const resetPreviewDrag = useCallback(() => {
    previewDraggedIdRef.current = null;
    previewTargetIdRef.current = null;
    previewDraggedNameRef.current = '';
    setPreviewDraggedId(null);
    setPreviewTargetId(null);
  }, []);

  const finishPreviewDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const sourceId = previewDraggedIdRef.current;
      const targetId = previewTargetIdRef.current;
      if (!sourceId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (targetId && targetId !== sourceId) {
        const targetPosition = items.findIndex((item) => item.id === targetId) + 1;
        setItems((current) => {
          const sourceIndex = current.findIndex((item) => item.id === sourceId);
          const targetIndex = current.findIndex((item) => item.id === targetId);
          if (sourceIndex < 0 || targetIndex < 0) return current;
          const next = [...current];
          [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
          return next;
        });
        if (targetPosition > 0) {
          setSortAnnouncement(
            `${previewDraggedNameRef.current} moved to position ${targetPosition}.`
          );
        }
      }
      resetPreviewDrag();
    },
    [items, resetPreviewDrag]
  );

  const cancelPreviewDrag = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      resetPreviewDrag();
    },
    [resetPreviewDrag]
  );

  const clearAll = useCallback(() => {
    loadIdRef.current += 1;
    setItems([]);
    setError(null);
    setLayoutSummary('');
    previewLayoutRef.current = null;
    resetPreviewDrag();
    setSortAnnouncement('');
    urls.revokePrefix('collage-');
  }, [resetPreviewDrag, urls]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (items.length === 0) return;
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const layout = renderCollage(canvas, items, collageOptions);
        previewLayoutRef.current = layout;
        if (previewDraggedId) {
          const sourceIndex = items.findIndex((item) => item.id === previewDraggedId);
          const targetIndex = previewTargetId
            ? items.findIndex((item) => item.id === previewTargetId)
            : -1;
          if (sourceIndex >= 0) {
            drawDragFeedback(canvas, layout, sourceIndex, targetIndex >= 0 ? targetIndex : null);
          }
        }
        setLayoutSummary(`${layout.width} × ${layout.height}px output`);
        setError(null);
      } catch (cause) {
        setError(getImageProcessingErrorMessage(cause));
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [collageOptions, items, previewDraggedId, previewTargetId]);

  const handleDownload = useCallback(async () => {
    if (items.length === 0) return;
    setDownloading(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      renderCollage(canvas, items, collageOptions);
      const blob = await exportCanvas(
        canvas,
        format,
        format === 'image/png' ? undefined : quality / 100
      );
      const url = urls.replace('collage-download', blob);
      downloadUrl(url, getCollageFilename(format));
      urls.revoke('collage-download');
    } catch (cause) {
      setError(getImageProcessingErrorMessage(cause));
    } finally {
      setDownloading(false);
    }
  }, [collageOptions, format, items, quality, urls]);

  return (
    <div className="image-collage" data-image-collage>
      <FileUploader
        accept="image/jpeg,image/png,image/webp"
        multiple
        budgetProfile="collage"
        currentFiles={items.map((item) => item.file)}
        onFilesSelected={handleFiles}
      />
      {loading && (
        <p className="collage-loading" role="status">
          Opening images locally…
        </p>
      )}
      {error && (
        <div className="error-message collage-error" role="alert">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="collage-builder">
          <ol className="collage-flow" aria-label="Collage creation steps">
            <li className="is-complete">
              <span>1</span> Images added
            </li>
            <li className="is-active">
              <span>2</span> Choose a layout
            </li>
            <li>
              <span>3</span> Download
            </li>
          </ol>

          <div className="collage-editor">
            <section className="collage-preview-panel" aria-labelledby="collage-preview-title">
              <div className="collage-panel-heading">
                <div>
                  <span className="collage-eyebrow">Live preview</span>
                  <h2 id="collage-preview-title">Your collage</h2>
                </div>
                {layoutSummary && <span className="collage-output-size">{layoutSummary}</span>}
              </div>
              <div className="collage-canvas-stage">
                <canvas
                  ref={canvasRef}
                  data-collage-preview
                  className={previewDraggedId ? 'is-reordering' : undefined}
                  aria-label="Image collage preview. Drag a picture onto another position to swap them."
                  onPointerDown={startPreviewDrag}
                  onPointerMove={movePreviewDrag}
                  onPointerUp={finishPreviewDrag}
                  onPointerCancel={cancelPreviewDrag}
                  style={{ background }}
                />
              </div>
              <p className="collage-preview-help">
                Drag a picture onto another position to swap them.
              </p>
            </section>

            <aside className="collage-controls" aria-label="Collage settings">
              <div className="collage-controls-heading">
                <span className="collage-eyebrow">Layout</span>
                <h2>Pick the arrangement</h2>
                <p>Auto is recommended for most collages.</p>
              </div>

              <div className="collage-layout-choices" role="group" aria-label="Layout">
                {layoutChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.value}
                    className={`collage-layout-choice${layoutChoice === choice.value ? ' is-selected' : ''}`}
                    data-collage-layout={choice.value}
                    aria-pressed={layoutChoice === choice.value}
                    onClick={() => setLayoutChoice(choice.value)}
                  >
                    <span className="collage-layout-icon" aria-hidden="true">
                      {choice.icon}
                    </span>
                    <span>
                      <strong>{choice.label}</strong>
                      <small>{choice.description}</small>
                    </span>
                  </button>
                ))}
              </div>

              {layoutChoice === 'columns' && (
                <div className="collage-inline-option">
                  <NumberControl
                    id="collage-columns"
                    label="Columns"
                    min={1}
                    max={8}
                    value={columns}
                    onChange={setColumns}
                  />
                </div>
              )}

              <label className="collage-field collage-format-field">
                Output format
                <select
                  id="collage-format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ImageOutputMimeType)}
                >
                  <option value="image/png">PNG — best quality</option>
                  <option value="image/jpeg">JPG — smaller file</option>
                  <option value="image/webp">WebP — modern and compact</option>
                </select>
              </label>

              <details className="collage-advanced">
                <summary>Advanced options</summary>
                <div className="collage-advanced-grid">
                  <label className="collage-field">
                    Image fit
                    <select
                      id="collage-fit"
                      value={fit}
                      onChange={(event) => setFit(event.target.value as CollageFitMode)}
                    >
                      <option value="contain">Show the full image</option>
                      <option value="cover">Fill each tile</option>
                      <option value="original">Keep original size</option>
                    </select>
                  </label>

                  {fit !== 'original' && (
                    <>
                      <NumberControl
                        id="collage-cell-width"
                        label="Tile width"
                        min={80}
                        max={2400}
                        value={cellWidth}
                        onChange={setCellWidth}
                      />
                      <NumberControl
                        id="collage-cell-height"
                        label="Tile height"
                        min={80}
                        max={2400}
                        value={cellHeight}
                        onChange={setCellHeight}
                      />
                    </>
                  )}
                  <NumberControl
                    id="collage-gap"
                    label="Gap"
                    min={0}
                    max={200}
                    value={gap}
                    onChange={setGap}
                  />
                  <NumberControl
                    id="collage-margin"
                    label="Outer margin"
                    min={0}
                    max={240}
                    value={margin}
                    onChange={setMargin}
                  />
                  <NumberControl
                    id="collage-radius"
                    label="Corner radius"
                    min={0}
                    max={120}
                    value={borderRadius}
                    onChange={setBorderRadius}
                  />
                  <label className="collage-field">
                    Background
                    <input
                      id="collage-background"
                      type="color"
                      value={background}
                      onChange={(event) => setBackground(event.target.value)}
                    />
                  </label>
                  {format !== 'image/png' && (
                    <NumberControl
                      id="collage-quality"
                      label="Quality"
                      min={1}
                      max={100}
                      value={quality}
                      onChange={setQuality}
                    />
                  )}
                </div>
              </details>

              <div className="collage-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  data-collage-download
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? 'Preparing download…' : 'Download collage'}
                </button>
                <button type="button" className="collage-clear" onClick={clearAll}>
                  Clear all
                </button>
              </div>
              <p className="collage-local-note">
                Processed locally. Your images never leave this device.
              </p>
            </aside>
          </div>

          <section className="collage-image-order" aria-label="Collage images">
            <div className="collage-panel-heading">
              <div>
                <span className="collage-eyebrow">Image order</span>
                <h2>
                  {items.length} image{items.length === 1 ? '' : 's'}
                </h2>
              </div>
              <span className="collage-order-help">
                Use the arrows for precise or keyboard-friendly adjustments.
              </span>
            </div>
            <p className="sr-only" aria-live="polite">
              {sortAnnouncement}
            </p>
            <ol>
              {items.map((item, index) => (
                <li key={item.id}>
                  <span className="collage-image-number">{index + 1}</span>
                  <span className="collage-image-info">
                    <strong>{item.file.name}</strong>
                    <small>
                      {item.image.naturalWidth} × {item.image.naturalHeight}px ·{' '}
                      {formatSize(item.file.size)}
                    </small>
                  </span>
                  <span className="collage-image-actions">
                    <button
                      type="button"
                      aria-label={`Move ${item.file.name} earlier`}
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.file.name} later`}
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      →
                    </button>
                    <button type="button" className="is-remove" onClick={() => removeItem(item.id)}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
