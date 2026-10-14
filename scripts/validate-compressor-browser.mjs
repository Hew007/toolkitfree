import assert from 'node:assert/strict';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';
import { openBrowserSession } from './browser-session.mjs';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
const targetUrl = `${baseUrl}/tools/image-compressor/compress-to-100kb/`;
const qualityUrl = `${baseUrl}/tools/image-compressor/`;

const session = await openBrowserSession({
  defaultEndpoint: 'http://127.0.0.1:9225',
  waitTimeoutMs: 90_000,
  pollMs: 100,
});
const { browserErrors, send, evaluate, waitFor } = session;
// This suite also waits for the file input itself, not only for hydration.
const navigate = (route) =>
  session.navigate(route, { ready: `Boolean(document.querySelector('input[type="file"]'))` });

const makeFilesExpression = `
  (async () => {
    const makeImage = async (name, type, width, height, quality, transparent = false) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      const image = context.createImageData(width, height);
      let seed = 123456789;
      for (let index = 0; index < image.data.length; index += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        image.data[index] = seed & 255;
        image.data[index + 1] = (seed >>> 8) & 255;
        image.data[index + 2] = (seed >>> 16) & 255;
        image.data[index + 3] = transparent && (index / 4) % 3 === 0 ? 0 : 255;
      }
      context.putImageData(image, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      return new File([blob], name, { type });
    };
    const largeJpg = await makeImage('large.jpg', 'image/jpeg', 1400, 1000, 0.96);
    const largeWebp = await makeImage('large.webp', 'image/webp', 1400, 1000, 0.96);
    const complexPng = await makeImage('complex.png', 'image/png', 700, 700, undefined, true);
    const smallJpg = await makeImage('small.jpg', 'image/jpeg', 16, 16, 0.25);
    const corruptJpg = new File([new Uint8Array([1, 2, 3, 4, 5])], 'corrupt.jpg', {
      type: 'image/jpeg',
    });
    window.__inputSizes = Object.fromEntries(
      [largeJpg, largeWebp, complexPng, smallJpg, corruptJpg].map((file) => [file.name, file.size])
    );
    const transfer = new DataTransfer();
    [largeJpg, largeWebp, complexPng, smallJpg, corruptJpg]
      .forEach((file) => transfer.items.add(file));
    const input = document.querySelector('input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return window.__inputSizes;
  })()
`;

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await session.trackObjectUrls();

await navigate(targetUrl);
assert.equal(
  await evaluate(
    `document.querySelector('input[name="compressor-purpose"][value="exact"]')?.checked`
  ),
  true
);
assert.equal(
  await evaluate(`Boolean(document.querySelector('meta[name="robots"]'))`),
  false,
  'Implemented target page must be indexable'
);

const inputSizes = await evaluate(makeFilesExpression);
await waitFor(`document.querySelectorAll('.file-item').length === 5`, 'five compressor inputs');
assert.equal(
  await evaluate(`Number(document.querySelector('input[aria-label="Target Size (KB)"]').value)`),
  100
);
// No submit step: the exact-size run starts from the selected purpose itself.
await waitFor(
  `document.querySelector('[data-batch-success-count="4"][data-batch-failure-count="1"]') && !document.body.innerText.includes('Encoding in your browser…')`,
  'mixed target-size results'
);

assert.equal(
  await evaluate(`document.body.innerText.includes('corrupt.jpg:')`),
  true,
  'Corrupt JPEG should report an independent error'
);

const targetResults = await evaluate(`
  (async () => Promise.all(
    [...document.querySelectorAll('.result-item')].map(async (item) => {
      const link = item.querySelector('a[download]');
      const blob = await fetch(link.href).then((response) => response.blob());
      return {
        name: link.download,
        size: blob.size,
        type: blob.type,
        text: item.innerText.replace(/\\s+/g, ' ').trim(),
      };
    })
  ))()
`);

const byName = Object.fromEntries(targetResults.map((result) => [result.name, result]));
for (const name of ['large.jpg', 'large.webp']) {
  assert.equal(byName[name].size <= 100 * 1024, true, `${name} must meet 100KB`);
  assert.equal(byName[name].text.includes('Target met:'), true);
}
assert.equal(byName['small.jpg'].size, inputSizes['small.jpg']);
assert.equal(byName['small.jpg'].text.includes('Already within the 100 KB target'), true);
assert.equal(byName['complex.png'].size > 100 * 1024, true);
assert.equal(byName['complex.png'].text.includes('Target not met'), true);
assert.equal(byName['complex.png'].type, 'image/png');

const targetStats = await evaluate(`window.__objectUrlStats()`);
assert.deepEqual(targetStats, { created: 14, revoked: 5, active: 9 });

const attempts = targetResults.flatMap(({ text }) =>
  [...text.matchAll(/\| (\d+) attempts?/g)].map((match) => Number(match[1]))
);
assert.equal(attempts.length, 4, 'Every successful target result should report attempts');
assert.equal(
  attempts.every((count) => count <= 63),
  true,
  'Target iterations must be bounded'
);

await navigate(qualityUrl);
assert.equal(
  await evaluate(
    `document.querySelector('input[name="compressor-purpose"][value="web"]')?.checked`
  ),
  true
);
const tinyInputSize = await evaluate(`
  (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    context.fillStyle = '#336699';
    context.fillRect(0, 0, 16, 16);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.2));
    const file = new File([blob], 'tiny.jpg', { type: 'image/jpeg' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return file.size;
  })()
`);
await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'tiny JPEG input');
await waitFor(
  `document.querySelector('[data-batch-success-count="1"][data-batch-failure-count="0"]')`,
  'quality result'
);
const qualityResult = await evaluate(`
  (async () => {
    const item = document.querySelector('.result-item');
    const link = item.querySelector('a[download]');
    const blob = await fetch(link.href).then((response) => response.blob());
    return { size: blob.size, text: item.innerText.replace(/\\s+/g, ' ').trim() };
  })()
`);
assert.equal(qualityResult.size, tinyInputSize);
assert.equal(qualityResult.text.includes('No smaller result was found; original kept.'), true);
assert.equal(qualityResult.text.includes('--'), false, 'Double-negative saving must not appear');

// Variant routes: the URL is the page's promise, so the purpose chip must open on
// the purpose the route names. The email and WhatsApp pages used to open on
// "Web page", and nothing checked. The expectations are written out here rather
// than read from the variant data, so a wrong entry there is caught too.
const variantPurposes = [
  ['compress-png', 'web'],
  ['compress-jpg', 'web'],
  ['compress-for-email', 'email'],
  ['compress-for-web', 'web'],
  ['compress-for-whatsapp', 'chat'],
  ['compress-to-100kb', 'exact'],
];
const variantResults = {};
for (const [slug, purpose] of variantPurposes) {
  await navigate(`${baseUrl}/tools/image-compressor/${slug}/`);
  const lit = await evaluate(
    `document.querySelector('input[name="compressor-purpose"]:checked')?.value ?? null`
  );
  assert.equal(lit, purpose, `${slug} should open on the ${purpose} purpose`);
  variantResults[slug] = lit;
}

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await session.close();

console.log(
  JSON.stringify({
    status: 'IMAGE_COMPRESSOR_BROWSER_OK',
    targetResults: targetResults.map(({ name, size }) => ({ name, size })),
    targetStats,
    maxAttempts: Math.max(...attempts),
    qualityOriginalBytes: tinyInputSize,
    qualityOutputBytes: qualityResult.size,
    variantResults,
    browserErrors: actionableBrowserErrors.length,
  })
);
