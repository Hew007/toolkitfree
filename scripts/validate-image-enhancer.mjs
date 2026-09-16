import assert from 'node:assert/strict';
import {
  adjustmentsEqual,
  buildEnhancerCanvasFilter,
  DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS,
  DEFAULT_IMAGE_ENHANCER_PRESET_ID,
  getEnhancedFilename,
  getEnhancerPreviewSize,
  getImageEnhancerPreset,
  IMAGE_ENHANCER_PRESETS,
  IMAGE_ENHANCER_PREVIEW_MAX_PIXELS,
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

// The chips are a projection of this table, so a preset that cannot be applied
// would be a chip that breaks the tool rather than a value nobody notices.
const presetIds = IMAGE_ENHANCER_PRESETS.map((preset) => preset.id);
assert.equal(new Set(presetIds).size, presetIds.length);
assert.equal(presetIds.includes(DEFAULT_IMAGE_ENHANCER_PRESET_ID), true);
for (const preset of IMAGE_ENHANCER_PRESETS) {
  assert.doesNotThrow(() => validateEnhancerAdjustments(preset.adjustments));
  assert.equal(preset.label.length > 0 && preset.summary.length > 0, true);
  assert.equal(getImageEnhancerPreset(preset.id), preset);
}
// Every slider in the fine-tune panel is reachable from some preset, so no
// control is left with nothing above it that ever writes to it.
for (const key of ['brightness', 'contrast', 'saturation', 'sharpness', 'blur']) {
  assert.equal(
    IMAGE_ENHANCER_PRESETS.some((preset) => preset.adjustments[key] !== 0),
    true,
    `No preset moves ${key}`
  );
}
assert.equal(
  IMAGE_ENHANCER_PRESETS.some((preset) => preset.adjustments.grayscale),
  true
);
assert.throws(() => getImageEnhancerPreset('nope'), RangeError);
assert.equal(
  adjustmentsEqual(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS, { ...DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS }),
  true
);
assert.equal(
  adjustmentsEqual(DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS, {
    ...DEFAULT_IMAGE_ENHANCER_ADJUSTMENTS,
    blur: 1,
  }),
  false
);

// The preview is what a slider drag repaints, so its size is the cost of
// dragging: it may shrink to the column, never grow past the source, and never
// exceed the area budget whatever shape the source is.
assert.deepEqual(getEnhancerPreviewSize(120, 60, 700), { width: 120, height: 60 });
assert.deepEqual(getEnhancerPreviewSize(3000, 2000, 700), { width: 700, height: 467 });
assert.deepEqual(getEnhancerPreviewSize(3000, 2000, 0), { width: 1342, height: 894 });
const panorama = getEnhancerPreviewSize(1000, 20000, 700);
assert.deepEqual(panorama, { width: 245, height: 4899 });
assert.equal(panorama.width * panorama.height <= IMAGE_ENHANCER_PREVIEW_MAX_PIXELS * 1.01, true);
assert.throws(() => getEnhancerPreviewSize(0, 10, 700), RangeError);
assert.throws(() => getEnhancerPreviewSize(10, 10, 700, 0), RangeError);

console.log(
  JSON.stringify({
    status: 'IMAGE_ENHANCER_ALGORITHM_OK',
    filterChecks: 3,
    sharpeningChecks: 6,
    filenameChecks: 2,
    presetChecks: IMAGE_ENHANCER_PRESETS.length,
    previewSizeChecks: 6,
  })
);
