import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import FileUploader from './FileUploader';
import BatchResultsSummary from './BatchResultsSummary';
import DownloadResult from './DownloadResult';
import NumberField from './NumberField';
import FineTune, { FineTuneField } from './FineTune';
import ToolRunNote from './ToolRunNote';
import { ToolPresets, type ToolChoice } from './ToolChoices';
import { useAutoRun } from '../hooks/useAutoRun';
import { useObjectUrlRegistry } from '../hooks/useObjectUrlRegistry';
import { mapWithConcurrency } from '../lib/async-pool';
import {
  ImageProcessingError,
  exportCanvas,
  formatSize,
  getCanvas2dContext,
  getImageProcessingErrorMessage,
  loadImage,
  type ImageOutputMimeType,
} from '../lib/image-processing';
import { detectSeams, type GrayscaleBuffer } from '../lib/image-seam-detection';
import {
  DEFAULT_SPLIT_OPTIONS,
  MAX_SPLIT_TILES,
  calculateSplitLayoutFromCuts,
  clampCutPosition,
  createEvenCuts,
  getSplitExtension,
  getSplitFilename,
  suggestCutPosition,
  type SplitLayout,
  type SplitTile,
} from '../lib/image-splitter';

interface SplitResult {
  id: string;
  name: string;
  size: number;
  url: string;
  blob: Blob;
}

/** A finished piece that has not been given an object URL yet. */
interface PendingTile {
  index: number;
  name: string;
  blob: Blob;
}

type Axis = 'x' | 'y';

interface Preset {
  id: string;
  label: string;
  rows: number;
  cols: number;
}

const PRESETS: readonly Preset[] = [
  { id: 'across-2', label: '2 across', rows: 1, cols: 2 },
  { id: 'down-2', label: '2 down', rows: 2, cols: 1 },
  { id: 'grid-2x2', label: '2 × 2', rows: 2, cols: 2 },
  { id: 'grid-3x3', label: '3 × 3', rows: 3, cols: 3 },
];

/**
 * The chips are a projection of the preset table above, never a second copy of
 * it, so a label cannot drift away from the grid it names. This is the row of
 * buttons the tool already had, moved onto the shared chip: it asks no new
 * question, it just wraps properly and keeps a 44px target on a phone. A variant
 * route that pins a grid simply opens with the matching chip lit, so a chip can
 * never quietly contradict the promise in the URL.
 */
const GRID_PRESETS: readonly ToolChoice<string>[] = PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label,
}));

const OUTPUT_FORMATS = [
  { value: 'original', label: 'Same as input' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/webp', label: 'WebP' },
] as const;

type OutputFormat = (typeof OUTPUT_FORMATS)[number]['value'];

const FORMAT_LABELS: Record<ImageOutputMimeType, string> = {
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WebP',
};

/**
 * The pieces follow the split lines, so there is no submit step. The delay is
 * what keeps dragging a line smooth: pointer moves land dozens of times a
 * second and each one only drops the stale pieces, while the encode waits until
 * the line has been still this long.
 *
 * Cutting into more pieces is not proportionally more work. The pieces together
 * cover the source exactly once, so N of them cost about one re-encode of the
 * whole image plus a small fixed cost each: measured on a 4000x3000 PNG, four
 * pieces took ~500ms and nine took ~470ms, and only the 144-piece ceiling
 * reached ~1.2s. That is why no piece-count threshold falls back to a button.
 */
const SPLIT_DELAY_MS = 320;

/**
 * Detection reads the whole image at once, so very large sources are sampled down
 * first. Four megapixels keeps a stitched screenshot close to its native size while
 * bounding the temporary buffers on a phone.
 */
const MAX_DETECTION_PIXELS = 4_000_000;

function sampleGrayscale(image: HTMLImageElement, width: number, height: number): GrayscaleBuffer {
  const scale = Math.min(1, Math.sqrt(MAX_DETECTION_PIXELS / (width * height)));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = getCanvas2dContext(canvas);
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);

  const gray = new Uint8Array(sampleWidth * sampleHeight);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    // Rec. 601 luma. A seam only has to read as one flat value, so the exact
    // weighting matters less than staying cheap over several million pixels.
    gray[index] = (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
  }

  canvas.width = 0;
  canvas.height = 0;
  return { data: gray, width: sampleWidth, height: sampleHeight };
}

/**
 * Layout failures throw plain errors that already explain how to fix the setting,
 * so they must not be flattened into the generic image-processing message.
 */
function describeSplitError(error: unknown): string {
  if (error instanceof ImageProcessingError) return getImageProcessingErrorMessage(error);
  if (error instanceof Error && error.message) return error.message;
  return 'The image could not be split. Please try another file.';
}

/**
 * Stable identity for the summary's unused failure list. `BatchResultsSummary`
 * cancels any archive in progress whenever this prop changes identity, and with
 * the pieces re-cut as the lines move a fresh literal would do that on every
 * render of a drag.
 */
const NO_FAILURES: never[] = [];

/**
 * A small grid of a small picture finishes in tens of milliseconds, and rounding
 * that to one decimal reports it as "0.0s", which reads as a failure rather than
 * as speed. Below a second the real number is the honest one.
 */
function formatElapsed(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function sameCuts(current: readonly number[], target: readonly number[]): boolean {
  return current.length === target.length && current.every((cut, index) => cut === target[index]);
}

interface Props {
  defaultRows?: number;
  defaultCols?: number;
}

export default function ImageSplitter({ defaultRows, defaultCols }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [xCuts, setXCuts] = useState<number[]>([]);
  const [yCuts, setYCuts] = useState<number[]>([]);
  const [gutter, setGutter] = useState(DEFAULT_SPLIT_OPTIONS.gutter);
  const [margin, setMargin] = useState(DEFAULT_SPLIT_OPTIONS.margin);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('original');
  const [appliedPreset, setAppliedPreset] = useState<Preset | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SplitResult[]>([]);
  // Decoding the source costs far more than drawing regions of it — a 12MP PNG
  // takes ~300ms — and with the pieces following the lines that decode would
  // otherwise repeat after every drag. One decode per file, reused by every run
  // on that file and by seam detection.
  const decodedRef = useRef<{ file: File; image: HTMLImageElement } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const objectUrls = useObjectUrlRegistry();

  /**
   * The note from the last detection describes the lines it placed, so any hand
   * edit to a line makes it stale. Deliberately not part of the auto-run's
   * invalidation: detection works by writing cut positions, which invalidates on
   * its own, and clearing the note there would erase it the instant it appeared.
   */
  const clearDetection = useCallback(() => {
    setDetection((current) => (current === null ? current : null));
  }, []);

  const decodeSource = useCallback(async (source: File): Promise<HTMLImageElement> => {
    const cached = decodedRef.current;
    if (cached && cached.file === source) return cached.image;
    const image = await loadImage(source);
    decodedRef.current = { file: source, image };
    return image;
  }, []);

  const preview = useMemo<{ layout: SplitLayout | null; message: string | null }>(() => {
    if (!dimensions) return { layout: null, message: null };
    try {
      return {
        layout: calculateSplitLayoutFromCuts(dimensions, { xCuts, yCuts, gutter, margin }),
        message: null,
      };
    } catch (layoutError) {
      return { layout: null, message: describeSplitError(layoutError) };
    }
  }, [dimensions, gutter, margin, xCuts, yCuts]);

  const applyEvenGrid = useCallback(
    (nextRows: number, nextCols: number, preset: Preset | null = null) => {
      if (!dimensions) return;
      try {
        setXCuts(createEvenCuts(dimensions.width, nextCols, gutter, margin));
        setYCuts(createEvenCuts(dimensions.height, nextRows, gutter, margin));
        setAppliedPreset(preset);
        setError(null);
        clearDetection();
      } catch (gridError) {
        setError(describeSplitError(gridError));
      }
    },
    [clearDetection, dimensions, gutter, margin]
  );

  const handleDetect = useCallback(async () => {
    if (!file || !dimensions) return;

    setDetecting(true);
    setError(null);
    // Yield once so the button shows its working label before the passes begin.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });

    try {
      const image = await decodeSource(file);
      const result = detectSeams(sampleGrayscale(image, dimensions.width, dimensions.height), {
        sourceWidth: dimensions.width,
        sourceHeight: dimensions.height,
      });

      if (result.xCuts.length === 0 && result.yCuts.length === 0) {
        setDetection(
          'No usable gutter was found. This works on images whose pieces are separated by a ' +
            'plain strip running the full width or height; place the lines by hand instead.'
        );
        return;
      }

      setAppliedPreset(null);
      setMargin(result.margin);
      setGutter(result.gutter);
      setXCuts(result.xCuts.map((cut) => cut.position));
      setYCuts(result.yCuts.map((cut) => cut.position));

      const total = result.xCuts.length + result.yCuts.length;
      setDetection(
        `Placed ${total} split ${total === 1 ? 'line' : 'lines'}: ` +
          `${result.xCuts.length} vertical, ${result.yCuts.length} horizontal` +
          `${result.gutter > 0 ? `, discarding ${result.gutter}px at each` : ''}` +
          `${result.margin > 0 ? `, inside a ${result.margin}px border` : ''}. ` +
          'Check them and move any line that sits in the wrong place.'
      );
    } catch (detectError) {
      setDetection(null);
      setError(describeSplitError(detectError));
    } finally {
      setDetecting(false);
    }
  }, [decodeSource, dimensions, file]);

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      const selected = newFiles[0];
      if (!selected) return;

      objectUrls.revokePrefix('tile:');
      setResults([]);
      setElapsedMs(null);
      clearDetection();
      setError(null);
      decodedRef.current = null;
      try {
        const image = await decodeSource(selected);
        const size = { width: image.naturalWidth, height: image.naturalHeight };
        setFile(selected);
        setDimensions(size);
        setPreviewUrl(objectUrls.replace('preview', selected));
        setGutter(0);
        setMargin(0);
        const rows = defaultRows ?? DEFAULT_SPLIT_OPTIONS.rows;
        const cols = defaultCols ?? DEFAULT_SPLIT_OPTIONS.cols;
        setXCuts(createEvenCuts(size.width, cols, 0, 0));
        setYCuts(createEvenCuts(size.height, rows, 0, 0));
        setAppliedPreset(PRESETS.find((p) => p.rows === rows && p.cols === cols) ?? null);
      } catch (loadError) {
        decodedRef.current = null;
        setFile(null);
        setDimensions(null);
        setPreviewUrl(null);
        setError(describeSplitError(loadError));
      }
    },
    [clearDetection, decodeSource, defaultCols, defaultRows, objectUrls]
  );

  const handleRemove = useCallback(() => {
    objectUrls.revokeAll();
    decodedRef.current = null;
    setFile(null);
    setDimensions(null);
    setPreviewUrl(null);
    setXCuts([]);
    setYCuts([]);
    setResults([]);
    setElapsedMs(null);
    setAppliedPreset(null);
    setError(null);
    setDetection(null);
  }, [objectUrls]);

  const cutsFor = (axis: Axis) => (axis === 'x' ? xCuts : yCuts);
  const totalFor = (axis: Axis) =>
    axis === 'x' ? (dimensions?.width ?? 0) : (dimensions?.height ?? 0);

  const moveCut = (axis: Axis, index: number, desired: number, snap = true) => {
    if (!dimensions) return;
    const cuts = cutsFor(axis);
    const total = totalFor(axis);

    let next: number;
    try {
      next = clampCutPosition(cuts, index, desired, total, gutter, margin);
    } catch {
      return;
    }

    if (snap) {
      // Snap back onto the evenly spaced position so a drag cannot quietly ruin a tidy grid.
      try {
        const targets = createEvenCuts(total, cuts.length + 1, gutter, margin);
        const tolerance = Math.max(2, Math.round(total * 0.004));
        const hit = targets.find((target) => Math.abs(target - next) <= tolerance);
        if (hit !== undefined) next = hit;
      } catch {
        // An unreachable even grid simply means no snapping.
      }
    }

    const setter = axis === 'x' ? setXCuts : setYCuts;
    // Bail out when the line has not actually moved: a drag fires this dozens of
    // times a second, and passing the value React already holds ends the update
    // there instead of re-rendering the frame for a pixel that did not change.
    setter((previous) =>
      previous[index] === next
        ? previous
        : previous.map((cut, cutIndex) => (cutIndex === index ? next : cut))
    );
    setError((current) => (current === null ? current : null));
    clearDetection();
  };

  const addCut = (axis: Axis) => {
    if (!dimensions) return;
    try {
      const position = suggestCutPosition(cutsFor(axis), totalFor(axis), gutter, margin);
      if (position === null) {
        setError('There is no room for another split line along that edge.');
        return;
      }
      const setter = axis === 'x' ? setXCuts : setYCuts;
      setter((previous) => [...previous, position].sort((first, second) => first - second));
      setError(null);
      clearDetection();
    } catch (addError) {
      setError(describeSplitError(addError));
    }
  };

  const removeCut = (axis: Axis, index: number) => {
    const setter = axis === 'x' ? setXCuts : setYCuts;
    setter((previous) => previous.filter((_, cutIndex) => cutIndex !== index));
    setError(null);
    clearDetection();
  };

  const startDrag = (axis: Axis, index: number) => (event: React.PointerEvent<HTMLElement>) => {
    const frame = frameRef.current;
    if (!frame || !dimensions) return;
    event.preventDefault();

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const bounds = frame.getBoundingClientRect();
      const ratio =
        axis === 'x'
          ? (moveEvent.clientX - bounds.left) / bounds.width
          : (moveEvent.clientY - bounds.top) / bounds.height;
      // Only the line moves here. Dropping the stale pieces and scheduling the
      // next encode both belong to the auto-run, which does the first once and
      // the second no sooner than `SPLIT_DELAY_MS` after the pointer settles.
      moveCut(axis, index, ratio * totalFor(axis) - gutter / 2);
    };
    const onEnd = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  };

  const handleKeyDown =
    (axis: Axis, index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
      const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      if (event.key !== back && event.key !== forward) return;
      event.preventDefault();
      const step = (event.shiftKey ? 10 : 1) * (event.key === back ? -1 : 1);
      moveCut(axis, index, cutsFor(axis)[index] + step, false);
    };

  const layout = preview.layout;
  const tileCount = layout ? layout.tiles.length : 0;
  const rows = yCuts.length + 1;
  const cols = xCuts.length + 1;

  const outputType = useMemo<ImageOutputMimeType>(() => {
    if (outputFormat !== 'original') return outputFormat;
    if (file?.type === 'image/jpeg' || file?.type === 'image/webp') return file.type;
    return 'image/png';
  }, [file, outputFormat]);

  /**
   * Everything a piece depends on, and nothing else. The rectangles are keyed
   * rather than the cut positions they came from, because a cut, the discard
   * width and the outer margin only reach the output through the rectangles they
   * produce — so a change that lands on the same pixels re-encodes nothing. The
   * row and column counts ride along because the filenames carry them.
   */
  const settingsKey = useMemo(
    () =>
      JSON.stringify({
        file: file ? `${file.name}:${file.size}:${file.lastModified}` : null,
        type: outputType,
        rows: layout?.rows ?? null,
        cols: layout?.cols ?? null,
        tiles: layout?.tiles.map((tile) => [
          tile.rect.x,
          tile.rect.y,
          tile.rect.width,
          tile.rect.height,
        ]),
      }),
    [file, layout, outputType]
  );

  // No submit step: the pieces follow the split lines.
  useAutoRun({
    key: settingsKey,
    enabled: Boolean(file) && layout !== null,
    delayMs: SPLIT_DELAY_MS,
    onInvalidate: () => {
      objectUrls.revokePrefix('tile:');
      // Written as bail-outs because a drag fires this on every pointer move:
      // passing the value React already holds ends the update there, so dragging
      // costs one render per move rather than two.
      setResults((current) => (current.length === 0 ? current : []));
      setElapsedMs((current) => (current === null ? current : null));
      setSplitting((current) => (current ? false : current));
    },
    run: async (isCurrent) => {
      const source = file;
      const currentLayout = layout;
      if (!source || !currentLayout) return;
      setSplitting(true);
      const startedAt = performance.now();

      try {
        const image = await decodeSource(source);
        if (!isCurrent()) return;

        const extension = getSplitExtension(outputType);
        const produced = await mapWithConcurrency(
          currentLayout.tiles,
          2,
          async (tile: SplitTile): Promise<PendingTile | null> => {
            // A superseded run stops encoding the pieces it has left rather than
            // finishing work whose results are already thrown away.
            if (!isCurrent()) return null;

            const canvas = document.createElement('canvas');
            canvas.width = tile.rect.width;
            canvas.height = tile.rect.height;
            const context = getCanvas2dContext(canvas);
            if (outputType === 'image/jpeg') {
              context.fillStyle = '#ffffff';
              context.fillRect(0, 0, canvas.width, canvas.height);
            }
            context.drawImage(
              image,
              tile.rect.x,
              tile.rect.y,
              tile.rect.width,
              tile.rect.height,
              0,
              0,
              tile.rect.width,
              tile.rect.height
            );

            const blob = await exportCanvas(
              canvas,
              outputType,
              outputType === 'image/png' ? undefined : 0.92
            );
            // Release the backing store before the next tile is drawn.
            canvas.width = 0;
            canvas.height = 0;

            return {
              index: tile.index,
              name: getSplitFilename(source.name, tile, extension, {
                rows: currentLayout.rows,
                cols: currentLayout.cols,
              }),
              blob,
            };
          }
        );
        if (!isCurrent()) return;

        // Object URLs are registered only now. `objectUrls.replace` revokes whatever
        // the key held, so a superseded run that registered as it encoded would take
        // the fresh run's URLs down with it and leave a rendered `src` dangling.
        setResults(
          produced
            .filter((tile): tile is PendingTile => tile !== null)
            .map((tile) => ({
              id: `tile-${tile.index}`,
              name: tile.name,
              size: tile.blob.size,
              url: objectUrls.replace(`tile:${tile.index}`, tile.blob),
              blob: tile.blob,
            }))
        );
        setElapsedMs(Math.round(performance.now() - startedAt));
        setSplitting(false);
      } catch (splitError) {
        if (!isCurrent()) return;
        objectUrls.revokePrefix('tile:');
        setResults([]);
        setError(describeSplitError(splitError));
        setSplitting(false);
      }
    },
  });

  /**
   * The even grid the applied preset stands for, at the current margin and
   * discard width. Derived rather than stored, so hand-editing a line, a count
   * or the spacing unlights the preset and offers the way back on its own.
   */
  const presetCuts = useMemo(() => {
    if (!appliedPreset || !dimensions) return null;
    try {
      return {
        x: createEvenCuts(dimensions.width, appliedPreset.cols, gutter, margin),
        y: createEvenCuts(dimensions.height, appliedPreset.rows, gutter, margin),
      };
    } catch {
      return null;
    }
  }, [appliedPreset, dimensions, gutter, margin]);

  const tuned =
    presetCuts !== null && !(sameCuts(xCuts, presetCuts.x) && sameCuts(yCuts, presetCuts.y));

  /** Memoized for the same reason as `NO_FAILURES`: identity is the cancel signal. */
  const archiveEntries = useMemo(
    () =>
      results.map((result, index) => ({
        sourceId: result.id,
        sourceName: file?.name ?? '',
        outputName: result.name,
        // The source is counted once so the summary compares one input with the combined output.
        originalSize: index === 0 ? (file?.size ?? 0) : 0,
        outputSize: result.size,
        blob: result.blob,
      })),
    [file, results]
  );

  const fineTuneSummary = `${cols} × ${rows} · ${FORMAT_LABELS[outputType]}${
    margin > 0 ? ` · ${margin}px border` : ''
  }${gutter > 0 ? ` · ${gutter}px discarded` : ''}`;

  const renderCutFields = (axis: Axis) => {
    const cuts = cutsFor(axis);
    const total = totalFor(axis);
    const noun = axis === 'x' ? 'Vertical' : 'Horizontal';
    return (
      <div className="splitter-cut-group">
        <div className="splitter-cut-group-head">
          <h4>
            {noun} lines ({cuts.length})
          </h4>
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => addCut(axis)}
            disabled={rows * cols >= MAX_SPLIT_TILES}
          >
            Add line
          </button>
        </div>
        {cuts.length === 0 ? (
          <p className="splitter-cut-empty">No {noun.toLowerCase()} lines yet.</p>
        ) : (
          <ul className="splitter-cut-list">
            {cuts.map((cut, index) => (
              <li key={`${axis}-${index}`}>
                <div className="splitter-cut-row">
                  <NumberField
                    id={`splitter-${axis}-cut-${index}`}
                    label={`${noun} line ${index + 1} (px from ${axis === 'x' ? 'left' : 'top'})`}
                    value={cut}
                    min={0}
                    max={total}
                    onCommit={(next) => moveCut(axis, index, next, false)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-compact"
                    onClick={() => removeCut(axis, index)}
                    aria-label={`Remove ${noun.toLowerCase()} line ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div
      aria-busy={splitting || detecting}
      data-image-splitter
      data-split-rows={rows}
      data-split-cols={cols}
      data-split-tile-count={tileCount}
      data-tool-input={file !== null ? 'present' : 'empty'}
    >
      {!file ? (
        <FileUploader
          accept="image/jpeg,image/png,image/webp"
          multiple={false}
          singleFileLabel="an image"
          budgetProfile="splitter"
          onFilesSelected={handleFiles}
        />
      ) : (
        <div>
          <div className="splitter-file-row">
            <div style={{ minWidth: 0 }}>
              <div className="file-item-name">{file.name}</div>
              <div className="file-item-size">
                {formatSize(file.size)}
                {dimensions ? ` — ${dimensions.width} × ${dimensions.height}px` : ''}
              </div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleRemove}>
              Choose a different image
            </button>
          </div>

          {previewUrl && dimensions && (
            <div
              className="splitter-frame"
              ref={frameRef}
              style={
                {
                  '--split-width': dimensions.width,
                  '--split-height': dimensions.height,
                } as CSSProperties
              }
            >
              <img
                src={previewUrl}
                width={dimensions.width}
                height={dimensions.height}
                alt={`Preview of ${file.name} with split lines`}
              />

              {layout?.tiles.map((tile) => (
                <span
                  key={tile.index}
                  className="splitter-tile"
                  aria-hidden="true"
                  style={{
                    left: `${(tile.rect.x / dimensions.width) * 100}%`,
                    top: `${(tile.rect.y / dimensions.height) * 100}%`,
                    width: `${(tile.rect.width / dimensions.width) * 100}%`,
                    height: `${(tile.rect.height / dimensions.height) * 100}%`,
                  }}
                />
              ))}

              {xCuts.map((cut, index) => (
                <button
                  key={`x-handle-${index}`}
                  type="button"
                  className="splitter-handle splitter-handle-x"
                  style={{ left: `${((cut + gutter / 2) / dimensions.width) * 100}%` }}
                  onPointerDown={startDrag('x', index)}
                  onKeyDown={handleKeyDown('x', index)}
                  aria-label={`Vertical line ${index + 1} at ${cut} pixels. Use the arrow keys to move it.`}
                >
                  <span aria-hidden="true" />
                </button>
              ))}

              {yCuts.map((cut, index) => (
                <button
                  key={`y-handle-${index}`}
                  type="button"
                  className="splitter-handle splitter-handle-y"
                  style={{ top: `${((cut + gutter / 2) / dimensions.height) * 100}%` }}
                  onPointerDown={startDrag('y', index)}
                  onKeyDown={handleKeyDown('y', index)}
                  aria-label={`Horizontal line ${index + 1} at ${cut} pixels. Use the arrow keys to move it.`}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <p className="splitter-hint">
            Drag a line to move it, or type an exact position below. Arrow keys nudge a focused line
            by one pixel, Shift and an arrow key by ten.
          </p>

          {preview.message && (
            <div className="status status-error" role="alert">
              {preview.message}
            </div>
          )}

          {layout && (
            <p className="splitter-hint" data-split-summary>
              {tileCount} piece{tileCount === 1 ? '' : 's'} — {cols} across, {rows} down.
              {outputType === 'image/jpeg' &&
                ' JPG output is re-encoded, which adds a second round of lossy compression.'}
            </p>
          )}

          <div className="tool-controls">
            <ToolPresets
              legend="Start from an even grid"
              help="A grid sets the split lines for you. Every line stays draggable, and each value is in Fine-tune below."
              presets={GRID_PRESETS}
              isActive={(preset) => {
                const match = PRESETS.find((entry) => entry.id === preset.id);
                return match !== undefined && rows === match.rows && cols === match.cols;
              }}
              onApply={(preset) => {
                const match = PRESETS.find((entry) => entry.id === preset.id);
                if (match) applyEvenGrid(match.rows, match.cols, match);
              }}
            />

            {/* The shared group box, so this row carries no outer margin of its own
                and `.tool-controls` alone decides the spacing between the controls. */}
            <fieldset className="tool-chip-group">
              <legend>Place the lines for me</legend>
              <div className="splitter-preset-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDetect}
                  disabled={detecting}
                  data-detect-seams
                >
                  {detecting ? 'Looking for seams...' : 'Detect split lines'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => applyEvenGrid(rows, cols)}
                >
                  Distribute evenly
                </button>
              </div>
              <p className="tool-hint">
                Detect split lines looks for the plain strips that separate the pictures in a
                stitched image and puts a line in each one. It cannot find a seam that is not there,
                and every line it places stays editable. Distribute evenly respaces the lines you
                already have.
              </p>
              {detection && (
                <p className="tool-hint" data-seam-detection role="status">
                  {detection}
                </p>
              )}
            </fieldset>

            <FineTune
              summary={fineTuneSummary}
              onReset={
                tuned && appliedPreset
                  ? () => applyEvenGrid(appliedPreset.rows, appliedPreset.cols, appliedPreset)
                  : undefined
              }
              resetLabel={appliedPreset ? `Back to the ${appliedPreset.label} grid` : undefined}
            >
              <NumberField
                id="splitter-rows"
                label="Rows"
                value={rows}
                min={1}
                max={Math.floor(MAX_SPLIT_TILES / cols)}
                steppers
                onCommit={(next) => applyEvenGrid(next, cols)}
              />
              <NumberField
                id="splitter-cols"
                label="Columns"
                value={cols}
                min={1}
                max={Math.floor(MAX_SPLIT_TILES / rows)}
                steppers
                onCommit={(next) => applyEvenGrid(rows, next)}
              />
              <NumberField
                id="splitter-margin"
                label="Outer margin (px)"
                value={margin}
                min={0}
                steppers
                hint="Pixels skipped at every outside edge, for a picture that already has a border."
                onCommit={(next) => {
                  setMargin(next);
                  setError(null);
                  clearDetection();
                }}
              />
              <NumberField
                id="splitter-gutter"
                label="Discard at each line (px)"
                value={gutter}
                min={0}
                steppers
                hint="Each line drops a band this wide instead of cutting at a single point."
                onCommit={(next) => {
                  setGutter(next);
                  setError(null);
                  clearDetection();
                }}
              />
              <FineTuneField
                htmlFor="splitter-format"
                label="Output format"
                hint="Same as input keeps PNG and WebP sources lossless; a JPG source stays JPG."
              >
                <select
                  id="splitter-format"
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
                >
                  {OUTPUT_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </FineTuneField>
            </FineTune>

            <ToolRunNote busy={splitting}>
              {splitting
                ? 'Cutting the pieces in your browser…'
                : elapsedMs !== null
                  ? `Cut ${results.length} piece${results.length === 1 ? '' : 's'} in your browser in ${formatElapsed(elapsedMs)}. The image was not uploaded for processing.`
                  : 'The pieces follow the split lines above. The image is not uploaded for processing.'}
            </ToolRunNote>
          </div>

          <div className="splitter-cut-groups">
            {renderCutFields('x')}
            {renderCutFields('y')}
          </div>
        </div>
      )}

      {splitting && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Splitting the image.
        </div>
      )}
      {detecting && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Looking for the seams.
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      <BatchResultsSummary
        successes={archiveEntries}
        failures={NO_FAILURES}
        archiveName="toolkitfree-split-images.zip"
      />

      {results.length > 0 && (
        <div data-split-results={results.length}>
          {results.map((result) => (
            <DownloadResult
              key={result.id}
              name={result.name}
              size={result.size}
              url={result.url}
              previewUrl={result.url}
            />
          ))}
        </div>
      )}
    </div>
  );
}
