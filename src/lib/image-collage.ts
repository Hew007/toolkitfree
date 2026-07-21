export type CollageLayoutMode = 'horizontal' | 'vertical' | 'grid';
export type CollageFitMode = 'cover' | 'contain' | 'original';

export interface CollageSource {
  width: number;
  height: number;
}

export interface CollageOptions {
  layout: CollageLayoutMode;
  fit: CollageFitMode;
  columns?: number;
  gap: number;
  margin: number;
  cellWidth: number;
  cellHeight: number;
  borderRadius: number;
  background: string;
}

export interface CollageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollagePlacement {
  sourceIndex: number;
  tile: CollageRect;
  source: CollageRect;
  draw: CollageRect;
}

export interface CollageLayout {
  width: number;
  height: number;
  placements: CollagePlacement[];
}

export const DEFAULT_COLLAGE_OPTIONS: CollageOptions = {
  layout: 'grid',
  fit: 'contain',
  columns: undefined,
  gap: 16,
  margin: 16,
  cellWidth: 360,
  cellHeight: 360,
  borderRadius: 0,
  background: '#ffffff',
};

export function recommendCollageCellSize(
  sources: readonly CollageSource[],
  width = DEFAULT_COLLAGE_OPTIONS.cellWidth
): { width: number; height: number } {
  validateSources(sources);
  const ratios = sources.map((source) => source.width / source.height).sort((a, b) => a - b);
  const middle = Math.floor(ratios.length / 2);
  const medianRatio =
    ratios.length % 2 === 0 ? (ratios[middle - 1] + ratios[middle]) / 2 : ratios[middle];
  return {
    width,
    height: Math.max(160, Math.min(640, Math.round(width / medianRatio))),
  };
}

function positiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function validateSources(sources: readonly CollageSource[]): void {
  if (sources.length === 0) {
    throw new Error('At least one image is required to build a collage.');
  }
  for (const source of sources) {
    if (
      !Number.isSafeInteger(source.width) ||
      !Number.isSafeInteger(source.height) ||
      source.width <= 0 ||
      source.height <= 0
    ) {
      throw new Error('Collage sources must have positive integer dimensions.');
    }
  }
}

function maxDimension(sources: readonly CollageSource[], key: keyof CollageSource): number {
  return Math.max(...sources.map((source) => source[key]));
}

function calculateContainDrawRect(source: CollageSource, tile: CollageRect): CollageRect {
  const scale = Math.min(tile.width / source.width, tile.height / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  return {
    x: tile.x + Math.round((tile.width - width) / 2),
    y: tile.y + Math.round((tile.height - height) / 2),
    width,
    height,
  };
}

function calculateCoverSourceRect(source: CollageSource, tile: CollageRect): CollageRect {
  const sourceRatio = source.width / source.height;
  const tileRatio = tile.width / tile.height;
  if (sourceRatio > tileRatio) {
    const width = Math.max(1, Math.round(source.height * tileRatio));
    return {
      x: Math.round((source.width - width) / 2),
      y: 0,
      width,
      height: source.height,
    };
  }
  const height = Math.max(1, Math.round(source.width / tileRatio));
  return {
    x: 0,
    y: Math.round((source.height - height) / 2),
    width: source.width,
    height,
  };
}

function placementForTile(
  source: CollageSource,
  sourceIndex: number,
  tile: CollageRect,
  fit: CollageFitMode
): CollagePlacement {
  if (fit === 'cover') {
    return {
      sourceIndex,
      tile,
      source: calculateCoverSourceRect(source, tile),
      draw: tile,
    };
  }

  if (fit === 'contain') {
    return {
      sourceIndex,
      tile,
      source: { x: 0, y: 0, width: source.width, height: source.height },
      draw: calculateContainDrawRect(source, tile),
    };
  }

  const draw = {
    x: tile.x + Math.round((tile.width - source.width) / 2),
    y: tile.y + Math.round((tile.height - source.height) / 2),
    width: source.width,
    height: source.height,
  };
  return {
    sourceIndex,
    tile,
    source: { x: 0, y: 0, width: source.width, height: source.height },
    draw,
  };
}

export function calculateCollageLayout(
  sources: readonly CollageSource[],
  options: CollageOptions
): CollageLayout {
  validateSources(sources);
  const gap = nonNegativeInteger(options.gap);
  const margin = nonNegativeInteger(options.margin);
  const fit = options.fit;

  if (options.layout === 'horizontal') {
    const tileHeight =
      fit === 'original'
        ? maxDimension(sources, 'height')
        : positiveInteger(options.cellHeight, 360);
    let cursorX = margin;
    const placements = sources.map((source, sourceIndex) => {
      const tileWidth = fit === 'original' ? source.width : positiveInteger(options.cellWidth, 360);
      const tile = { x: cursorX, y: margin, width: tileWidth, height: tileHeight };
      cursorX += tileWidth + gap;
      return placementForTile(source, sourceIndex, tile, fit);
    });
    return {
      width: cursorX - gap + margin,
      height: margin * 2 + tileHeight,
      placements,
    };
  }

  if (options.layout === 'vertical') {
    const tileWidth =
      fit === 'original' ? maxDimension(sources, 'width') : positiveInteger(options.cellWidth, 360);
    let cursorY = margin;
    const placements = sources.map((source, sourceIndex) => {
      const tileHeight =
        fit === 'original' ? source.height : positiveInteger(options.cellHeight, 360);
      const tile = { x: margin, y: cursorY, width: tileWidth, height: tileHeight };
      cursorY += tileHeight + gap;
      return placementForTile(source, sourceIndex, tile, fit);
    });
    return {
      width: margin * 2 + tileWidth,
      height: cursorY - gap + margin,
      placements,
    };
  }

  const columns = Math.min(
    sources.length,
    options.columns ? positiveInteger(options.columns, 1) : Math.ceil(Math.sqrt(sources.length))
  );
  const rows = Math.ceil(sources.length / columns);
  const cellWidth =
    fit === 'original' ? maxDimension(sources, 'width') : positiveInteger(options.cellWidth, 360);
  const cellHeight =
    fit === 'original' ? maxDimension(sources, 'height') : positiveInteger(options.cellHeight, 360);
  const placements = sources.map((source, sourceIndex) => {
    const column = sourceIndex % columns;
    const row = Math.floor(sourceIndex / columns);
    const tile = {
      x: margin + column * (cellWidth + gap),
      y: margin + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
    };
    return placementForTile(source, sourceIndex, tile, fit);
  });
  return {
    width: margin * 2 + columns * cellWidth + (columns - 1) * gap,
    height: margin * 2 + rows * cellHeight + (rows - 1) * gap,
    placements,
  };
}

export function getCollageFilename(type: string): string {
  const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
  return `toolkitfree-collage.${extension}`;
}
