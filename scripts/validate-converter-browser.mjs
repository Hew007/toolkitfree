import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const root = process.cwd();
const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9223';
const browserName = process.env.BROWSER_NAME || 'Chrome';
const runExtended = process.env.EXTENDED === '1';
const baseUrl = `${process.env.BASE_URL || 'http://127.0.0.1:4321'}/tools/image-converter`;
const fixtures = path.join(root, 'docs/optimization/baseline/fixtures');
const tempDir =
  process.env.BROWSER_TEMP_DIR || path.join(root, `.tmp-opt03-${browserName.toLowerCase()}`);
const downloadDir = path.join(tempDir, 'downloads');
const samplePng = path.join(tempDir, 'sample.png');
const sampleBmp = path.join(tempDir, 'sample.bmp');

fs.mkdirSync(downloadDir, { recursive: true });
fs.copyFileSync(path.join(fixtures, 'transparent.png'), samplePng);

function createBmp() {
  const width = 2;
  const height = 2;
  const rowSize = 8;
  const pixelBytes = rowSize * height;
  const buffer = Buffer.alloc(54 + pixelBytes);
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelBytes, 34);
  const colors = [
    [0, 0, 255],
    [0, 255, 0],
    [255, 0, 0],
    [255, 255, 255],
  ];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [blue, green, red] = colors[y * width + x];
      const offset = 54 + y * rowSize + x * 3;
      buffer[offset] = blue;
      buffer[offset + 1] = green;
      buffer[offset + 2] = red;
    }
  }
  fs.writeFileSync(sampleBmp, buffer);
}
createBmp();

const target = await fetch(`${endpoint}/json/new?${encodeURIComponent('about:blank')}`, {
  method: 'PUT',
}).then((response) => {
  if (!response.ok) throw new Error(`Could not create browser target: ${response.status}`);
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
    if (message.error) request.reject(new Error(request.method + ': ' + message.error.message));
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
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
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

async function waitFor(expression, label, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(route) {
  await send('Page.navigate', { url: `${baseUrl}${route}` });
  await waitFor(
    `Boolean(document.querySelector('input[type="file"]')) && !document.querySelector('astro-island[ssr]')`,
    `${route || 'main'} hydration`
  );
}

async function setFiles(filePaths) {
  const documentNode = await send('DOM.getDocument');
  const inputNode = await send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type="file"]',
  });
  assert.notEqual(inputNode.nodeId, 0, 'File input should exist');
  await send('DOM.setFileInputFiles', {
    nodeId: inputNode.nodeId,
    files: filePaths,
  });
}

async function convertVariant({ route, fixture, accept, outputMime, extension }) {
  await navigate(route);
  assert.equal(
    await evaluate(`document.querySelector('input[type="file"]').accept`),
    accept,
    `${route} accept`
  );
  await setFiles([fixture]);
  await waitFor(`document.querySelectorAll('.file-item').length === 1`, `${route} file list`);
  assert.equal(
    await evaluate(`document.querySelector('select[aria-label="Output Format"]').value`),
    outputMime,
    `${route} default output`
  );
  await evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Convert 1 image')
      .click()
  `);
  await waitFor(
    `document.querySelector('[data-batch-success-count="1"][data-batch-failure-count="0"]')`,
    `${route} result`
  );
  const output = await evaluate(`
    (async () => {
      const link = document.querySelector('.result-item a[download]');
      const blob = await fetch(link.href).then((response) => response.blob());
      return { name: link.download, type: blob.type, size: blob.size };
    })()
  `);
  assert.equal(output.type, outputMime, `${route} MIME`);
  assert.equal(output.name.endsWith(extension), true, `${route} extension`);
  assert.equal(output.size > 0, true, `${route} output size`);
  return output;
}

await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');
await send('Log.enable');
await send('Browser.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: downloadDir,
  eventsEnabled: true,
});
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

const matrix = [
  {
    route: '/jpg-to-png/',
    fixture: path.join(fixtures, 'photo.jpg'),
    accept: 'image/jpeg',
    outputMime: 'image/png',
    extension: '.png',
  },
  {
    route: '/jpg-to-webp/',
    fixture: path.join(fixtures, 'photo.jpg'),
    accept: 'image/jpeg',
    outputMime: 'image/webp',
    extension: '.webp',
  },
  {
    route: '/png-to-jpg/',
    fixture: path.join(fixtures, 'transparent.png'),
    accept: 'image/png',
    outputMime: 'image/jpeg',
    extension: '.jpg',
  },
  {
    route: '/png-to-webp/',
    fixture: path.join(fixtures, 'transparent.png'),
    accept: 'image/png',
    outputMime: 'image/webp',
    extension: '.webp',
  },
  {
    route: '/webp-to-jpg/',
    fixture: path.join(fixtures, 'sample.webp'),
    accept: 'image/webp',
    outputMime: 'image/jpeg',
    extension: '.jpg',
  },
  {
    route: '/webp-to-png/',
    fixture: path.join(fixtures, 'sample.webp'),
    accept: 'image/webp',
    outputMime: 'image/png',
    extension: '.png',
  },
  {
    route: '/gif-to-png/',
    fixture: path.join(fixtures, 'sample.gif'),
    accept: 'image/gif',
    outputMime: 'image/png',
    extension: '.png',
  },
  {
    route: '/bmp-to-png/',
    fixture: sampleBmp,
    accept: 'image/bmp,image/x-ms-bmp',
    outputMime: 'image/png',
    extension: '.png',
  },
  {
    route: '/svg-to-png/',
    fixture: path.join(fixtures, 'vector.svg'),
    accept: 'image/svg+xml',
    outputMime: 'image/png',
    extension: '.png',
  },
];

const matrixResults = [];
for (const item of matrix) matrixResults.push(await convertVariant(item));

if (runExtended) {
  await navigate('/');
  assert.equal(
    await evaluate(`document.querySelector('input[type="file"]').accept`),
    'image/jpeg,image/png,image/webp'
  );
  await setFiles([
    path.join(fixtures, 'sample.webp'),
    samplePng,
    path.join(fixtures, 'invalid.txt'),
    path.join(fixtures, 'empty.bin'),
  ]);
  await waitFor(`document.querySelectorAll('.file-item').length === 4`, 'mixed batch files');
  await evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Convert 4 images')
      .click()
  `);
  await waitFor(
    `document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="2"]')`,
    'partial batch success'
  );
  assert.equal(
    await evaluate(
      `document.body.innerText.includes('invalid.txt:') && document.body.innerText.includes('empty.bin:')`
    ),
    true
  );
  const batchOutputs = await evaluate(`
    (async () => Promise.all(
      [...document.querySelectorAll('.result-item a[download]')].map(async (link) => {
        const blob = await fetch(link.href).then((response) => response.blob());
        return { name: link.download, type: blob.type, size: blob.size };
      })
    ))()
  `);
  assert.deepEqual(
    batchOutputs.map(({ name }) => name),
    ['sample.png', 'sample-2.png']
  );
  assert.equal(
    batchOutputs.every(({ type }) => type === 'image/png'),
    true
  );
  assert.deepEqual(await evaluate(`window.__objectUrlStats()`), {
    created: 4,
    revoked: 2,
    active: 2,
  });

  await evaluate(`document.querySelector('.result-item a[download]').click()`);
  const downloadedPng = path.join(downloadDir, 'sample.png');
  const downloadStarted = Date.now();
  while (!fs.existsSync(downloadedPng) && Date.now() - downloadStarted < 10_000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(fs.existsSync(downloadedPng), true);
  assert.deepEqual(
    [...fs.readFileSync(downloadedPng).subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );

  await navigate('/png-to-jpg/');
  await setFiles([path.join(fixtures, 'transparent.png')]);
  await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'transparent PNG');
  await evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Convert 1 image')
      .click()
  `);
  await waitFor(
    `document.querySelector('[data-batch-success-count="1"][data-batch-failure-count="0"]')`,
    'transparent PNG to JPG'
  );
  const whiteBackground = await evaluate(`
    (async () => {
      const source = document.querySelector('input[type="file"]').files[0];
      const outputUrl = document.querySelector('.result-item a[download]').href;
      const read = async (blob) => {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        return {
          width: bitmap.width,
          height: bitmap.height,
          pixels: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
        };
      };
      const original = await read(source);
      const output = await read(await fetch(outputUrl).then((response) => response.blob()));
      let transparentPixel = -1;
      for (let index = 3; index < original.pixels.length; index += 4) {
        if (original.pixels[index] === 0) {
          transparentPixel = index - 3;
          break;
        }
      }
      const red = output.pixels[transparentPixel];
      const green = output.pixels[transparentPixel + 1];
      const blue = output.pixels[transparentPixel + 2];
      return { transparentPixel, red, green, blue };
    })()
  `);
  assert.equal(whiteBackground.transparentPixel >= 0, true);
  assert.equal(
    whiteBackground.red > 240 && whiteBackground.green > 240 && whiteBackground.blue > 240,
    true,
    'Transparent PNG pixels should become white in JPG'
  );

  await navigate('/png-to-webp/');
  await setFiles([path.join(fixtures, 'transparent.png')]);
  await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'transparent PNG for WebP');
  await evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Convert 1 image')
      .click()
  `);
  await waitFor(
    `document.querySelector('[data-batch-success-count="1"][data-batch-failure-count="0"]')`,
    'transparent PNG to WebP'
  );
  const webpTransparency = await evaluate(`
    (async () => {
      const source = document.querySelector('input[type="file"]').files[0];
      const outputUrl = document.querySelector('.result-item a[download]').href;
      const read = async (blob) => {
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const original = await read(source);
      const output = await read(await fetch(outputUrl).then((response) => response.blob()));
      let transparentPixel = -1;
      for (let index = 3; index < original.length; index += 4) {
        if (original[index] === 0) {
          transparentPixel = index;
          break;
        }
      }
      return { transparentPixel, outputAlpha: output[transparentPixel] };
    })()
  `);
  assert.equal(webpTransparency.transparentPixel >= 0, true);
  assert.equal(webpTransparency.outputAlpha, 0, 'Transparent PNG alpha should remain transparent');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const mobileResult = await convertVariant(matrix[1]);
  assert.equal(mobileResult.type, 'image/webp');
  assert.equal(
    await evaluate(`document.querySelector('.result-item').getBoundingClientRect().width > 0`),
    true
  );
  await send('Emulation.clearDeviceMetricsOverride');
}

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'IMAGE_CONVERTER_BROWSER_OK',
    browser: browserName,
    matrixCases: matrixResults.length,
    extended: runExtended,
    browserErrors: actionableBrowserErrors.length,
  })
);
