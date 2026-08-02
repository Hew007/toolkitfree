import assert from 'node:assert/strict';
import { calculateCollageLayout } from '../src/lib/image-collage.ts';
import {
  MAX_SPLIT_TILES,
  calculateEvenSplitLayout,
  calculateSplitLayoutFromCuts,
  clampCutPosition,
  createEvenCuts,
  getSplitExtension,
  getSplitFilename,
  suggestCutPosition,
} from '../src/lib/image-splitter.ts';

function rects(layout) {
  return layout.tiles.map((tile) => tile.rect);
}

// --- Even cut generation -----------------------------------------------------

assert.deepEqual(createEvenCuts(4000, 2, 0, 0), [2000]);
assert.deepEqual(createEvenCuts(640, 1, 0, 0), []);
// 1000 into 3 leaves one pixel over, spread onto the first piece.
assert.deepEqual(createEvenCuts(1000, 3, 0, 0), [334, 667]);
assert.deepEqual(createEvenCuts(100, 2, 10, 5), [45]);

// Evenly generated pieces never differ by more than one pixel.
const spreadWidths = calculateSplitLayoutFromCuts(
  { width: 1000, height: 10 },
  { xCuts: createEvenCuts(1000, 3, 0, 0), yCuts: [], gutter: 0, margin: 0 }
).tiles.map((tile) => tile.rect.width);
assert.deepEqual(spreadWidths, [334, 333, 333]);
assert.equal(Math.max(...spreadWidths) - Math.min(...spreadWidths) <= 1, true);

assert.throws(() => createEvenCuts(4, 5, 0, 0), /cannot be divided into 5 pieces/);
assert.throws(() => createEvenCuts(100, 1, 0, 50), /cannot be divided into 1 pieces/);
assert.throws(() => createEvenCuts(100, 2.5, 0, 0), /Piece count must be a safe integer/);
assert.throws(() => createEvenCuts(100, 2, -1, 0), /Gutter must be a safe integer/);

// --- Even layout -------------------------------------------------------------

const even = calculateEvenSplitLayout(
  { width: 4000, height: 3000 },
  { rows: 2, cols: 2, gutter: 0, margin: 0 }
);
assert.equal(even.rows, 2);
assert.equal(even.cols, 2);
assert.deepEqual(rects(even), [
  { x: 0, y: 0, width: 2000, height: 1500 },
  { x: 2000, y: 0, width: 2000, height: 1500 },
  { x: 0, y: 1500, width: 2000, height: 1500 },
  { x: 2000, y: 1500, width: 2000, height: 1500 },
]);
assert.deepEqual(
  even.tiles.map((tile) => [tile.index, tile.row, tile.col]),
  [
    [0, 0, 0],
    [1, 0, 1],
    [2, 1, 0],
    [3, 1, 1],
  ]
);

const spaced = calculateEvenSplitLayout(
  { width: 100, height: 100 },
  { rows: 2, cols: 2, gutter: 10, margin: 5 }
);
assert.deepEqual(rects(spaced), [
  { x: 5, y: 5, width: 40, height: 40 },
  { x: 55, y: 5, width: 40, height: 40 },
  { x: 5, y: 55, width: 40, height: 40 },
  { x: 55, y: 55, width: 40, height: 40 },
]);

const single = calculateEvenSplitLayout(
  { width: 640, height: 480 },
  { rows: 1, cols: 1, gutter: 0, margin: 0 }
);
assert.equal(single.tiles.length, 1);
assert.deepEqual(single.tiles[0].rect, { x: 0, y: 0, width: 640, height: 480 });

const maximum = calculateEvenSplitLayout(
  { width: 1200, height: 1200 },
  { rows: 12, cols: 12, gutter: 0, margin: 0 }
);
assert.equal(maximum.tiles.length, MAX_SPLIT_TILES);
assert.throws(
  () =>
    calculateEvenSplitLayout(
      { width: 1200, height: 1200 },
      { rows: 13, cols: 12, gutter: 0, margin: 0 }
    ),
  /more than 144 pieces/
);

// --- Arbitrary cut positions -------------------------------------------------
// This is the case an even grid cannot express: a stitched composite whose
// pictures are different sizes.

const uneven = calculateSplitLayoutFromCuts(
  { width: 1000, height: 400 },
  { xCuts: [200, 850], yCuts: [120], gutter: 0, margin: 0 }
);
assert.equal(uneven.rows, 2);
assert.equal(uneven.cols, 3);
assert.deepEqual(rects(uneven), [
  { x: 0, y: 0, width: 200, height: 120 },
  { x: 200, y: 0, width: 650, height: 120 },
  { x: 850, y: 0, width: 150, height: 120 },
  { x: 0, y: 120, width: 200, height: 280 },
  { x: 200, y: 120, width: 650, height: 280 },
  { x: 850, y: 120, width: 150, height: 280 },
]);

// Cut positions may arrive in any order.
assert.deepEqual(
  rects(
    calculateSplitLayoutFromCuts(
      { width: 1000, height: 400 },
      { xCuts: [850, 200], yCuts: [120], gutter: 0, margin: 0 }
    )
  ),
  rects(uneven)
);

// A gutter discards a band that starts at the cut position.
const banded = calculateSplitLayoutFromCuts(
  { width: 100, height: 10 },
  { xCuts: [40], yCuts: [], gutter: 6, margin: 0 }
);
assert.deepEqual(rects(banded), [
  { x: 0, y: 0, width: 40, height: 10 },
  { x: 46, y: 0, width: 54, height: 10 },
]);

assert.throws(
  () =>
    calculateSplitLayoutFromCuts(
      { width: 100, height: 10 },
      { xCuts: [0], yCuts: [], gutter: 0, margin: 0 }
    ),
  /piece along the width would be empty/
);
assert.throws(
  () =>
    calculateSplitLayoutFromCuts(
      { width: 100, height: 10 },
      { xCuts: [100], yCuts: [], gutter: 0, margin: 0 }
    ),
  /piece along the width would be empty/
);
assert.throws(
  () =>
    calculateSplitLayoutFromCuts(
      { width: 100, height: 10 },
      { xCuts: [40, 44], yCuts: [], gutter: 6, margin: 0 }
    ),
  /piece along the width would be empty/
);
assert.throws(
  () =>
    calculateSplitLayoutFromCuts(
      { width: 100, height: 10 },
      { xCuts: [], yCuts: [5], gutter: 0, margin: 6 }
    ),
  /piece along the height would be empty/
);
assert.throws(
  () =>
    calculateSplitLayoutFromCuts(
      { width: 100, height: 10 },
      { xCuts: [10.5], yCuts: [], gutter: 0, margin: 0 }
    ),
  /Cut 1 must be a safe integer/
);
assert.throws(
  () =>
    calculateSplitLayoutFromCuts(
      { width: 0, height: 10 },
      { xCuts: [], yCuts: [], gutter: 0, margin: 0 }
    ),
  /Source width must be a safe integer/
);

// --- Round trip against the collage layout ----------------------------------
// Collage and splitter are inverse operations. A grid collage built from
// identically sized sources must decompose back into the same tile rectangles.

const collage = calculateCollageLayout(
  Array.from({ length: 6 }, () => ({ width: 120, height: 80 })),
  {
    layout: 'grid',
    fit: 'original',
    columns: 3,
    gap: 10,
    margin: 5,
    cellWidth: 360,
    cellHeight: 360,
    borderRadius: 0,
    background: '#ffffff',
  }
);
assert.equal(collage.width, 390);
assert.equal(collage.height, 180);
assert.deepEqual(
  rects(
    calculateEvenSplitLayout(
      { width: collage.width, height: collage.height },
      { rows: 2, cols: 3, gutter: 10, margin: 5 }
    )
  ),
  collage.placements.map((placement) => placement.tile)
);

const tightCollage = calculateCollageLayout(
  Array.from({ length: 4 }, () => ({ width: 200, height: 150 })),
  {
    layout: 'grid',
    fit: 'original',
    columns: 2,
    gap: 0,
    margin: 0,
    cellWidth: 360,
    cellHeight: 360,
    borderRadius: 0,
    background: '#ffffff',
  }
);
assert.deepEqual(
  rects(
    calculateEvenSplitLayout(
      { width: tightCollage.width, height: tightCollage.height },
      { rows: 2, cols: 2, gutter: 0, margin: 0 }
    )
  ),
  tightCollage.placements.map((placement) => placement.tile)
);

// --- Moving a cut ------------------------------------------------------------

const cuts = [100, 300];
assert.equal(clampCutPosition(cuts, 0, 150, 1000, 10, 20), 150);
assert.equal(clampCutPosition(cuts, 0, 5, 1000, 10, 20), 21, 'stops at the left margin');
assert.equal(clampCutPosition(cuts, 0, 500, 1000, 10, 20), 289, 'stops before the next cut');
assert.equal(clampCutPosition(cuts, 1, 50, 1000, 10, 20), 111, 'stops after the previous cut');
assert.equal(clampCutPosition(cuts, 1, 9999, 1000, 10, 20), 969, 'stops at the right margin');
assert.equal(clampCutPosition(cuts, 0, 150.6, 1000, 10, 20), 151, 'rounds to a whole pixel');
assert.equal(clampCutPosition(cuts, 0, Number.NaN, 1000, 10, 20), 21);
assert.throws(() => clampCutPosition(cuts, 2, 100, 1000, 0, 0), /out of range/);
assert.throws(() => clampCutPosition([], 0, 100, 1000, 0, 0), /out of range/);

// --- Suggesting a new cut ----------------------------------------------------

assert.equal(suggestCutPosition([], 1000, 0, 0), 500);
assert.equal(suggestCutPosition([200], 1000, 0, 0), 600, 'splits the widest piece');
assert.equal(suggestCutPosition([800], 1000, 0, 0), 400);
assert.equal(suggestCutPosition([], 2, 0, 0), 1);
assert.equal(suggestCutPosition([], 1, 0, 0), null, 'no room for another piece');
assert.equal(suggestCutPosition([], 10, 9, 0), null, 'the gap would consume the piece');

// --- Filenames ---------------------------------------------------------------

const firstTile = { index: 0, row: 0, col: 0 };
assert.equal(
  getSplitFilename('photo.jpg', firstTile, 'png', { rows: 2, cols: 2 }),
  'photo-r1-c1.png'
);
assert.equal(
  getSplitFilename('holiday.png', { index: 4, row: 1, col: 1 }, 'webp', { rows: 3, cols: 3 }),
  'holiday-r2-c2.webp'
);
assert.equal(
  getSplitFilename('banner.jpg', { index: 2, row: 0, col: 2 }, 'jpg', { rows: 1, cols: 3 }),
  'banner-3.jpg'
);
assert.equal(
  getSplitFilename('banner.jpg', { index: 1, row: 1, col: 0 }, 'jpg', { rows: 3, cols: 1 }),
  'banner-2.jpg'
);
assert.equal(
  getSplitFilename('no-extension', firstTile, 'png', { rows: 2, cols: 2 }),
  'no-extension-r1-c1.png'
);
assert.equal(getSplitFilename('.png', firstTile, 'png', { rows: 1, cols: 1 }), 'image-1.png');
assert.equal(
  getSplitFilename('archive.tar.gz', firstTile, 'png', { rows: 1, cols: 1 }),
  'archive.tar-1.png'
);

assert.equal(getSplitExtension('image/jpeg'), 'jpg');
assert.equal(getSplitExtension('image/webp'), 'webp');
assert.equal(getSplitExtension('image/png'), 'png');
assert.equal(getSplitExtension('image/avif'), 'png');

console.log(
  JSON.stringify({
    status: 'IMAGE_SPLITTER_ALGORITHM_OK',
    evenCutChecks: 9,
    evenLayoutChecks: 8,
    arbitraryCutChecks: 9,
    roundTripChecks: 2,
    clampChecks: 9,
    suggestChecks: 6,
    filenameChecks: 11,
  })
);
