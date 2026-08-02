export interface SplitSource {
  width: number;
  height: number;
}

export interface SplitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitTile {
  index: number;
  row: number;
  col: number;
  rect: SplitRect;
}

export interface SplitLayout {
  rows: number;
  cols: number;
  tiles: SplitTile[];
}

/**
 * A cut position is the first pixel of the discarded band, so with a gutter of 0
 * it is simply the boundary between two pieces.
 */
export interface CutSplitOptions {
  xCuts: readonly number[];
  yCuts: readonly number[];
  gutter: number;
  margin: number;
}

export interface EvenSplitOptions {
  rows: number;
  cols: number;
  gutter: number;
  margin: number;
}

export const MAX_SPLIT_TILES = 144;

export const DEFAULT_SPLIT_OPTIONS: EvenSplitOptions = {
  rows: 2,
  cols: 2,
  gutter: 0,
  margin: 0,
};

type Axis = 'horizontal' | 'vertical';

interface AxisSlice {
  start: number;
  size: number;
}

function requireSafeInteger(value: number, label: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer of at least ${minimum}.`);
  }
  return value;
}

function validateSource(source: SplitSource): void {
  requireSafeInteger(source.width, 'Source width', 1);
  requireSafeInteger(source.height, 'Source height', 1);
}

function axisLabel(axis: Axis): string {
  return axis === 'horizontal' ? 'width' : 'height';
}

/**
 * Positions of the evenly spaced cuts for `count` pieces. Any leftover pixels are
 * spread across the leading pieces, so no two pieces differ by more than one pixel.
 */
export function createEvenCuts(
  total: number,
  count: number,
  gutter: number,
  margin: number
): number[] {
  requireSafeInteger(total, 'Length', 1);
  const parts = requireSafeInteger(count, 'Piece count', 1);
  const gap = requireSafeInteger(gutter, 'Gutter', 0);
  const edge = requireSafeInteger(margin, 'Margin', 0);

  const available = total - edge * 2 - (parts - 1) * gap;
  if (available < parts) {
    throw new Error(
      `The remaining ${available}px cannot be divided into ${parts} pieces. ` +
        'Reduce the margin, the gap, or the number of pieces.'
    );
  }

  const base = Math.floor(available / parts);
  const leftover = available - base * parts;
  const cuts: number[] = [];
  let cursor = edge;

  for (let index = 0; index < parts - 1; index += 1) {
    cursor += index < leftover ? base + 1 : base;
    cuts.push(cursor);
    cursor += gap;
  }

  return cuts;
}

function slicesFromCuts(
  total: number,
  cuts: readonly number[],
  gutter: number,
  margin: number,
  axis: Axis
): AxisSlice[] {
  const contentStart = margin;
  const contentEnd = total - margin;

  const sorted = [...cuts].sort((first, second) => first - second);
  sorted.forEach((cut, index) => requireSafeInteger(cut, `Cut ${index + 1}`, 0));

  const starts = [contentStart, ...sorted.map((cut) => cut + gutter)];
  const ends = [...sorted, contentEnd];

  return starts.map((start, index) => {
    const size = ends[index] - start;
    if (size < 1) {
      throw new Error(
        `A piece along the ${axisLabel(axis)} would be empty. ` +
          'Move the split lines apart, or reduce the margin or the gap.'
      );
    }
    return { start, size };
  });
}

export function calculateSplitLayoutFromCuts(
  source: SplitSource,
  options: CutSplitOptions
): SplitLayout {
  validateSource(source);
  const gutter = requireSafeInteger(options.gutter, 'Gutter', 0);
  const margin = requireSafeInteger(options.margin, 'Margin', 0);

  const cols = options.xCuts.length + 1;
  const rows = options.yCuts.length + 1;
  if (rows * cols > MAX_SPLIT_TILES) {
    throw new Error(`A split cannot produce more than ${MAX_SPLIT_TILES} pieces.`);
  }

  const columns = slicesFromCuts(source.width, options.xCuts, gutter, margin, 'horizontal');
  const lines = slicesFromCuts(source.height, options.yCuts, gutter, margin, 'vertical');

  const tiles: SplitTile[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      tiles.push({
        index: row * cols + col,
        row,
        col,
        rect: {
          x: columns[col].start,
          y: lines[row].start,
          width: columns[col].size,
          height: lines[row].size,
        },
      });
    }
  }

  return { rows, cols, tiles };
}

export function calculateEvenSplitLayout(
  source: SplitSource,
  options: EvenSplitOptions
): SplitLayout {
  validateSource(source);
  const rows = requireSafeInteger(options.rows, 'Rows', 1);
  const cols = requireSafeInteger(options.cols, 'Columns', 1);
  if (rows * cols > MAX_SPLIT_TILES) {
    throw new Error(`A split cannot produce more than ${MAX_SPLIT_TILES} pieces.`);
  }

  return calculateSplitLayoutFromCuts(source, {
    xCuts: createEvenCuts(source.width, cols, options.gutter, options.margin),
    yCuts: createEvenCuts(source.height, rows, options.gutter, options.margin),
    gutter: options.gutter,
    margin: options.margin,
  });
}

/**
 * Restrict a dragged or typed cut position so both neighbouring pieces keep at
 * least one pixel. Returns the clamped integer position.
 */
export function clampCutPosition(
  cuts: readonly number[],
  index: number,
  desired: number,
  total: number,
  gutter: number,
  margin: number
): number {
  if (index < 0 || index >= cuts.length) {
    throw new Error(`Cut index ${index} is out of range.`);
  }

  const lower = (index === 0 ? margin : cuts[index - 1] + gutter) + 1;
  const upper =
    (index === cuts.length - 1 ? total - margin - gutter : cuts[index + 1] - gutter) - 1;
  if (upper < lower) return lower;

  const rounded = Number.isFinite(desired) ? Math.round(desired) : lower;
  return Math.min(upper, Math.max(lower, rounded));
}

/**
 * Position for a new cut: the middle of the widest piece, or null when no piece
 * is large enough to divide again.
 */
export function suggestCutPosition(
  cuts: readonly number[],
  total: number,
  gutter: number,
  margin: number
): number | null {
  const slices = slicesFromCuts(total, cuts, gutter, margin, 'horizontal');
  let widest = slices[0];
  for (const slice of slices) {
    if (slice.size > widest.size) widest = slice;
  }

  // The piece must still hold two pieces and the discarded band between them.
  if (widest.size < gutter + 2) return null;
  return widest.start + Math.round((widest.size - gutter) / 2);
}

export function getSplitExtension(type: string): string {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  return 'png';
}

export function getSplitFilename(
  sourceName: string,
  tile: SplitTile,
  extension: string,
  grid: { rows: number; cols: number }
): string {
  const base = sourceName.replace(/\.[^./\\]+$/, '').trim() || 'image';
  const position =
    grid.rows === 1 || grid.cols === 1
      ? String(tile.index + 1)
      : `r${tile.row + 1}-c${tile.col + 1}`;
  return `${base}-${position}.${extension}`;
}
