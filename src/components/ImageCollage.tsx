import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  calculateCollageLayout,
  DEFAULT_COLLAGE_OPTIONS,
  getCollageFilename,
  type CollageFitMode,
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
    <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>
      {label}
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
      />
    </label>
  );
}

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const loadIdRef = useRef(0);
  const itemIdRef = useRef(0);
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

  const handleFiles = useCallback(async (newFiles: File[]) => {
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
      setItems((current) => [...current, ...loaded]);
    } catch (cause) {
      if (loadId === loadIdRef.current) setError(getImageProcessingErrorMessage(cause));
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, []);

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

  const clearAll = useCallback(() => {
    loadIdRef.current += 1;
    setItems([]);
    setError(null);
    setLayoutSummary('');
    urls.revokePrefix('collage-');
  }, [urls]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (items.length === 0) return;
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const layout = renderCollage(canvas, items, collageOptions);
        setLayoutSummary(`${layout.width} × ${layout.height}px output`);
        setError(null);
      } catch (cause) {
        setError(getImageProcessingErrorMessage(cause));
      }
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [collageOptions, items]);

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
    <div data-image-collage>
      <FileUploader
        accept="image/jpeg,image/png,image/webp"
        multiple
        budgetProfile="collage"
        currentFiles={items.map((item) => item.file)}
        onFilesSelected={handleFiles}
      />
      {loading && <p role="status">Opening images safely...</p>}
      {error && (
        <div className="error-message" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <canvas
              ref={canvasRef}
              data-collage-preview
              aria-label="Image collage preview"
              style={{
                maxWidth: '100%',
                height: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                background,
              }}
            />
            {layoutSummary && (
              <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                {layoutSummary}
              </p>
            )}
          </div>

          <section aria-label="Collage images" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Images</h3>
            <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
              {items.map((item, index) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.875rem' }}>
                    {index + 1}. {item.file.name} — {item.image.naturalWidth}×
                    {item.image.naturalHeight}px, {formatSize(item.file.size)}
                  </span>
                  <span style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-label="Collage settings"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <label
              style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Layout
              <select
                id="collage-layout"
                value={layoutChoice}
                onChange={(event) => setLayoutChoice(event.target.value as LayoutChoice)}
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <option value="auto-grid">Auto grid</option>
                <option value="columns">Custom columns</option>
                <option value="horizontal">Horizontal stitch</option>
                <option value="vertical">Vertical stitch</option>
              </select>
            </label>

            {layoutChoice === 'columns' && (
              <NumberControl
                id="collage-columns"
                label="Columns"
                min={1}
                max={8}
                value={columns}
                onChange={setColumns}
              />
            )}

            <label
              style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Fit mode
              <select
                id="collage-fit"
                value={fit}
                onChange={(event) => setFit(event.target.value as CollageFitMode)}
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <option value="contain">Contain full image</option>
                <option value="cover">Cover tile</option>
                <option value="original">Original size</option>
              </select>
            </label>

            {fit !== 'original' && (
              <>
                <NumberControl
                  id="collage-cell-width"
                  label="Cell width"
                  min={80}
                  max={2400}
                  value={cellWidth}
                  onChange={setCellWidth}
                />
                <NumberControl
                  id="collage-cell-height"
                  label="Cell height"
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

            <label
              style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Background
              <input
                id="collage-background"
                type="color"
                value={background}
                onChange={(event) => setBackground(event.target.value)}
                style={{ width: '100%', minHeight: '2.4rem' }}
              />
            </label>

            <label
              style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}
            >
              Output format
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value as ImageOutputMimeType)}
                style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/webp">WebP</option>
              </select>
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
          </section>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              data-collage-download
              onClick={handleDownload}
              disabled={items.length === 0 || downloading}
            >
              {downloading ? 'Preparing download...' : 'Download Collage'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearAll}>
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
