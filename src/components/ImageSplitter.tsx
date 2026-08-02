import { useCallback, useMemo, useRef, useState } from 'react';
import FileUploader from './FileUploader';
import BatchResultsSummary from './BatchResultsSummary';
import DownloadResult from './DownloadResult';
import NumberField from './NumberField';
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

type Axis = 'x' | 'y';

interface Preset {
  label: string;
  rows: number;
  cols: number;
}

const PRESETS: readonly Preset[] = [
  { label: '2 across', rows: 1, cols: 2 },
  { label: '2 down', rows: 2, cols: 1 },
  { label: '2 × 2', rows: 2, cols: 2 },
  { label: '3 × 3', rows: 3, cols: 3 },
];

const OUTPUT_FORMATS = [
  { value: 'original', label: 'Same as input' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/webp', label: 'WebP' },
] as const;

type OutputFormat = (typeof OUTPUT_FORMATS)[number]['value'];

/**
 * Layout failures throw plain errors that already explain how to fix the setting,
 * so they must not be flattened into the generic image-processing message.
 */
function describeSplitError(error: unknown): string {
  if (error instanceof ImageProcessingError) return getImageProcessingErrorMessage(error);
  if (error instanceof Error && error.message) return error.message;
  return 'The image could not be split. Please try another file.';
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
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SplitResult[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const objectUrls = useObjectUrlRegistry();

  const clearResults = useCallback(() => {
    objectUrls.revokePrefix('tile:');
    setResults([]);
  }, [objectUrls]);

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
    (nextRows: number, nextCols: number) => {
      if (!dimensions) return;
      try {
        setXCuts(createEvenCuts(dimensions.width, nextCols, gutter, margin));
        setYCuts(createEvenCuts(dimensions.height, nextRows, gutter, margin));
        setError(null);
        clearResults();
      } catch (gridError) {
        setError(describeSplitError(gridError));
      }
    },
    [clearResults, dimensions, gutter, margin]
  );

  const handleFiles = useCallback(
    async (newFiles: File[]) => {
      const selected = newFiles[0];
      if (!selected) return;

      clearResults();
      setError(null);
      try {
        const image = await loadImage(selected);
        const size = { width: image.naturalWidth, height: image.naturalHeight };
        imageRef.current = image;
        setFile(selected);
        setDimensions(size);
        setPreviewUrl(objectUrls.replace('preview', selected));
        setGutter(0);
        setMargin(0);
        setXCuts(createEvenCuts(size.width, defaultCols ?? DEFAULT_SPLIT_OPTIONS.cols, 0, 0));
        setYCuts(createEvenCuts(size.height, defaultRows ?? DEFAULT_SPLIT_OPTIONS.rows, 0, 0));
      } catch (loadError) {
        imageRef.current = null;
        setFile(null);
        setDimensions(null);
        setPreviewUrl(null);
        setError(describeSplitError(loadError));
      }
    },
    [clearResults, defaultCols, defaultRows, objectUrls]
  );

  const handleRemove = useCallback(() => {
    objectUrls.revokeAll();
    imageRef.current = null;
    setFile(null);
    setDimensions(null);
    setPreviewUrl(null);
    setXCuts([]);
    setYCuts([]);
    setResults([]);
    setError(null);
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
    setter((previous) => previous.map((cut, cutIndex) => (cutIndex === index ? next : cut)));
    setError(null);
    clearResults();
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
      clearResults();
    } catch (addError) {
      setError(describeSplitError(addError));
    }
  };

  const removeCut = (axis: Axis, index: number) => {
    const setter = axis === 'x' ? setXCuts : setYCuts;
    setter((previous) => previous.filter((_, cutIndex) => cutIndex !== index));
    setError(null);
    clearResults();
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

  const resolveOutputType = (): ImageOutputMimeType => {
    if (outputFormat !== 'original') return outputFormat;
    if (file?.type === 'image/jpeg' || file?.type === 'image/webp') return file.type;
    return 'image/png';
  };

  const handleSplit = async () => {
    const layout = preview.layout;
    if (!file || !layout) return;

    clearResults();
    setError(null);
    setSplitting(true);

    try {
      const image = imageRef.current ?? (await loadImage(file));
      imageRef.current = image;
      const outputType = resolveOutputType();
      const extension = getSplitExtension(outputType);

      const produced = await mapWithConcurrency(
        layout.tiles,
        2,
        async (tile: SplitTile): Promise<SplitResult> => {
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
            id: `tile-${tile.index}`,
            name: getSplitFilename(file.name, tile, extension, {
              rows: layout.rows,
              cols: layout.cols,
            }),
            size: blob.size,
            url: objectUrls.replace(`tile:${tile.index}`, blob),
            blob,
          };
        }
      );

      setResults(produced);
    } catch (splitError) {
      clearResults();
      setError(describeSplitError(splitError));
    } finally {
      setSplitting(false);
    }
  };

  const layout = preview.layout;
  const tileCount = layout ? layout.tiles.length : 0;
  const rows = yCuts.length + 1;
  const cols = xCuts.length + 1;
  const outputType = resolveOutputType();

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
      aria-busy={splitting}
      data-image-splitter
      data-split-rows={rows}
      data-split-cols={cols}
      data-split-tile-count={tileCount}
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
            <div className="splitter-frame" ref={frameRef}>
              <img src={previewUrl} alt={`Preview of ${file.name} with split lines`} />

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

          <fieldset className="splitter-fieldset">
            <legend>Start from an even grid</legend>
            <div className="splitter-preset-row">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={
                    rows === preset.rows && cols === preset.cols
                      ? 'btn btn-primary'
                      : 'btn btn-secondary'
                  }
                  aria-pressed={rows === preset.rows && cols === preset.cols}
                  onClick={() => applyEvenGrid(preset.rows, preset.cols)}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => applyEvenGrid(rows, cols)}
              >
                Distribute evenly
              </button>
            </div>
          </fieldset>

          <div className="splitter-settings">
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
              onCommit={(next) => {
                setMargin(next);
                setError(null);
                clearResults();
              }}
            />
            <NumberField
              id="splitter-gutter"
              label="Discard at each line (px)"
              value={gutter}
              min={0}
              steppers
              onCommit={(next) => {
                setGutter(next);
                setError(null);
                clearResults();
              }}
            />
            <div>
              <label htmlFor="splitter-format" className="field-label">
                Output format
              </label>
              <select
                id="splitter-format"
                value={outputFormat}
                onChange={(event) => {
                  setOutputFormat(event.target.value as OutputFormat);
                  clearResults();
                }}
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="splitter-cut-groups">
            {renderCutFields('x')}
            {renderCutFields('y')}
          </div>

          {preview.message && (
            <div className="status status-error" role="alert">
              {preview.message}
            </div>
          )}

          {layout && (
            <p className="splitter-hint">
              {tileCount} piece{tileCount === 1 ? '' : 's'} — {cols} across, {rows} down.
              {outputType === 'image/jpeg' &&
                ' JPG output is re-encoded, which adds a second round of lossy compression.'}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSplit}
            disabled={splitting || !layout}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
          >
            {splitting ? 'Splitting...' : `Split into ${tileCount} pieces`}
          </button>
        </div>
      )}

      {splitting && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Splitting the image.
        </div>
      )}
      {error && (
        <div className="status status-error" role="alert">
          {error}
        </div>
      )}

      <BatchResultsSummary
        successes={results.map((result, index) => ({
          sourceId: result.id,
          sourceName: file?.name ?? '',
          outputName: result.name,
          // The source is counted once so the summary compares one input with the combined output.
          originalSize: index === 0 ? (file?.size ?? 0) : 0,
          outputSize: result.size,
          blob: result.blob,
        }))}
        failures={[]}
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
