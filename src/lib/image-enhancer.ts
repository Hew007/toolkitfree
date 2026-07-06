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
