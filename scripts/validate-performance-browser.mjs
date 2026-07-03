import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9229';
const baseUrl = 'http://127.0.0.1:4321';
const assetDirectory = path.join(root, 'dist', '_astro');

function findAsset(prefix) {
  const match = fs.readdirSync(assetDirectory).find((name) => name.startsWith(prefix));
  if (!match) throw new Error(`Could not find built asset with prefix ${prefix}`);
  return match;
}

const heavyAssets = {
  jszip: findAsset('jszip.min.'),
  jspdf: findAsset('jspdf.es.min.'),
  qr: findAsset('qr-code-styling.'),
  background: findAsset('index.re'),
};

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
let requests = [];
const requestUrls = new Map();

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
  if (message.method === 'Network.requestWillBeSent') {
    requestUrls.set(message.params.requestId, message.params.request.url);
  }
  if (message.method === 'Network.loadingFinished') {
    const url = requestUrls.get(message.params.requestId);
    if (url) requests.push({ url, bytes: message.params.encodedDataLength });
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

async function waitFor(expression, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForRequest(filename, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (requests.some(({ url }) => url.includes(filename))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}: ${filename}`);
}

async function navigate(route) {
  requests = [];
  requestUrls.clear();
  await send('Page.navigate', { url: `${baseUrl}${route}` });
  await waitFor(
    `document.readyState === 'complete' && !document.querySelector('astro-island[ssr]')`,
    `${route} hydration`
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
}

function requested(filename) {
  return requests.some(({ url }) => url.includes(filename));
}

function requestSummary() {
  const clientAssets = requests.filter(({ url }) => /\/_astro\/.*\.(?:js|mjs|css|wasm)$/.test(url));
  return {
    count: clientAssets.length,
    bytes: Math.round(clientAssets.reduce((sum, request) => sum + request.bytes, 0)),
    files: clientAssets.map(({ url }) => url.split('/').at(-1)).sort(),
  };
}

async function uploadGeneratedPng({ name, width, height, headerOnly = false }) {
  return evaluate(`
    (async () => {
      let file;
      if (${headerOnly}) {
        const bytes = new Uint8Array(24);
        bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
        bytes.set([0x49, 0x48, 0x44, 0x52], 12);
        const view = new DataView(bytes.buffer);
        view.setUint32(16, ${width});
        view.setUint32(20, ${height});
        file = new File([bytes], ${JSON.stringify(name)}, { type: 'image/png' });
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = ${width};
        canvas.height = ${height};
        const context = canvas.getContext('2d');
        context.fillStyle = '#2563eb';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        file = new File([blob], ${JSON.stringify(name)}, { type: 'image/png' });
      }
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector('input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { name: file.name, size: file.size };
    })()
  `);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Log.enable');
await send('Browser.setDownloadBehavior', { behavior: 'deny' });

const idle = {};
for (const [route, forbidden] of [
  ['/', Object.values(heavyAssets)],
  ['/tools/image-converter', Object.values(heavyAssets)],
  ['/tools/image-to-pdf', [heavyAssets.jspdf, heavyAssets.jszip, heavyAssets.qr, heavyAssets.background]],
  ['/tools/favicon-generator', [heavyAssets.jszip, heavyAssets.jspdf, heavyAssets.qr, heavyAssets.background]],
  ['/tools/qr-generator', [heavyAssets.qr, heavyAssets.jszip, heavyAssets.jspdf, heavyAssets.background]],
  ['/tools/background-remover', [
    heavyAssets.background,
    heavyAssets.jszip,
    heavyAssets.jspdf,
    heavyAssets.qr,
    'ort.bundle',
    'ort.webgpu',
    '.wasm',
  ]],
]) {
  await navigate(route);
  for (const filename of forbidden) {
    assert.equal(requested(filename), false, `${route} should not request ${filename} while idle`);
  }
  idle[route] = requestSummary();
}

await navigate('/tools/image-converter');
await uploadGeneratedPng({ name: 'one.png', width: 96, height: 64 });
await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'converter file');
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Convert 1 image')
    .click()
`);
await waitFor(`Boolean(document.querySelector('[data-batch-download]'))`, 'converter result');
assert.equal(requested(heavyAssets.jszip), false, 'JSZip should remain unloaded before ZIP action');
await evaluate(`document.querySelector('[data-batch-download]').click()`);
await waitForRequest(heavyAssets.jszip, 'JSZip dynamic request');

await navigate('/tools/image-to-pdf');
await uploadGeneratedPng({ name: 'page.png', width: 96, height: 64 });
await waitFor(`Boolean(document.querySelector('[data-pdf-file]'))`, 'PDF file');
assert.equal(requested(heavyAssets.jspdf), false);
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.includes('to PDF'))
    .click()
`);
await waitForRequest(heavyAssets.jspdf, 'jsPDF dynamic request');
await waitFor(`Boolean(document.querySelector('[data-pdf-result]'))`, 'PDF result');

await navigate('/tools/favicon-generator');
await uploadGeneratedPng({ name: 'favicon.png', width: 96, height: 64 });
await waitFor(`document.body.innerText.includes('Generate Favicons')`, 'favicon file');
assert.equal(requested(heavyAssets.jszip), false);
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Generate Favicons')
    .click()
`);
await waitForRequest(heavyAssets.jszip, 'Favicon JSZip dynamic request');
await waitFor(`Boolean(document.querySelector('[data-favicon-zip-url]'))`, 'favicon ZIP');

await navigate('/tools/qr-generator');
assert.equal(requested(heavyAssets.qr), false);
await evaluate(`
  (() => {
    const textarea = document.querySelector('#qr-text');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, 'https://example.com');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitForRequest(heavyAssets.qr, 'QR library dynamic request');
await waitFor(`document.querySelector('[data-qr-ready="true"] canvas, [data-qr-ready="true"] svg')`, 'QR output');

await send('Emulation.setDeviceMetricsOverride', {
  width: 375,
  height: 812,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigate('/tools/image-converter');
await uploadGeneratedPng({ name: 'warning.png', width: 6000, height: 6000, headerOnly: true });
await waitFor(`Boolean(document.querySelector('[data-input-budget="warning"]'))`, 'budget warning');
assert.equal(await evaluate(`document.querySelectorAll('.file-item').length`), 0);
assert.equal(
  await evaluate(`Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Continue anyway'))`),
  true
);
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Continue anyway')
    .click()
`);
await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'warning override');

await navigate('/tools/image-converter');
await uploadGeneratedPng({ name: 'blocked.png', width: 12000, height: 10000, headerOnly: true });
await waitFor(`Boolean(document.querySelector('[data-input-budget="blocked"]'))`, 'budget block');
assert.equal(await evaluate(`document.querySelectorAll('.file-item').length`), 0);
assert.equal(
  await evaluate(`Boolean([...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Continue anyway'))`),
  false
);

assert.deepEqual(browserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(JSON.stringify({
  status: 'PERFORMANCE_BROWSER_OK',
  heavyAssets,
  idle,
  dynamicLoads: {
    jszip: true,
    jspdf: true,
    faviconZip: true,
    qr: true,
  },
  budget: {
    warningOverride: true,
    blockedAt120MillionPixels: true,
  },
  browserErrors: browserErrors.length,
}));
