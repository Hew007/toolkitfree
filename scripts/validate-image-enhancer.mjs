import assert from 'node:assert/strict';
import {
  buildEnhancerCanvasFilter,
  DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS,
  getEnhancedFilename,
  sharpenRgbaPixels,
  validateEnhancerAdjustments,
} from '../src/lib/image-enhancer.ts';

assert.equal(
  buildEnhancerCanvasFilter({
    brightness: 10,
    contrast: -20,
    saturation: 30,
    sharpness: 50,
    blur: 2,
    grayscale: true,
  }),
  'brightness(1.1) contrast(0.8) saturate(1.3) grayscale(1) blur(2px)'
);
assert.equal(
  buildEnhancerCanvasFilter(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS),
  'brightness(1) contrast(1) saturate(1)'
);
assert.throws(
  () => validateEnhancerAdjustments({ ...DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS, blur: 21 }),
  RangeError
);

const pixels = new Uint8ClampedArray(3 * 3 * 4);
for (let pixel = 0; pixel < 9; pixel += 1) {
  const offset = pixel * 4;
  pixels[offset] = 10;
  pixels[offset + 1] = 10;
  pixels[offset + 2] = 10;
  pixels[offset + 3] = 255;
}
const center = (1 * 3 + 1) * 4;
pixels[center] = 20;
pixels[center + 1] = 20;
pixels[center + 2] = 20;

const fullySharpened = sharpenRgbaPixels(pixels, 3, 3, 100);
assert.deepEqual([...fullySharpened.slice(center, center + 4)], [60, 60, 60, 255]);
assert.deepEqual([...fullySharpened.slice(0, 4)], [10, 10, 10, 255]);
assert.notEqual(fullySharpened, pixels);

const partiallySharpened = sharpenRgbaPixels(pixels, 3, 3, 50);
assert.deepEqual([...partiallySharpened.slice(center, center + 4)], [40, 40, 40, 255]);
assert.deepEqual(sharpenRgbaPixels(pixels, 3, 3, 0), pixels);
assert.throws(() => sharpenRgbaPixels(pixels, 2, 3, 50), RangeError);

assert.equal(getEnhancedFilename('holiday.photo.png', 'image/jpeg'), 'holiday.photo-enhanced.jpg');
assert.equal(getEnhancedFilename('<bad>.png', 'image/webp'), 'bad--enhanced.webp');

console.log(
  JSON.stringify({
    status: 'IMAGE_ENHANCER_ALGORITHM_OK',
    filterChecks: 3,
    sharpeningChecks: 6,
    filenameChecks: 2,
  })
);
