import assert from 'node:assert/strict';
import {
  ImageProcessingError,
  ObjectUrlRegistry,
  downloadUrl,
  exportCanvas,
  formatSize,
  getImageProcessingErrorMessage,
  loadImage,
  normalizeDownloadFilename,
  validateImageDimensions,
  validateImageFile,
} from '../src/lib/image-processing.ts';

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof ImageProcessingError && error.code === code);
}

async function expectCodeAsync(fn, code) {
  await assert.rejects(fn, (error) => error instanceof ImageProcessingError && error.code === code);
}

assert.equal(formatSize(0), '0 B');
assert.equal(formatSize(1023), '1023 B');
assert.equal(formatSize(1024), '1.0 KB');
assert.equal(formatSize(1024 * 1024), '1.0 MB');
expectCode(() => formatSize(-1), 'INVALID_FILE_SIZE');
expectCode(() => formatSize(Number.NaN), 'INVALID_FILE_SIZE');

validateImageFile({ name: 'photo.png', size: 10, type: 'image/png' });
expectCode(
  () => validateImageFile({ name: 'empty.png', size: 0, type: 'image/png' }),
  'EMPTY_FILE'
);
expectCode(
  () => validateImageFile({ name: 'note.txt', size: 10, type: 'text/plain' }),
  'UNSUPPORTED_FILE_TYPE'
);
expectCode(
  () =>
    validateImageFile(
      { name: 'large.png', size: 11, type: 'image/png' },
      { maxBytes: 10 }
    ),
  'INVALID_FILE_SIZE'
);

assert.deepEqual(validateImageDimensions(400, 300), {
  width: 400,
  height: 300,
  pixels: 120_000,
});
expectCode(() => validateImageDimensions(0, 10), 'INVALID_DIMENSIONS');
expectCode(
  () => validateImageDimensions(100, 100, { maxPixels: 9_999 }),
  'PIXEL_LIMIT_EXCEEDED'
);

const created = [];
const revoked = [];
const fakeUrlApi = {
  createObjectURL() {
    const url = `blob:test-${created.length + 1}`;
    created.push(url);
    return url;
  },
  revokeObjectURL(url) {
    revoked.push(url);
  },
};

const registry = new ObjectUrlRegistry(fakeUrlApi);
assert.equal(registry.replace('preview', new Blob(['one'])), 'blob:test-1');
assert.equal(registry.replace('preview', new Blob(['two'])), 'blob:test-2');
assert.deepEqual(revoked, ['blob:test-1']);
registry.replace('icon:16', new Blob(['icon']));
registry.revokePrefix('icon:');
assert.deepEqual(revoked, ['blob:test-1', 'blob:test-3']);
registry.revokeAll();
assert.deepEqual(revoked, ['blob:test-1', 'blob:test-3', 'blob:test-2']);
assert.equal(registry.size, 0);

const matchingCanvas = {
  toBlob(callback, type) {
    callback(new Blob(['png'], { type }));
  },
};
assert.equal((await exportCanvas(matchingCanvas, 'image/png')).type, 'image/png');

await expectCodeAsync(
  () =>
    exportCanvas(
      { toBlob: (callback) => callback(new Blob(['fallback'], { type: 'image/png' })) },
      'image/webp'
    ),
  'OUTPUT_TYPE_MISMATCH'
);
await expectCodeAsync(
  () => exportCanvas({ toBlob: (callback) => callback(null) }, 'image/png'),
  'EXPORT_FAILED'
);

const file = Object.assign(new Blob(['image'], { type: 'image/png' }), {
  name: 'image.png',
});
const decoded = await loadImage(file, {
  urlApi: fakeUrlApi,
  imageFactory: () => {
    let source = '';
    return {
      onload: null,
      onerror: null,
      naturalWidth: 20,
      naturalHeight: 10,
      get src() {
        return source;
      },
      set src(value) {
        source = value;
        queueMicrotask(() => this.onload?.());
      },
    };
  },
});
assert.equal(decoded.naturalWidth, 20);
assert.equal(revoked.at(-1), created.at(-1));

await expectCodeAsync(
  () =>
    loadImage(file, {
      urlApi: fakeUrlApi,
      imageFactory: () => {
        let source = '';
        return {
          onload: null,
          onerror: null,
          naturalWidth: 0,
          naturalHeight: 0,
          get src() {
            return source;
          },
          set src(value) {
            source = value;
            queueMicrotask(() => this.onerror?.(new Error('decode')));
          },
        };
      },
    }),
  'DECODE_FAILED'
);
assert.equal(revoked.at(-1), created.at(-1));

assert.equal(normalizeDownloadFilename('../bad:name?.zip'), 'bad-name-.zip');
assert.equal(normalizeDownloadFilename('...'), 'download');

let clicked = false;
let appended = false;
let removed = false;
const anchor = {
  href: '',
  download: '',
  rel: '',
  style: {},
  click() {
    clicked = true;
  },
};
downloadUrl('blob:zip', '../favicons?.zip', {
  createElement() {
    return anchor;
  },
  body: {
    appendChild() {
      appended = true;
    },
    removeChild() {
      removed = true;
    },
  },
});
assert.equal(anchor.download, 'favicons-.zip');
assert.equal(anchor.rel, 'noopener');
assert.equal(clicked && appended && removed, true);

assert.equal(
  getImageProcessingErrorMessage(
    new ImageProcessingError('OUTPUT_TYPE_MISMATCH', 'debug details')
  ),
  'Your browser does not support the requested output format.'
);
assert.equal(
  getImageProcessingErrorMessage(new Error('internal details')),
  'Image processing failed. Please try another file.'
);

console.log(
  JSON.stringify({
    status: 'IMAGE_PROCESSING_VALIDATION_OK',
    assertions: 32,
    objectUrlsCreated: created.length,
    objectUrlsRevoked: revoked.length,
  })
);
