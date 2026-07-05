import assert from 'node:assert/strict';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9225';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
const targetUrl = `${baseUrl}/tools/image-compressor/compress-to-100kb`;
const qualityUrl = `${baseUrl}/tools/image-compressor`;

const target = await fetch(`${endpoint}/json/new?${encodeURIComponent('about:blank')}`, {
  method: 'PUT',
}).then((response) => {
  if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
  return response.json();
});

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const browserErrors = [];

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    browserErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    browserErrors.push(message.params.entry.text);
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, label, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(url) {
  await send('Page.navigate', { url });
  await waitFor(
    `Boolean(document.querySelector('input[type="file"]')) && !document.querySelector('astro-island[ssr]')`,
    `${url} hydration`
  );
}

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
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    (() => {
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      const active = new Set();
      const stats = { created: 0, revoked: 0 };
      URL.createObjectURL = (value) => {
        const url = create(value);
        stats.created += 1;
        active.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        stats.revoked += 1;
        active.delete(url);
        return revoke(url);
      };
      window.__objectUrlStats = () => ({ ...stats, active: active.size });
    })();
  `,
});

await navigate(targetUrl);
assert.equal(
  await evaluate(`document.querySelector('select[aria-label="Compression Mode"]').value`),
  'target'
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
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Compress 5 images')
    .click()
`);
await waitFor(
  `document.querySelector('[data-batch-success-count="4"][data-batch-failure-count="1"]') && !document.body.innerText.includes('Compressing...')`,
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
assert.deepEqual(targetStats, { created: 9, revoked: 5, active: 4 });

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
  await evaluate(`document.querySelector('select[aria-label="Compression Mode"]').value`),
  'quality'
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
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Compress 1 image')
    .click()
`);
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

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'IMAGE_COMPRESSOR_BROWSER_OK',
    targetResults: targetResults.map(({ name, size }) => ({ name, size })),
    targetStats,
    maxAttempts: Math.max(...attempts),
    qualityOriginalBytes: tinyInputSize,
    qualityOutputBytes: qualityResult.size,
    browserErrors: actionableBrowserErrors.length,
  })
);
