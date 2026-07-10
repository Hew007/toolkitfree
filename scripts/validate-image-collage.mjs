import assert from 'node:assert/strict';
import { calculateCollageLayout, getCollageFilename } from '../src/lib/image-collage.ts';

const sources = [
  { width: 100, height: 50 },
  { width: 50, height: 100 },
  { width: 80, height: 80 },
];

const horizontal = calculateCollageLayout(sources.slice(0, 2), {
  layout: 'horizontal',
  fit: 'original',
  gap: 10,
  margin: 5,
  cellWidth: 360,
  cellHeight: 360,
  borderRadius: 0,
  background: '#ffffff',
});
assert.equal(horizontal.width, 170);
assert.equal(horizontal.height, 110);
assert.deepEqual(
  horizontal.placements.map((placement) => placement.tile.x),
  [5, 115]
);
assert.deepEqual(
  horizontal.placements.map((placement) => placement.draw.y),
  [30, 5]
);

const vertical = calculateCollageLayout(sources.slice(0, 2), {
  layout: 'vertical',
  fit: 'original',
  gap: 12,
  margin: 4,
  cellWidth: 360,
  cellHeight: 360,
  borderRadius: 0,
  background: '#ffffff',
});
assert.equal(vertical.width, 108);
assert.equal(vertical.height, 170);
assert.deepEqual(
  vertical.placements.map((placement) => placement.tile.y),
  [4, 66]
);
assert.deepEqual(
  vertical.placements.map((placement) => placement.draw.x),
  [4, 29]
);

const grid = calculateCollageLayout(sources, {
  layout: 'grid',
  fit: 'contain',
  columns: 2,
  gap: 10,
  margin: 5,
  cellWidth: 100,
  cellHeight: 80,
  borderRadius: 0,
  background: '#ffffff',
});
assert.equal(grid.width, 220);
assert.equal(grid.height, 180);
assert.equal(grid.placements.length, 3);
assert.deepEqual(grid.placements[0].draw, { x: 5, y: 20, width: 100, height: 50 });
assert.deepEqual(grid.placements[1].draw, { x: 145, y: 5, width: 40, height: 80 });
assert.deepEqual(grid.placements[2].tile, { x: 5, y: 95, width: 100, height: 80 });

const cover = calculateCollageLayout([{ width: 200, height: 100 }], {
  layout: 'grid',
  fit: 'cover',
  columns: 1,
  gap: 0,
  margin: 0,
  cellWidth: 100,
  cellHeight: 100,
  borderRadius: 0,
  background: '#ffffff',
});
assert.deepEqual(cover.placements[0].source, { x: 50, y: 0, width: 100, height: 100 });
assert.deepEqual(cover.placements[0].draw, { x: 0, y: 0, width: 100, height: 100 });

const autoGrid = calculateCollageLayout(sources, {
  layout: 'grid',
  fit: 'contain',
  gap: 0,
  margin: 0,
  cellWidth: 90,
  cellHeight: 90,
  borderRadius: 0,
  background: '#ffffff',
});
assert.equal(autoGrid.width, 180);
assert.equal(autoGrid.height, 180);

assert.equal(getCollageFilename('image/png'), 'toolkitfree-collage.png');
assert.equal(getCollageFilename('image/jpeg'), 'toolkitfree-collage.jpg');
assert.equal(getCollageFilename('image/webp'), 'toolkitfree-collage.webp');

assert.throws(() =>
  calculateCollageLayout([], {
    layout: 'grid',
    fit: 'contain',
    gap: 0,
    margin: 0,
    cellWidth: 100,
    cellHeight: 100,
    borderRadius: 0,
    background: '#ffffff',
  })
);

console.log(
  JSON.stringify({
    status: 'IMAGE_COLLAGE_ALGORITHM_OK',
    layoutChecks: 5,
    filenameChecks: 3,
  })
);
