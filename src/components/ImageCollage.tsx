import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import FileUploader from './FileUploader';
import FineTune, { FineTuneField } from './FineTune';
import { ToolChoices, type ToolChoice } from './ToolChoices';
import ToolRunNote from './ToolRunNote';
import { useAutoRun } from '../hooks/useAutoRun';
import { useNumberDraft } from '../hooks/useNumberDraft';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import {
  calculateCollageLayout,
  DEFAULT_COLLAGE_OPTIONS,
  getCollageFilename,
  recommendCollageCellSize,
  recommendCollageLayout,
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

/** The finished file the download button saves. Rebuilt whenever a setting changes. */
interface CollageOutput {
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
}

type LayoutChoice = 'auto-grid' | 'columns' | 'horizontal' | 'vertical';

const DEFAULT_COLUMNS = 2;
const DEFAULT_QUALITY = 92;

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

/**
 * A number input for the fine-tune panel. `FineTuneField` owns the label and the
 * hint, so this renders the control alone, and it keeps `useNumberDraft`: without
 * it the field cannot be emptied while a replacement value is typed.
 */
function NumberField({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const draftProps = useNumberDraft({ value, min, max, step, onCommit: onChange });
  return (
    <input
      id={id}
      className="field-input"
      type="number"
      min={min}
      max={max}
      step={step}
      {...draftProps}
    />
  );
}

/**
 * The arrangement question and its answers. The chips are derived from this table
 * rather than written out a second time, so a label cannot drift from the layout
 * it selects.
 */
const layoutChoices: readonly {
  value: LayoutChoice;
  label: string;
  description: string;
}[] = [
  {
    value: 'auto-grid',
    label: 'Auto',
    description: 'Best fit for your images',
  },
  {
    value: 'columns',
    label: 'Grid',
    description: 'Column count in Fine-tune',
  },
  {
    value: 'horizontal',
    label: 'Side by side',
    description: 'Left to right',
  },
  {
    value: 'vertical',
    label: 'Vertical stitch',
    description: 'Top to bottom',
  },
];

export default function ImageCollage() {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>('auto-grid');
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [fit, setFit] = useState<CollageFitMode>('contain');
  const [cellWidth, setCellWidth] = useState(DEFAULT_COLLAGE_OPTIONS.cellWidth);
  const [cellHeight, setCellHeight] = useState(DEFAULT_COLLAGE_OPTIONS.cellHeight);
  const [gap, setGap] = useState(DEFAULT_COLLAGE_OPTIONS.gap);
  const [margin, setMargin] = useState(DEFAULT_COLLAGE_OPTIONS.margin);
  const [borderRadius, setBorderRadius] = useState(DEFAULT_COLLAGE_OPTIONS.borderRadius);
  const [background, setBackground] = useState(DEFAULT_COLLAGE_OPTIONS.background);
  const [format, setFormat] = useState<ImageOutputMimeType>('image/png');
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  // The tile size the first batch of images suggested. Kept so the fine-tune
  // panel has a named place to go back to after it has been hand-edited.
  const [recommendedCell, setRecommendedCell] = useState({
    width: DEFAULT_COLLAGE_OPTIONS.cellWidth,
    height: DEFAULT_COLLAGE_OPTIONS.cellHeight,
  });
  const [tuned, setTuned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<CollageOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
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

  const collageSources = useMemo(
    () =>
      items.map((item) => ({ width: item.image.naturalWidth, height: item.image.naturalHeight })),
    [items]
  );
  const recommendedLayoutMode = useMemo(
    () => (collageSources.length > 0 ? recommendCollageLayout(collageSources) : 'grid'),
    [collageSources]
  );

  const layoutMode: CollageLayoutMode =
    layoutChoice === 'horizontal'
      ? 'horizontal'
      : layoutChoice === 'vertical'
        ? 'vertical'
        : layoutChoice === 'auto-grid'
          ? recommendedLayoutMode
          : 'grid';

  const recommendedLayoutLabel =
    recommendedLayoutMode === 'horizontal'
      ? 'Side by side'
      : recommendedLayoutMode === 'vertical'
        ? 'Vertical stitch'
        : 'Grid';

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
          setRecommendedCell(recommendedSize);
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
    setOutput(null);
    setElapsedMs(null);
    setBusy(false);
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

  const formatLabel = format === 'image/png' ? 'PNG' : format === 'image/jpeg' ? 'JPG' : 'WebP';

  /**
   * What the downloadable file depends on, not what the controls currently show.
   * PNG is lossless, so no PNG byte can change with the quality value and it is
   * left out of the key for that format — dragging that slider then re-encodes
   * nothing. The drag highlight is absent for the same reason: it is painted on
   * the preview only and never reaches the file.
   */
  const outputKey = useMemo(
    () =>
      JSON.stringify({
        items: items.map((item) => item.id),
        options: collageOptions,
        format,
        quality: format === 'image/png' ? null : quality,
      }),
    [collageOptions, format, items, quality]
  );

  // No submit step: the file follows the layout and the order the same way the
  // preview always has. The button below only saves what is already built.
  useAutoRun({
    key: outputKey,
    enabled: items.length > 0,
    onInvalidate: () => {
      urls.revoke('collage-download');
      // A drop during a reorder lands here too, so this stays cheap: handing
      // React back the value it already holds ends the update in place.
      setOutput((current) => (current === null ? current : null));
      setElapsedMs((current) => (current === null ? current : null));
      setBusy(items.length > 0);
    },
    run: async (isCurrent) => {
      if (items.length === 0) return;
      const startedAt = performance.now();
      try {
        // Drawn again offscreen instead of read back from the preview canvas:
        // during a reorder the preview carries the drag highlight, and that
        // overlay must never end up in the downloaded file.
        const canvas = document.createElement('canvas');
        renderCollage(canvas, items, collageOptions);
        const blob = await exportCanvas(
          canvas,
          format,
          format === 'image/png' ? undefined : quality / 100
        );
        // Only past this guard does this run own the key. `replace` revokes what
        // the key held, so registering while encoding would let a superseded run
        // pull the URL out from under a newer one on its way to abandoning
        // itself, leaving the button pointing at a revoked blob.
        if (!isCurrent()) return;
        setOutput({
          url: urls.replace('collage-download', blob),
          name: getCollageFilename(format),
          size: blob.size,
          width: canvas.width,
          height: canvas.height,
        });
        setElapsedMs(Math.round(performance.now() - startedAt));
        setBusy(false);
      } catch (cause) {
        if (!isCurrent()) return;
        setError(getImageProcessingErrorMessage(cause));
        setBusy(false);
      }
    },
  });

  const handleDownload = useCallback(() => {
    if (!output) return;
    downloadUrl(output.url, output.name);
  }, [output]);

  const resetFineTune = useCallback(() => {
    setFit(DEFAULT_COLLAGE_OPTIONS.fit);
    setCellWidth(recommendedCell.width);
    setCellHeight(recommendedCell.height);
    setGap(DEFAULT_COLLAGE_OPTIONS.gap);
    setMargin(DEFAULT_COLLAGE_OPTIONS.margin);
    setBorderRadius(DEFAULT_COLLAGE_OPTIONS.borderRadius);
    setBackground(DEFAULT_COLLAGE_OPTIONS.background);
    setColumns(DEFAULT_COLUMNS);
    setFormat('image/png');
    setQuality(DEFAULT_QUALITY);
    setTuned(false);
  }, [recommendedCell]);

  const layoutChipChoices = useMemo<ToolChoice<LayoutChoice>[]>(
    () =>
      layoutChoices.map((choice) => ({
        id: choice.value,
        label: choice.label,
        hint:
          choice.value === 'auto-grid'
            ? `Recommended: ${recommendedLayoutLabel}`
            : choice.description,
      })),
    [recommendedLayoutLabel]
  );

  /**
   * Short on purpose: this sits on one row beside the word "Fine-tune", and in
   * the collage sidebar that row is about 250 px wide. It names the values most
   * likely to have been changed rather than every value in the panel.
   */
  const fineTuneSummary = [
    formatLabel,
    layoutChoice === 'columns' ? `${columns} column${columns === 1 ? '' : 's'}` : null,
    fit === 'original' ? 'original size' : `${cellWidth} × ${cellHeight}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="image-collage"
      data-image-collage
      data-tool-input={items.length > 0 ? 'present' : 'empty'}
    >
      <FileUploader
        accept="image/jpeg,image/png,image/webp"
        multiple
        budgetProfile="collage"
        currentFiles={items.map((item) => item.file)}
        onFilesSelected={handleFiles}
        compact={items.length > 0}
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
          <div className="collage-status-bar">
            <p>
              <strong>{items.length} images ready</strong>
              <span>Auto recommends {recommendedLayoutLabel.toLowerCase()}.</span>
            </p>
            <button type="button" className="collage-clear" onClick={clearAll}>
              Start over
            </button>
          </div>

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
              <div className="tool-controls">
                <ToolChoices
                  name="collage-layout"
                  legend="How should the images sit together?"
                  help="Pick an arrangement and the collage follows. Every exact value stays in Fine-tune below."
                  choices={layoutChipChoices}
                  value={layoutChoice}
                  onChange={(choice) => setLayoutChoice(choice.id)}
                />

                <FineTune
                  summary={fineTuneSummary}
                  onReset={tuned ? resetFineTune : undefined}
                  resetLabel="Back to the recommended settings"
                >
                  {/*
                   * Kept mounted and hidden rather than unmounted, so the panel
                   * does not reflow as arrangements and formats change.
                   */}
                  <FineTuneField
                    htmlFor="collage-columns"
                    label="Columns"
                    hint="Used by the Grid arrangement."
                    hidden={layoutChoice !== 'columns'}
                  >
                    <NumberField
                      id="collage-columns"
                      min={1}
                      max={8}
                      value={columns}
                      onChange={(value) => {
                        setColumns(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField htmlFor="collage-format" label="Output format">
                    <select
                      id="collage-format"
                      value={format}
                      onChange={(event) => {
                        setFormat(event.target.value as ImageOutputMimeType);
                        setTuned(true);
                      }}
                    >
                      <option value="image/png">PNG — best quality</option>
                      <option value="image/jpeg">JPG — smaller file</option>
                      <option value="image/webp">WebP — modern and compact</option>
                    </select>
                  </FineTuneField>

                  <FineTuneField
                    htmlFor="collage-quality"
                    label={`Quality: ${quality}%`}
                    hint="Applies to JPG and WebP. PNG is lossless, so it has no quality setting."
                    hidden={format === 'image/png'}
                  >
                    <NumberField
                      id="collage-quality"
                      min={1}
                      max={100}
                      value={quality}
                      onChange={(value) => {
                        setQuality(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField htmlFor="collage-fit" label="Image fit">
                    <select
                      id="collage-fit"
                      value={fit}
                      onChange={(event) => {
                        setFit(event.target.value as CollageFitMode);
                        setTuned(true);
                      }}
                    >
                      <option value="contain">Show the full image</option>
                      <option value="cover">Fill each tile</option>
                      <option value="original">Keep original size</option>
                    </select>
                  </FineTuneField>

                  <FineTuneField
                    htmlFor="collage-cell-width"
                    label="Tile width"
                    hidden={fit === 'original'}
                  >
                    <NumberField
                      id="collage-cell-width"
                      min={80}
                      max={2400}
                      value={cellWidth}
                      onChange={(value) => {
                        setCellWidth(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField
                    htmlFor="collage-cell-height"
                    label="Tile height"
                    hidden={fit === 'original'}
                  >
                    <NumberField
                      id="collage-cell-height"
                      min={80}
                      max={2400}
                      value={cellHeight}
                      onChange={(value) => {
                        setCellHeight(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField htmlFor="collage-gap" label="Gap">
                    <NumberField
                      id="collage-gap"
                      min={0}
                      max={200}
                      value={gap}
                      onChange={(value) => {
                        setGap(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField htmlFor="collage-margin" label="Outer margin">
                    <NumberField
                      id="collage-margin"
                      min={0}
                      max={240}
                      value={margin}
                      onChange={(value) => {
                        setMargin(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField htmlFor="collage-radius" label="Corner radius">
                    <NumberField
                      id="collage-radius"
                      min={0}
                      max={120}
                      value={borderRadius}
                      onChange={(value) => {
                        setBorderRadius(value);
                        setTuned(true);
                      }}
                    />
                  </FineTuneField>

                  <FineTuneField htmlFor="collage-background" label="Background">
                    <input
                      id="collage-background"
                      className="field-input"
                      type="color"
                      value={background}
                      onChange={(event) => {
                        setBackground(event.target.value);
                        setTuned(true);
                      }}
                      style={{ height: 44, padding: '0.25rem' }}
                    />
                  </FineTuneField>
                </FineTune>

                <ToolRunNote busy={busy}>
                  {busy
                    ? 'Building the collage file in your browser…'
                    : output
                      ? `Collage file ready${elapsedMs === null ? '' : ` in ${(elapsedMs / 1000).toFixed(2)}s`}. It is rebuilt whenever the layout, the order, or a setting changes.`
                      : 'Results follow the settings above.'}
                </ToolRunNote>
              </div>

              <div className="collage-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  data-collage-download
                  onClick={handleDownload}
                  disabled={!output}
                  // There is no shared disabled style for this button, and the
                  // wait is short enough that moving it would be worse than
                  // dimming it in place.
                  style={output ? undefined : { opacity: 0.6, cursor: 'progress' }}
                >
                  Download collage
                </button>
                <span className="collage-download-meta">
                  {formatLabel} · {output ? formatSize(output.size) : 'updating…'}
                </span>
              </div>

              <p className="collage-local-note">
                Selected image content is processed locally and is not sent to ToolkitFree for
                processing.
              </p>
            </aside>
          </div>

          <details className="collage-image-order" aria-label="Collage images">
            <summary>
              <span>Reorder or remove images</span>
              <small>Optional · drag directly on the preview for a quick swap</small>
            </summary>
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
          </details>
        </div>
      )}
    </div>
  );
}
