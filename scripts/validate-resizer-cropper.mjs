import assert from 'node:assert/strict';
import {
  RESIZE_PRESETS,
  RESIZER_VARIANT_PRESETS,
  calculateResizeDimensions,
} from '../src/lib/image-resizer.ts';
import {
  CROP_ASPECT_PRESETS,
  CROPPER_VARIANT_PRESETS,
  createInitialCropRect,
  moveCropRect,
  resizeCropRect,
  toPixelCropRect,
} from '../src/lib/image-cropper.ts';

const expectedResizerVariants = {
  'resize-for-instagram': [1080, 1080],
  'resize-for-facebook': [820, 312],
  'resize-for-twitter': [1500, 500],
  'resize-for-youtube': [1280, 720],
  'resize-for-linkedin': [1200, 627],
  'resize-for-tiktok': [1080, 1920],
  'resize-to-1920x1080': [1920, 1080],
};

for (const [slug, dimensions] of Object.entries(expectedResizerVariants)) {
  const preset = RESIZE_PRESETS[RESIZER_VARIANT_PRESETS[slug]];
  assert.deepEqual([preset.width, preset.height], dimensions, slug);
}

assert.deepEqual(
  calculateResizeDimensions(
    { width: 4000, height: 3000 },
    { width: 1920, height: 1080 },
    true
  ),
  { width: 1440, height: 1080 }
);
assert.deepEqual(
  calculateResizeDimensions(
    { width: 4000, height: 3000 },
    { width: 1920, height: 1080 },
    false
  ),
  { width: 1920, height: 1080 }
);
assert.deepEqual(
  calculateResizeDimensions(
    { width: 2, height: 1 },
    { width: 1, height: 1 },
    true
  ),
  { width: 1, height: 1 }
);
assert.throws(
  () =>
    calculateResizeDimensions(
      { width: 0, height: 100 },
      { width: 100, height: 100 },
      true
    ),
  /Source width/
);

const bounds = { width: 1200, height: 800 };
const expectedCropRatios = {
  'crop-to-square': 1,
  'crop-to-16-9': 16 / 9,
  'crop-to-4-3': 4 / 3,
  'crop-to-3-2': 3 / 2,
  'free-crop': null,
};

for (const [slug, expectedRatio] of Object.entries(expectedCropRatios)) {
  const preset = CROP_ASPECT_PRESETS[CROPPER_VARIANT_PRESETS[slug]];
  assert.equal(preset.ratio, expectedRatio, slug);
  const rect = createInitialCropRect(bounds, preset.ratio);
  assert.equal(rect.x >= 0 && rect.y >= 0, true);
  assert.equal(rect.x + rect.width <= bounds.width, true);
  assert.equal(rect.y + rect.height <= bounds.height, true);
  if (expectedRatio !== null) {
    assert.equal(Math.abs(rect.width / rect.height - expectedRatio) < 1e-10, true);
  }
}

const moved = moveCropRect(
  { x: 100, y: 100, width: 400, height: 300 },
  1000,
  -1000,
  bounds
);
assert.deepEqual(moved, { x: 800, y: 0, width: 400, height: 300 });

const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
let geometryChecks = 0;
for (const ratio of [null, 1, 16 / 9, 4 / 3, 3 / 2, 9 / 16]) {
  const start = createInitialCropRect(bounds, ratio);
  for (const handle of handles) {
    for (const [dx, dy] of [
      [-2000, -2000],
      [2000, 2000],
      [137, -83],
      [-59, 211],
    ]) {
      const rect = resizeCropRect(start, handle, dx, dy, bounds, ratio);
      assert.equal(rect.x >= -1e-8, true, `${ratio} ${handle} x`);
      assert.equal(rect.y >= -1e-8, true, `${ratio} ${handle} y`);
      assert.equal(rect.width >= 1, true, `${ratio} ${handle} width`);
      assert.equal(rect.height >= 1, true, `${ratio} ${handle} height`);
      assert.equal(rect.x + rect.width <= bounds.width + 1e-8, true, `${ratio} ${handle} right`);
      assert.equal(rect.y + rect.height <= bounds.height + 1e-8, true, `${ratio} ${handle} bottom`);
      if (ratio !== null) {
        assert.equal(
          Math.abs(rect.width / rect.height - ratio) < 1e-8,
          true,
          `${ratio} ${handle} ratio`
        );
      }
      geometryChecks += 1;
    }
  }
}

const tiny = toPixelCropRect(
  resizeCropRect(
    { x: 0, y: 0, width: 6, height: 4 },
    'se',
    -100,
    -100,
    { width: 6, height: 4 },
    null
  ),
  { width: 6, height: 4 }
);
assert.equal(tiny.width >= 1 && tiny.height >= 1, true);
assert.equal(tiny.x + tiny.width <= 6, true);
assert.equal(tiny.y + tiny.height <= 4, true);

console.log(
  JSON.stringify({
    status: 'RESIZER_CROPPER_ALGORITHM_OK',
    resizerVariants: Object.keys(expectedResizerVariants).length,
    cropperVariants: Object.keys(expectedCropRatios).length,
    geometryChecks,
  })
);
