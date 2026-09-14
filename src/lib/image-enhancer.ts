import { normalizeDownloadFilename, type ImageOutputMimeType } from './image-processing.ts';

export interface ImageEnhancerAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  blur: number;
  grayscale: boolean;
}

export const DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS: ImageEnhancerAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  blur: 0,
  grayscale: false,
};

function assertRange(label: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
}

export function validateEnhancerAdjustments(adjustments: ImageEnhancerAdjustments): void {
  assertRange('Brightness', adjustments.brightness, -100, 100);
  assertRange('Contrast', adjustments.contrast, -100, 100);
  assertRange('Saturation', adjustments.saturation, -100, 100);
  assertRange('Sharpness', adjustments.sharpness, 0, 100);
  assertRange('Blur', adjustments.blur, 0, 20);
}

export function buildEnhancerCanvasFilter(adjustments: ImageEnhancerAdjustments): string {
  validateEnhancerAdjustments(adjustments);
  return [
    `brightness(${1 + adjustments.brightness / 100})`,
    `contrast(${1 + adjustments.contrast / 100})`,
    `saturate(${1 + adjustments.saturation / 100})`,
    adjustments.grayscale ? 'grayscale(1)' : '',
    adjustments.blur > 0 ? `blur(${adjustments.blur}px)` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function sharpenRgbaPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number
): Uint8ClampedArray<ArrayBuffer> {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new RangeError('Image dimensions must be positive integers.');
  }
  if (pixels.length !== width * height * 4) {
    throw new RangeError('RGBA data length does not match the image dimensions.');
  }
  assertRange('Sharpness', strength, 0, 100);

  const output = new Uint8ClampedArray(pixels.length);
  output.set(pixels);
  if (strength === 0 || width < 3 || height < 3) return output;

  const amount = strength / 100;
  const rowStride = width * 4;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixel = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const index = pixel + channel;
        const center = pixels[index];
        const neighbors =
          pixels[index - rowStride] +
          pixels[index + rowStride] +
          pixels[index - 4] +
          pixels[index + 4];
        const sharpened = center * 5 - neighbors;
        output[index] = center + (sharpened - center) * amount;
      }
      output[pixel + 3] = pixels[pixel + 3];
    }
  }
  return output;
}

const EXTENSIONS: Record<ImageOutputMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function getEnhancedFilename(sourceName: string, outputType: ImageOutputMimeType): string {
  const baseName = sourceName.replace(/\.[^.]+$/, '') || 'image';
  return normalizeDownloadFilename(`${baseName}-enhanced.${EXTENSIONS[outputType]}`);
}

/**
 * The corrections the chips offer, and the only place their numbers are written.
 *
 * Each preset is a complete set of adjustments, so choosing one is a single
 * answer to "which correction" rather than six separate decisions. The chip row
 * is a projection of this table and the fine-tune panel edits the same values,
 * so a label cannot drift away from what it applies. Every slider the panel
 * exposes is reached by at least one preset, blur included.
 */
export type ImageEnhancerPresetId = 'original' | 'photo' | 'lowlight' | 'scan' | 'bw' | 'soft';

export interface ImageEnhancerPreset {
  id: ImageEnhancerPresetId;
  label: string;
  /** One short line for the chip. Says what the correction does, not that it exists. */
  summary: string;
  adjustments: ImageEnhancerAdjustments;
}

export const IMAGE_ENHANCER_PRESETS: readonly ImageEnhancerPreset[] = [
  {
    id: 'original',
    label: 'Original',
    summary: 'Keep the image as it is',
    adjustments: DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS,
  },
  {
    id: 'photo',
    label: 'Photo boost',
    summary: 'Lift a flat phone photo',
    adjustments: {
      brightness: 8,
      contrast: 12,
      saturation: 12,
      sharpness: 25,
      blur: 0,
      grayscale: false,
    },
  },
  {
    id: 'lowlight',
    label: 'Low light',
    summary: 'Open up an underexposed shot',
    adjustments: {
      brightness: 30,
      contrast: 8,
      saturation: 6,
      sharpness: 15,
      blur: 0,
      grayscale: false,
    },
  },
  {
    id: 'scan',
    label: 'Document scan',
    summary: 'Cleaner paper, harder text',
    adjustments: {
      brightness: 10,
      contrast: 35,
      saturation: -40,
      sharpness: 55,
      blur: 0,
      grayscale: false,
    },
  },
  {
    id: 'bw',
    label: 'Black and white',
    summary: 'Grayscale with a contrast lift',
    adjustments: {
      brightness: 4,
      contrast: 18,
      saturation: 0,
      sharpness: 15,
      blur: 0,
      grayscale: true,
    },
  },
  {
    id: 'soft',
    label: 'Soften',
    summary: 'Ease harsh detail and noise',
    adjustments: {
      brightness: 3,
      contrast: 0,
      saturation: 4,
      sharpness: 0,
      blur: 1,
      grayscale: false,
    },
  },
];

export const DEFAULT_IMAGE_ENHANCER_PRESET_ID: ImageEnhancerPresetId = 'original';

export function getImageEnhancerPreset(id: ImageEnhancerPresetId): ImageEnhancerPreset {
  const preset = IMAGE_ENHANCER_PRESETS.find((entry) => entry.id === id);
  if (!preset) throw new RangeError(`Unknown image enhancer preset: ${id}`);
  return preset;
}

export function adjustmentsEqual(
  left: ImageEnhancerAdjustments,
  right: ImageEnhancerAdjustments
): boolean {
  return (
    left.brightness === right.brightness &&
    left.contrast === right.contrast &&
    left.saturation === right.saturation &&
    left.sharpness === right.sharpness &&
    left.blur === right.blur &&
    left.grayscale === right.grayscale
  );
}

/**
 * How many pixels the on-screen preview is allowed to be.
 *
 * The preview is redrawn on every slider movement and the sharpening pass walks
 * every pixel in JavaScript, so the preview's size is the cost of dragging.
 * Fitting the column width alone is not enough: a tall panorama scaled to a
 * 700 px column is still several megapixels. Capping the area as well is what
 * keeps a drag smooth whatever shape the source is.
 */
export const IMAGE_ENHANCER_PREVIEW_MAX_PIXELS = 1_200_000;

/**
 * The size to draw the preview at: never wider than the space it has, never
 * larger in area than the cap, and never larger than the source itself —
 * upscaling would add pixels to sharpen without adding detail to see.
 */
export function getEnhancerPreviewSize(
  sourceWidth: number,
  sourceHeight: number,
  availableWidth: number,
  maxPixels: number = IMAGE_ENHANCER_PREVIEW_MAX_PIXELS
): { width: number; height: number } {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    throw new RangeError('Image dimensions must be positive.');
  }
  if (!Number.isFinite(maxPixels) || maxPixels < 1) {
    throw new RangeError('The preview pixel budget must be positive.');
  }

  let scale = 1;
  if (Number.isFinite(availableWidth) && availableWidth > 0 && availableWidth < sourceWidth) {
    scale = availableWidth / sourceWidth;
  }
  const pixels = sourceWidth * sourceHeight * scale * scale;
  if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
