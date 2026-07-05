import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  BatchArchiveCancelledError,
  calculateBatchTotals,
  createBatchArchive,
  createUniqueArchiveNames,
} from '../src/lib/batch-results.ts';

assert.deepEqual(
  createUniqueArchiveNames([
    'photo.jpg',
    'photo.jpg',
    'PHOTO.JPG',
    '../bad:name?.png',
    'archive',
    'archive',
  ]),
  ['photo.jpg', 'photo (2).jpg', 'PHOTO (3).JPG', 'bad-name-.png', 'archive', 'archive (2)']
);

const successes = [
  {
    sourceId: 'one',
    sourceName: 'photo.jpg',
    outputName: 'photo.png',
    originalSize: 12,
    outputSize: 3,
    blob: new Blob(['one'], { type: 'image/png' }),
  },
  {
    sourceId: 'two',
    sourceName: 'photo.webp',
    outputName: 'photo.png',
    originalSize: 18,
    outputSize: 3,
    blob: new Blob(['two'], { type: 'image/png' }),
  },
];
const failures = [{ sourceId: 'bad', name: 'bad.png', message: 'Decode failed.' }];

assert.deepEqual(calculateBatchTotals(successes, failures), {
  successCount: 2,
  failureCount: 1,
  originalSize: 30,
  outputSize: 6,
});

const progress = [];
const archiveBlob = await createBatchArchive(successes, {
  onProgress: (percent) => progress.push(percent),
});
assert.equal(archiveBlob.type, 'application/zip');
assert.equal(progress.length > 0, true);
assert.equal(progress.at(-1), 100);

const archive = await JSZip.loadAsync(await archiveBlob.arrayBuffer());
assert.deepEqual(Object.keys(archive.files), ['photo.png', 'photo (2).png']);
assert.equal(await archive.file('photo.png').async('string'), 'one');
assert.equal(await archive.file('photo (2).png').async('string'), 'two');
assert.equal(archive.file('bad.png'), null);

await assert.rejects(() => createBatchArchive([], {}), /At least one successful result/);

const controller = new AbortController();
await assert.rejects(
  () =>
    createBatchArchive(successes, {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }),
  (error) => error instanceof BatchArchiveCancelledError
);

console.log(
  JSON.stringify({
    status: 'BATCH_DOWNLOAD_VALIDATION_OK',
    entries: Object.keys(archive.files).length,
    uniqueNameCases: 6,
    progressUpdates: progress.length,
    cancellationVerified: true,
  })
);
