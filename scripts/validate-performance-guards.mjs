import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../src/lib/async-pool.ts';
import { assessImageBudget, inspectImageMetadata } from '../src/lib/image-budget.ts';

function pngFile(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], 'sample.png', { type: 'image/png' });
}

function jpegFile(width, height) {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height);
  view.setUint16(9, width);
  return new File([bytes], 'sample.jpg', { type: 'image/jpeg' });
}

function webpFile(width, height) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  bytes.set(new TextEncoder().encode('VP8X'), 12);
  const write24 = (offset, value) => {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
    bytes[offset + 2] = (value >> 16) & 0xff;
  };
  write24(24, width - 1);
  write24(27, height - 1);
  return new File([bytes], 'sample.webp', { type: 'image/webp' });
}

const gifBytes = new Uint8Array(10);
gifBytes.set(new TextEncoder().encode('GIF89a'), 0);
new DataView(gifBytes.buffer).setUint16(6, 320, true);
new DataView(gifBytes.buffer).setUint16(8, 240, true);

const bmpBytes = new Uint8Array(26);
bmpBytes.set(new TextEncoder().encode('BM'), 0);
new DataView(bmpBytes.buffer).setInt32(18, 640, true);
new DataView(bmpBytes.buffer).setInt32(22, -480, true);

const fixtures = [
  [pngFile(800, 600), 800, 600],
  [jpegFile(1024, 768), 1024, 768],
  [webpFile(1920, 1080), 1920, 1080],
  [new File([gifBytes], 'sample.gif', { type: 'image/gif' }), 320, 240],
  [new File([bmpBytes], 'sample.bmp', { type: 'image/bmp' }), 640, 480],
  [
    new File(['<svg viewBox="0 0 1200 800"></svg>'], 'sample.svg', { type: 'image/svg+xml' }),
    1200,
    800,
  ],
];

for (const [file, width, height] of fixtures) {
  const metadata = await inspectImageMetadata(file);
  assert.deepEqual(
    { width: metadata.width, height: metadata.height, pixels: metadata.pixels },
    { width, height, pixels: width * height },
    `${file.name} metadata`
  );
}

const safe = assessImageBudget(
  [await inspectImageMetadata(pngFile(800, 600))],
  'converter',
  'desktop'
);
assert.equal(safe.level, 'safe');

const warningMetadata = Array.from({ length: 21 }, (_, index) => ({
  name: `image-${index}.png`,
  size: 1024,
  type: 'image/png',
  width: 100,
  height: 100,
  pixels: 10_000,
}));
const warning = assessImageBudget(warningMetadata, 'converter', 'desktop');
assert.equal(warning.level, 'warning');
assert.equal(
  warning.issues.some((issue) => issue.code === 'FILE_COUNT'),
  true
);

const blocked = assessImageBudget(
  [
    {
      name: 'huge.png',
      size: 1024,
      type: 'image/png',
      width: 12_000,
      height: 10_000,
      pixels: 120_000_000,
    },
  ],
  'background',
  'desktop'
);
assert.equal(blocked.level, 'blocked');
assert.equal(
  blocked.issues.some((issue) => issue.code === 'SINGLE_IMAGE_PIXELS'),
  true
);

let active = 0;
let maximumActive = 0;
const poolResults = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
  active += 1;
  maximumActive = Math.max(maximumActive, active);
  await new Promise((resolve) => setTimeout(resolve, 5));
  active -= 1;
  return value * 2;
});
assert.deepEqual(poolResults, [2, 4, 6, 8, 10]);
assert.equal(maximumActive, 2);
await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value), /positive integer/);

console.log(
  JSON.stringify({
    status: 'PERFORMANCE_GUARDS_OK',
    metadataFormats: fixtures.length,
    safeLevel: safe.level,
    warningCodes: warning.issues.map((issue) => issue.code),
    blockedCodes: blocked.issues.map((issue) => issue.code),
    maximumConcurrency: maximumActive,
  })
);
