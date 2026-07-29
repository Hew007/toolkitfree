import { rotatePdfPage, type PdfPageRotation } from './pdf-page-tools.ts';

export type PdfPageSize = 'a4' | 'letter' | 'fit';
export type PdfOrientation = 'portrait' | 'landscape';
export type PdfInputKind = 'images' | 'jpeg' | 'png';

export interface PdfPreset {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  margin: number;
  inputKind: PdfInputKind;
}

export const PDF_PAGE_SIZES = {
  a4: { width: 210, height: 297, label: 'A4 (210x297mm)' },
  letter: { width: 215.9, height: 279.4, label: 'Letter (8.5x11")' },
} as const;

export const PDF_PRESETS = {
  default: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
  jpg: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'jpeg' },
  png: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'png' },
  a4: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
  multiple: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
  no_margin: { pageSize: 'fit', orientation: 'portrait', margin: 0, inputKind: 'images' },
  photo: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
} as const satisfies Record<string, PdfPreset>;

export type PdfPresetKey = keyof typeof PDF_PRESETS;

export const PDF_VARIANT_PRESETS = {
  'jpg-to-pdf': 'jpg',
  'png-to-pdf': 'png',
  'image-to-a4-pdf': 'a4',
  'multiple-images-to-pdf': 'multiple',
  'image-to-pdf-no-margin': 'no_margin',
  'photo-to-pdf': 'photo',
} as const satisfies Record<string, PdfPresetKey>;

export type PdfVariantSlug = keyof typeof PDF_VARIANT_PRESETS;

export const PDF_INPUT_TYPES: Record<PdfInputKind, readonly string[]> = {
  images: ['image/jpeg', 'image/png', 'image/webp'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
};

export interface PdfPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculatePdfPlacement(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  margin: number
): PdfPlacement {
  if (
    ![pageWidth, pageHeight, imageWidth, imageHeight].every(
      (value) => Number.isFinite(value) && value > 0
    )
  ) {
    throw new Error('Page and image dimensions must be greater than zero.');
  }
  if (!Number.isFinite(margin) || margin < 0) {
    throw new Error('Margin must be zero or greater.');
  }

  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('Margin leaves no drawable page area.');
  }

  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: margin + (availableWidth - width) / 2,
    y: margin + (availableHeight - height) / 2,
    width,
    height,
  };
}

export function pixelsToMillimeters(pixels: number): number {
  if (!Number.isFinite(pixels) || pixels <= 0) {
    throw new Error('Pixel dimension must be greater than zero.');
  }
  return pixels * (25.4 / 96);
}

/* ------------------------------------------------------------------ *
 * WYSIWYG layout model
 *
 * All geometry below is in millimetres, page-relative, with the origin
 * at the page's top-left corner. Keeping it pure and unit-free of DOM
 * concerns is what lets `scripts/validate-secondary-tools.mjs` cover it.
 * ------------------------------------------------------------------ */

/** Rotation shares the PDF splitter's quarter-turn type and stepping helper. */
export type { PdfPageRotation };
export type PdfScaleHandle = 'nw' | 'ne' | 'sw' | 'se';
export type PdfFitMode = 'fit' | 'fill' | 'actual';

export interface PdfPageGeometry {
  width: number;
  height: number;
}

/** The minimum on-page footprint we allow, so an image can never be scaled away. */
export const MIN_PLACEMENT_MM = 5;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Aspect ratio after a quarter turn; 90/270 swap width and height. */
export function rotatedAspect(
  naturalWidth: number,
  naturalHeight: number,
  rotation: PdfPageRotation
): number {
  if (
    ![naturalWidth, naturalHeight].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(rotation)
  ) {
    throw new Error('Image dimensions must be greater than zero.');
  }
  return rotation % 180 === 0 ? naturalWidth / naturalHeight : naturalHeight / naturalWidth;
}

/**
 * Groups items into pages. A page starts at every item flagged `startsNewPage`;
 * the first renderable item always starts one regardless of its flag.
 * Items that failed to decode carry no size and are skipped entirely.
 */
export function derivePdfPages<T extends { startsNewPage: boolean; renderable: boolean }>(
  items: readonly T[]
): T[][] {
  const pages: T[][] = [];
  for (const item of items) {
    if (!item.renderable) continue;
    if (pages.length === 0 || item.startsNewPage) pages.push([item]);
    else pages[pages.length - 1].push(item);
  }
  return pages;
}

/**
 * Default placement for every image on a page. One image reuses the existing
 * contain-and-centre maths; several are packed into a near-square grid, each
 * contained and centred inside its own cell.
 */
export function autoArrangePage(
  page: PdfPageGeometry,
  margin: number,
  aspects: readonly number[]
): PdfPlacement[] {
  if (aspects.length === 0) return [];
  // `calculatePdfPlacement` only cares about the image's ratio, so (aspect, 1)
  // stands in for its pixel dimensions and we inherit its validation for free.
  if (aspects.length === 1) {
    return [calculatePdfPlacement(page.width, page.height, aspects[0], 1, margin)];
  }

  const columns = Math.ceil(Math.sqrt(aspects.length));
  const rows = Math.ceil(aspects.length / columns);
  const availableWidth = page.width - margin * 2;
  const availableHeight = page.height - margin * 2;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('Margin leaves no drawable page area.');
  }

  const gap = Math.min(4, availableWidth / (columns * 4), availableHeight / (rows * 4));
  const cellWidth = (availableWidth - gap * (columns - 1)) / columns;
  const cellHeight = (availableHeight - gap * (rows - 1)) / rows;

  return aspects.map((aspect, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cell = calculatePdfPlacement(cellWidth, cellHeight, aspect, 1, 0);
    return {
      x: margin + column * (cellWidth + gap) + cell.x,
      y: margin + row * (cellHeight + gap) + cell.y,
      width: cell.width,
      height: cell.height,
    };
  });
}

/** Moves a placement, keeping at least a sliver of it on the page. */
export function movePlacement(
  start: PdfPlacement,
  deltaX: number,
  deltaY: number,
  page: PdfPageGeometry
): PdfPlacement {
  const keep = Math.min(MIN_PLACEMENT_MM, start.width, start.height);
  return {
    ...start,
    x: clamp(start.x + deltaX, keep - start.width, page.width - keep),
    y: clamp(start.y + deltaY, keep - start.height, page.height - keep),
  };
}

/**
 * Uniform, aspect-locked scale anchored on the corner opposite `handle`.
 * The drag delta is projected onto the width axis so the pointer stays
 * predictable regardless of which corner is grabbed.
 */
export function scalePlacement(
  start: PdfPlacement,
  handle: PdfScaleHandle,
  deltaX: number,
  deltaY: number,
  aspect: number,
  page: PdfPageGeometry,
  minimumSize: number = MIN_PLACEMENT_MM
): PdfPlacement {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error('Aspect ratio must be greater than zero.');
  }
  const anchorX = handle === 'nw' || handle === 'sw' ? start.x + start.width : start.x;
  const anchorY = handle === 'nw' || handle === 'ne' ? start.y + start.height : start.y;
  const directionX = handle === 'ne' || handle === 'se' ? 1 : -1;
  const directionY = handle === 'sw' || handle === 'se' ? 1 : -1;

  // Let the axis the pointer actually moved along drive the size. Averaging the
  // two would make a purely horizontal drag track at half speed.
  const widthFromX = start.width + deltaX * directionX;
  const widthFromY = (start.height + deltaY * directionY) * aspect;
  const maximum = Math.max(page.width, page.height) * 4;
  const width = clamp(
    Math.abs(deltaX) >= Math.abs(deltaY) ? widthFromX : widthFromY,
    minimumSize,
    maximum
  );
  const height = width / aspect;

  return {
    width,
    height,
    x: directionX === 1 ? anchorX : anchorX - width,
    y: directionY === 1 ? anchorY : anchorY - height,
  };
}

/** Quarter-turn about the placement's centre, then clamped back onto the page. */
export function rotatePlacementBy(
  start: PdfPlacement,
  rotation: PdfPageRotation,
  delta: -90 | 90,
  page: PdfPageGeometry
): { placement: PdfPlacement; rotation: PdfPageRotation } {
  const centerX = start.x + start.width / 2;
  const centerY = start.y + start.height / 2;
  const swapped: PdfPlacement = {
    width: start.height,
    height: start.width,
    x: centerX - start.height / 2,
    y: centerY - start.width / 2,
  };
  return {
    placement: movePlacement(swapped, 0, 0, page),
    rotation: rotatePdfPage(rotation, delta),
  };
}

/** Placement for the Fit page / Fill page / Actual size shortcuts. */
export function fitPlacement(
  page: PdfPageGeometry,
  aspect: number,
  margin: number,
  mode: PdfFitMode,
  naturalWidth?: number,
  naturalHeight?: number
): PdfPlacement {
  if (mode === 'fit') return calculatePdfPlacement(page.width, page.height, aspect, 1, margin);

  if (mode === 'fill') {
    const scale = Math.max(page.width / aspect, page.height);
    const width = aspect * scale;
    const height = scale;
    return { width, height, x: (page.width - width) / 2, y: (page.height - height) / 2 };
  }

  if (!naturalWidth || !naturalHeight) {
    throw new Error('Actual size needs the natural pixel dimensions.');
  }
  // Respect the rotation already baked into `aspect` rather than the raw pixels.
  const longEdge = pixelsToMillimeters(Math.max(naturalWidth, naturalHeight));
  const width = aspect >= 1 ? longEdge : longEdge * aspect;
  const height = width / aspect;
  return { width, height, x: (page.width - width) / 2, y: (page.height - height) / 2 };
}
