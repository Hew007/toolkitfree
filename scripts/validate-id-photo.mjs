import assert from 'node:assert/strict';
import {
  ID_PHOTO_PRESETS,
  getIdPhotoPreset,
  getSelectableIdPhotoPresets,
  isPresetSourceStale,
} from '../src/data/id-photo-presets.ts';
import {
  IdPhotoGeometryError,
  calculateCenteredCrop,
  calculateHeadHeightRange,
  calculatePixelSize,
  calculatePrintLayout,
  convertLength,
} from '../src/lib/id-photo.ts';

assert.equal(new Set(ID_PHOTO_PRESETS.map((preset) => preset.id)).size, ID_PHOTO_PRESETS.length);
assert.deepEqual(
  getSelectableIdPhotoPresets().map((preset) => preset.id),
  ['custom', 'us-passport-print-reference', 'uk-passport-paper-reference']
);
assert.equal(getIdPhotoPreset('canada-passport-unsupported').selectable, false);
assert.equal(getIdPhotoPreset('canada-passport-unsupported').allowedModes.length, 0);
assert.equal(
  ID_PHOTO_PRESETS.filter((preset) => preset.status !== 'custom').every(
    (preset) => preset.sources.length > 0
  ),
  true
);
assert.equal(
  ID_PHOTO_PRESETS.every((preset) =>
    preset.sources.every(
      (source) => source.url.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt)
    )
  ),
  true
);
assert.equal(
  isPresetSourceStale(
    getIdPhotoPreset('us-passport-print-reference'),
    new Date('2026-07-05T00:00:00Z')
  ),
  false
);
assert.equal(
  isPresetSourceStale(
    getIdPhotoPreset('us-passport-print-reference'),
    new Date('2027-01-02T00:00:01Z')
  ),
  true
);

assert.deepEqual(calculatePixelSize({ value: 2, unit: 'in' }, { value: 2, unit: 'in' }, 300), {
  width: 600,
  height: 600,
});
assert.deepEqual(calculatePixelSize({ value: 35, unit: 'mm' }, { value: 45, unit: 'mm' }, 300), {
  width: 413,
  height: 531,
});
assert.equal(Math.abs(convertLength(25.4, 'mm', 'in', 300) - 1) < 1e-12, true);
assert.equal(Math.abs(convertLength(600, 'px', 'in', 300) - 2) < 1e-12, true);
assert.equal(Math.abs(convertLength(2, 'in', 'mm', 300) - 50.8) < 1e-12, true);
assert.equal(convertLength(0, 'mm', 'px', 300), 0);

assert.deepEqual(calculateCenteredCrop({ width: 4000, height: 3000 }, 1), {
  x: 500,
  y: 0,
  width: 3000,
  height: 3000,
});
const portraitCrop = calculateCenteredCrop({ width: 4000, height: 3000 }, 35 / 45);
assert.equal(Math.abs(portraitCrop.x - 833.3333333333333) < 1e-8, true);
assert.equal(portraitCrop.y, 0);
assert.equal(Math.abs(portraitCrop.width - 2333.333333333333) < 1e-8, true);
assert.equal(portraitCrop.height, 3000);

assert.deepEqual(calculateHeadHeightRange(50.8, { min: 25, max: 35 }), {
  minRatio: 25 / 50.8,
  maxRatio: 35 / 50.8,
});

const fourBySix = calculatePrintLayout({
  paperWidth: { value: 6, unit: 'in' },
  paperHeight: { value: 4, unit: 'in' },
  photoWidth: { value: 2, unit: 'in' },
  photoHeight: { value: 2, unit: 'in' },
  dpi: 300,
});
assert.deepEqual(
  {
    paper: fourBySix.paper,
    photo: fourBySix.photo,
    columns: fourBySix.columns,
    rows: fourBySix.rows,
    count: fourBySix.count,
  },
  {
    paper: { width: 1800, height: 1200 },
    photo: { width: 600, height: 600 },
    columns: 3,
    rows: 2,
    count: 6,
  }
);

const a4 = calculatePrintLayout({
  paperWidth: { value: 210, unit: 'mm' },
  paperHeight: { value: 297, unit: 'mm' },
  photoWidth: { value: 35, unit: 'mm' },
  photoHeight: { value: 45, unit: 'mm' },
  dpi: 300,
  marginMm: 10,
  gapMm: 3,
});
assert.equal(a4.columns, 5);
assert.equal(a4.rows, 5);
assert.equal(a4.count, 25);
for (const item of a4.items) {
  assert.equal(item.x >= 0 && item.y >= 0, true);
  assert.equal(item.x + item.width <= a4.paper.width + 1, true);
  assert.equal(item.y + item.height <= a4.paper.height + 1, true);
}

assert.throws(
  () =>
    calculatePrintLayout({
      paperWidth: { value: 4, unit: 'in' },
      paperHeight: { value: 4, unit: 'in' },
      photoWidth: { value: 6, unit: 'in' },
      photoHeight: { value: 6, unit: 'in' },
      dpi: 300,
    }),
  (error) => error instanceof IdPhotoGeometryError && error.code === 'PHOTO_DOES_NOT_FIT'
);
assert.throws(
  () => calculateCenteredCrop({ width: 0, height: 100 }, 1),
  (error) => error instanceof IdPhotoGeometryError && error.code === 'INVALID_LENGTH'
);
assert.throws(
  () => convertLength(1, 'in', 'px', 0),
  (error) => error instanceof IdPhotoGeometryError && error.code === 'INVALID_DPI'
);
assert.throws(
  () => calculateHeadHeightRange(45, { min: 25, max: 50 }),
  (error) => error instanceof IdPhotoGeometryError && error.code === 'INVALID_LENGTH'
);

console.log(
  JSON.stringify({
    status: 'ID_PHOTO_VALIDATION_OK',
    presets: ID_PHOTO_PRESETS.length,
    selectablePresets: getSelectableIdPhotoPresets().length,
    fourBySixPhotos: fourBySix.count,
    a4Photos: a4.count,
  })
);
