import type { IdPhotoDimension, IdPhotoLengthUnit } from '../data/id-photo-presets.ts';

export type IdPhotoGeometryErrorCode =
  | 'INVALID_LENGTH'
  | 'INVALID_DPI'
  | 'INVALID_RATIO'
  | 'INVALID_MARGIN'
  | 'INVALID_GAP'
  | 'PHOTO_DOES_NOT_FIT';

export class IdPhotoGeometryError extends Error {
  readonly code: IdPhotoGeometryErrorCode;

  constructor(code: IdPhotoGeometryErrorCode, message: string) {
    super(message);
    this.name = 'IdPhotoGeometryError';
    this.code = code;
  }
}

export interface PixelSize {
  width: number;
  height: number;
}

export interface SourceSize {
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintLayoutItem {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrintLayout {
  paper: PixelSize;
  photo: PixelSize;
  columns: number;
  rows: number;
  count: number;
  items: PrintLayoutItem[];
}

const MILLIMETERS_PER_INCH = 25.4;

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new IdPhotoGeometryError('INVALID_LENGTH', `${label} must be greater than zero.`);
  }
  return value;
}

function requireNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new IdPhotoGeometryError('INVALID_LENGTH', `${label} must be zero or greater.`);
  }
  return value;
}

function requireDpi(dpi: number): number {
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new IdPhotoGeometryError('INVALID_DPI', 'DPI must be greater than zero.');
  }
  return dpi;
}

export function convertLength(
  value: number,
  from: IdPhotoLengthUnit,
  to: IdPhotoLengthUnit,
  dpi: number
): number {
  requireNonNegative(value, 'Length');
  requireDpi(dpi);
  if (from === to) return value;

  const inches = from === 'in' ? value : from === 'mm' ? value / MILLIMETERS_PER_INCH : value / dpi;
  if (to === 'in') return inches;
  if (to === 'mm') return inches * MILLIMETERS_PER_INCH;
  return inches * dpi;
}

export function calculatePixelSize(
  width: IdPhotoDimension,
  height: IdPhotoDimension,
  dpi: number
): PixelSize {
  requirePositive(width.value, 'Width');
  requirePositive(height.value, 'Height');
  return {
    width: Math.max(1, Math.round(convertLength(width.value, width.unit, 'px', dpi))),
    height: Math.max(1, Math.round(convertLength(height.value, height.unit, 'px', dpi))),
  };
}

export function calculateCenteredCrop(source: SourceSize, targetRatio: number): CropRect {
  requirePositive(source.width, 'Source width');
  requirePositive(source.height, 'Source height');
  if (!Number.isFinite(targetRatio) || targetRatio <= 0) {
    throw new IdPhotoGeometryError('INVALID_RATIO', 'Target ratio must be greater than zero.');
  }

  const sourceRatio = source.width / source.height;
  if (sourceRatio > targetRatio) {
    const width = source.height * targetRatio;
    return {
      x: (source.width - width) / 2,
      y: 0,
      width,
      height: source.height,
    };
  }

  const height = source.width / targetRatio;
  return {
    x: 0,
    y: (source.height - height) / 2,
    width: source.width,
    height,
  };
}

export function calculateHeadHeightRange(
  photoHeightMm: number,
  headHeightMm: { min: number; max: number }
): { minRatio: number; maxRatio: number } {
  requirePositive(photoHeightMm, 'Photo height');
  requirePositive(headHeightMm.min, 'Minimum head height');
  requirePositive(headHeightMm.max, 'Maximum head height');
  if (headHeightMm.min > headHeightMm.max || headHeightMm.max > photoHeightMm) {
    throw new IdPhotoGeometryError(
      'INVALID_LENGTH',
      'Head height range must fit within the photo height.'
    );
  }
  return {
    minRatio: headHeightMm.min / photoHeightMm,
    maxRatio: headHeightMm.max / photoHeightMm,
  };
}

function dimensionToMillimeters(dimension: IdPhotoDimension, dpi: number): number {
  requirePositive(dimension.value, 'Dimension');
  return convertLength(dimension.value, dimension.unit, 'mm', dpi);
}

export function calculatePrintLayout(input: {
  paperWidth: IdPhotoDimension;
  paperHeight: IdPhotoDimension;
  photoWidth: IdPhotoDimension;
  photoHeight: IdPhotoDimension;
  dpi: number;
  marginMm?: number;
  gapMm?: number;
}): PrintLayout {
  const dpi = requireDpi(input.dpi);
  const marginMm = input.marginMm ?? 0;
  const gapMm = input.gapMm ?? 0;
  if (!Number.isFinite(marginMm) || marginMm < 0) {
    throw new IdPhotoGeometryError('INVALID_MARGIN', 'Margin must be zero or greater.');
  }
  if (!Number.isFinite(gapMm) || gapMm < 0) {
    throw new IdPhotoGeometryError('INVALID_GAP', 'Gap must be zero or greater.');
  }

  const paperWidthMm = dimensionToMillimeters(input.paperWidth, dpi);
  const paperHeightMm = dimensionToMillimeters(input.paperHeight, dpi);
  const photoWidthMm = dimensionToMillimeters(input.photoWidth, dpi);
  const photoHeightMm = dimensionToMillimeters(input.photoHeight, dpi);
  const usableWidthMm = paperWidthMm - marginMm * 2;
  const usableHeightMm = paperHeightMm - marginMm * 2;
  if (usableWidthMm <= 0 || usableHeightMm <= 0) {
    throw new IdPhotoGeometryError('INVALID_MARGIN', 'Margins leave no printable area.');
  }

  const columns = Math.floor((usableWidthMm + gapMm + 1e-9) / (photoWidthMm + gapMm));
  const rows = Math.floor((usableHeightMm + gapMm + 1e-9) / (photoHeightMm + gapMm));
  if (columns < 1 || rows < 1) {
    throw new IdPhotoGeometryError('PHOTO_DOES_NOT_FIT', 'The photo does not fit on the paper.');
  }

  const gridWidthMm = columns * photoWidthMm + (columns - 1) * gapMm;
  const gridHeightMm = rows * photoHeightMm + (rows - 1) * gapMm;
  const startXmm = (paperWidthMm - gridWidthMm) / 2;
  const startYmm = (paperHeightMm - gridHeightMm) / 2;
  const photo = calculatePixelSize(input.photoWidth, input.photoHeight, dpi);
  const items: PrintLayoutItem[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const xMm = startXmm + column * (photoWidthMm + gapMm);
      const yMm = startYmm + row * (photoHeightMm + gapMm);
      items.push({
        xMm,
        yMm,
        widthMm: photoWidthMm,
        heightMm: photoHeightMm,
        x: Math.round(convertLength(xMm, 'mm', 'px', dpi)),
        y: Math.round(convertLength(yMm, 'mm', 'px', dpi)),
        width: photo.width,
        height: photo.height,
      });
    }
  }

  return {
    paper: calculatePixelSize(input.paperWidth, input.paperHeight, dpi),
    photo,
    columns,
    rows,
    count: items.length,
    items,
  };
}
