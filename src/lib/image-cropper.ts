export const CROP_ASPECT_PRESETS = {
  free: { ratio: null, label: 'Free' },
  square: { ratio: 1, label: '1:1' },
  widescreen: { ratio: 16 / 9, label: '16:9' },
  standard: { ratio: 4 / 3, label: '4:3' },
  photo: { ratio: 3 / 2, label: '3:2' },
  portrait: { ratio: 9 / 16, label: '9:16' },
} as const;

export type CropAspectPresetKey = keyof typeof CROP_ASPECT_PRESETS;
export type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface CropBounds {
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CROPPER_VARIANT_PRESETS = {
  'crop-to-square': 'square',
  'crop-to-16-9': 'widescreen',
  'crop-to-4-3': 'standard',
  'crop-to-3-2': 'photo',
  'free-crop': 'free',
} as const satisfies Record<string, CropAspectPresetKey>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function validBounds(bounds: CropBounds): CropBounds {
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new Error('Crop bounds must be greater than zero.');
  }
  return bounds;
}

export function createInitialCropRect(bounds: CropBounds, ratio: number | null): CropRect {
  validBounds(bounds);
  if (ratio === null) {
    return { x: 0, y: 0, width: bounds.width, height: bounds.height };
  }
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error('Aspect ratio must be greater than zero.');
  }

  const width = Math.min(bounds.width, bounds.height * ratio);
  const height = width / ratio;
  return {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height,
  };
}

export function moveCropRect(
  start: CropRect,
  dx: number,
  dy: number,
  bounds: CropBounds
): CropRect {
  validBounds(bounds);
  return {
    ...start,
    x: clamp(start.x + dx, 0, Math.max(0, bounds.width - start.width)),
    y: clamp(start.y + dy, 0, Math.max(0, bounds.height - start.height)),
  };
}

function fitRatioSize(
  desiredWidth: number,
  desiredHeight: number,
  ratio: number,
  maxWidth: number,
  maxHeight: number,
  minimumSize: number
): { width: number; height: number } {
  const boundedMaxWidth = Math.max(1, Math.min(maxWidth, maxHeight * ratio));
  const minimumWidth = Math.min(boundedMaxWidth, Math.max(minimumSize, minimumSize * ratio));
  const widthFromHeight = desiredHeight * ratio;
  const preferredWidth =
    Math.abs(desiredWidth - boundedMaxWidth) >= Math.abs(widthFromHeight - boundedMaxWidth)
      ? desiredWidth
      : widthFromHeight;
  const width = clamp(preferredWidth, minimumWidth, boundedMaxWidth);
  return { width, height: width / ratio };
}

function resizeWithRatio(
  start: CropRect,
  handle: Exclude<CropHandle, 'move'>,
  dx: number,
  dy: number,
  bounds: CropBounds,
  ratio: number,
  minimumSize: number
): CropRect {
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const centerX = start.x + start.width / 2;
  const centerY = start.y + start.height / 2;

  if (handle === 'n' || handle === 's') {
    const anchorY = handle === 'n' ? bottom : start.y;
    const desiredHeight = handle === 'n' ? start.height - dy : start.height + dy;
    const maxHeight = handle === 'n' ? anchorY : bounds.height - anchorY;
    const maxWidth = 2 * Math.min(centerX, bounds.width - centerX);
    const size = fitRatioSize(
      desiredHeight * ratio,
      desiredHeight,
      ratio,
      maxWidth,
      maxHeight,
      minimumSize
    );
    return {
      x: centerX - size.width / 2,
      y: handle === 'n' ? anchorY - size.height : anchorY,
      ...size,
    };
  }

  if (handle === 'e' || handle === 'w') {
    const anchorX = handle === 'w' ? right : start.x;
    const desiredWidth = handle === 'w' ? start.width - dx : start.width + dx;
    const maxWidth = handle === 'w' ? anchorX : bounds.width - anchorX;
    const maxHeight = 2 * Math.min(centerY, bounds.height - centerY);
    const size = fitRatioSize(
      desiredWidth,
      desiredWidth / ratio,
      ratio,
      maxWidth,
      maxHeight,
      minimumSize
    );
    return {
      x: handle === 'w' ? anchorX - size.width : anchorX,
      y: centerY - size.height / 2,
      ...size,
    };
  }

  const anchorX = handle.includes('w') ? right : start.x;
  const anchorY = handle.includes('n') ? bottom : start.y;
  const desiredWidth = handle.includes('w') ? start.width - dx : start.width + dx;
  const desiredHeight = handle.includes('n') ? start.height - dy : start.height + dy;
  const maxWidth = handle.includes('w') ? anchorX : bounds.width - anchorX;
  const maxHeight = handle.includes('n') ? anchorY : bounds.height - anchorY;
  const size = fitRatioSize(desiredWidth, desiredHeight, ratio, maxWidth, maxHeight, minimumSize);

  return {
    x: handle.includes('w') ? anchorX - size.width : anchorX,
    y: handle.includes('n') ? anchorY - size.height : anchorY,
    ...size,
  };
}

function resizeFree(
  start: CropRect,
  handle: Exclude<CropHandle, 'move'>,
  dx: number,
  dy: number,
  bounds: CropBounds,
  minimumSize: number
): CropRect {
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let left = start.x;
  let top = start.y;
  let nextRight = right;
  let nextBottom = bottom;

  if (handle.includes('w')) left = clamp(start.x + dx, 0, right - minimumSize);
  if (handle.includes('e')) nextRight = clamp(right + dx, start.x + minimumSize, bounds.width);
  if (handle.includes('n')) top = clamp(start.y + dy, 0, bottom - minimumSize);
  if (handle.includes('s')) nextBottom = clamp(bottom + dy, start.y + minimumSize, bounds.height);

  return {
    x: left,
    y: top,
    width: nextRight - left,
    height: nextBottom - top,
  };
}

export function resizeCropRect(
  start: CropRect,
  handle: Exclude<CropHandle, 'move'>,
  dx: number,
  dy: number,
  bounds: CropBounds,
  ratio: number | null,
  minimumSize = 10
): CropRect {
  validBounds(bounds);
  const feasibleMinimum = Math.max(1, Math.min(minimumSize, bounds.width, bounds.height));
  if (ratio === null) {
    return resizeFree(start, handle, dx, dy, bounds, feasibleMinimum);
  }
  return resizeWithRatio(start, handle, dx, dy, bounds, ratio, feasibleMinimum);
}

export function toPixelCropRect(rect: CropRect, bounds: CropBounds): CropRect {
  validBounds(bounds);
  const x = clamp(Math.round(rect.x), 0, Math.max(0, Math.round(bounds.width) - 1));
  const y = clamp(Math.round(rect.y), 0, Math.max(0, Math.round(bounds.height) - 1));
  const width = clamp(Math.round(rect.width), 1, Math.round(bounds.width) - x);
  const height = clamp(Math.round(rect.height), 1, Math.round(bounds.height) - y);
  return { x, y, width, height };
}
