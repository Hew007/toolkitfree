import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { allVariants } from '../src/data/converter-variants.ts';
import {
  OUTPUT_FORMAT_EXTENSIONS,
  OUTPUT_FORMAT_LABELS,
  createUniqueOutputNames,
  getConverterInputConfig,
  getConverterOutputMime,
} from '../src/lib/image-converter.ts';

assert.deepEqual(Object.keys(OUTPUT_FORMAT_LABELS).sort(), [
  'image/jpeg',
  'image/png',
  'image/webp',
]);
assert.deepEqual(Object.values(OUTPUT_FORMAT_EXTENSIONS).sort(), ['.jpg', '.png', '.webp']);
assert.equal(getConverterOutputMime(), 'image/png');
assert.equal(getConverterOutputMime('JPG'), 'image/jpeg');
assert.equal(getConverterOutputMime('PNG'), 'image/png');
assert.equal(getConverterOutputMime('WebP'), 'image/webp');
assert.throws(() => getConverterOutputMime('GIF'), /Unsupported converter output label/);

assert.deepEqual(getConverterInputConfig().allowedTypes, ['image/jpeg', 'image/png', 'image/webp']);
assert.equal(getConverterInputConfig('JPG').accept, 'image/jpeg');
assert.equal(getConverterInputConfig('PNG').accept, 'image/png');
assert.equal(getConverterInputConfig('WebP').accept, 'image/webp');
assert.equal(getConverterInputConfig('GIF').accept, 'image/gif');
assert.equal(getConverterInputConfig('BMP').accept, 'image/bmp,image/x-ms-bmp');
assert.equal(getConverterInputConfig('SVG').accept, 'image/svg+xml');
assert.throws(() => getConverterInputConfig('HEIC'), /Unsupported converter input label/);

assert.deepEqual(
  createUniqueOutputNames(
    ['sample.webp', 'sample.gif', 'SAMPLE.PNG', '.hidden', 'photo.jpg'],
    'image/png'
  ),
  ['sample.png', 'sample-2.png', 'SAMPLE-3.png', 'image.png', 'photo.png']
);

const supported = allVariants.filter((variant) => variant.availability === 'supported');
const browserDependent = allVariants.filter(
  (variant) => variant.availability === 'browser-dependent'
);
const unsupported = allVariants.filter((variant) => variant.availability === 'unsupported');

assert.equal(supported.length, 6);
assert.deepEqual(supported.map(({ from, to }) => `${from}->${to}`).sort(), [
  'JPG->PNG',
  'JPG->WebP',
  'PNG->JPG',
  'PNG->WebP',
  'WebP->JPG',
  'WebP->PNG',
]);
assert.deepEqual(browserDependent.map(({ slug }) => slug).sort(), [
  'bmp-to-png',
  'gif-to-png',
  'svg-to-png',
]);
assert.deepEqual(unsupported.map(({ slug }) => slug).sort(), [
  'heic-to-jpg',
  'png-to-gif',
  'tiff-to-jpg',
]);
assert.equal(
  allVariants.every(
    (variant) =>
      variant.availability === 'supported' ||
      (variant.capabilityNote && variant.capabilityNote.length > 20)
  ),
  true
);

const dist = path.resolve('dist/tools/image-converter');
for (const variant of allVariants) {
  const htmlPath = path.join(dist, variant.slug, 'index.html');
  assert.equal(fs.existsSync(htmlPath), true, `${variant.slug} should be built`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const hasNoindex = html.includes('name="robots" content="noindex, follow"');
  const hasConverterIsland = html.includes('component-url="/_astro/ImageConverter');

  assert.equal(
    hasNoindex,
    variant.availability !== 'supported',
    `${variant.slug} noindex state should match availability`
  );
  assert.equal(
    hasConverterIsland,
    variant.availability !== 'unsupported',
    `${variant.slug} tool visibility should match availability`
  );
}

console.log(
  JSON.stringify({
    status: 'IMAGE_CONVERTER_MAPPING_OK',
    outputs: Object.keys(OUTPUT_FORMAT_LABELS).length,
    supportedVariants: supported.length,
    browserDependentVariants: browserDependent.length,
    unsupportedVariants: unsupported.length,
  })
);
