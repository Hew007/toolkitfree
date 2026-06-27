import assert from 'node:assert/strict';
import {
  compressToTargetSize,
  dimensionsForMaxWidth,
  scaleDimensions,
} from '../src/lib/image-compressor.ts';

const blobOfSize = (size, type) => new Blob([new Uint8Array(size)], { type });

assert.deepEqual(dimensionsForMaxWidth(4000, 3000, 2000), {
  width: 2000,
  height: 1500,
});
assert.deepEqual(dimensionsForMaxWidth(800, 600, 1920), {
  width: 800,
  height: 600,
});
assert.deepEqual(scaleDimensions(1000, 500, 0.8, 320), {
  width: 800,
  height: 400,
});
assert.deepEqual(scaleDimensions(300, 200, 0.8, 320), null);

const qualitySearch = await compressToTargetSize({
  sourceWidth: 400,
  sourceHeight: 300,
  outputType: 'image/jpeg',
  targetBytes: 50_000,
  qualityIterations: 7,
  encode: async (width, height, quality = 1) =>
    blobOfSize(Math.ceil(width * height * quality), 'image/jpeg'),
});
assert.equal(qualitySearch.metTarget, true);
assert.equal(qualitySearch.blob.size <= 50_000, true);
assert.equal(qualitySearch.width, 400);
assert.equal(qualitySearch.height, 300);
assert.equal(qualitySearch.quality > 0.35, true);
assert.equal(qualitySearch.attempts, 9);

const dimensionSearch = await compressToTargetSize({
  sourceWidth: 1000,
  sourceHeight: 1000,
  outputType: 'image/webp',
  targetBytes: 100_000,
  minLongEdge: 200,
  dimensionScale: 0.7,
  encode: async (width, height, quality = 1) =>
    blobOfSize(Math.ceil(width * height * quality), 'image/webp'),
});
assert.equal(dimensionSearch.metTarget, true);
assert.equal(dimensionSearch.blob.size <= 100_000, true);
assert.equal(dimensionSearch.width < 1000, true);
assert.equal(dimensionSearch.height < 1000, true);

const pngSearch = await compressToTargetSize({
  sourceWidth: 1000,
  sourceHeight: 800,
  outputType: 'image/png',
  targetBytes: 100_000,
  minLongEdge: 200,
  dimensionScale: 0.6,
  encode: async (width, height, quality) => {
    assert.equal(quality, undefined);
    return blobOfSize(width * height, 'image/png');
  },
});
assert.equal(pngSearch.metTarget, true);
assert.equal(pngSearch.blob.size <= 100_000, true);
assert.equal(pngSearch.quality, null);
assert.equal(pngSearch.attempts <= 8, true);

const impossible = await compressToTargetSize({
  sourceWidth: 1200,
  sourceHeight: 800,
  outputType: 'image/jpeg',
  targetBytes: 100_000,
  maxDimensionSteps: 2,
  minLongEdge: 100,
  encode: async () => blobOfSize(200_000, 'image/jpeg'),
});
assert.equal(impossible.metTarget, false);
assert.equal(impossible.blob.size, 200_000);
assert.equal(impossible.failureReason, 'minimum-quality-and-size-reached');
assert.equal(impossible.attempts, 3);

await assert.rejects(
  () =>
    compressToTargetSize({
      sourceWidth: 100,
      sourceHeight: 100,
      outputType: 'image/jpeg',
      targetBytes: 0,
      encode: async () => blobOfSize(100, 'image/jpeg'),
    }),
  /Target bytes must be positive/
);

console.log(
  JSON.stringify({
    status: 'IMAGE_COMPRESSOR_ALGORITHM_OK',
    qualityAttempts: qualitySearch.attempts,
    dimensionAttempts: dimensionSearch.attempts,
    pngAttempts: pngSearch.attempts,
    impossibleAttempts: impossible.attempts,
  })
);
