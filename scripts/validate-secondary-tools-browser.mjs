import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9227';
const baseUrl = 'http://127.0.0.1:4321';
const downloadPath = process.env.BROWSER_DOWNLOAD_DIR || 'C:\\tmp\\toolkitfree-opt06-downloads';
fs.rmSync(downloadPath, { recursive: true, force: true });
fs.mkdirSync(downloadPath, { recursive: true });

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
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function waitFor(expression, label, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForFile(filename, timeoutMs = 30_000) {
  const fullPath = path.join(downloadPath, filename);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) return fullPath;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for download ${filename}`);
}

async function navigate(route) {
  await send('Page.navigate', { url: `${baseUrl}${route}` });
  await waitFor(
    `Boolean(document.querySelector('astro-island')) && !document.querySelector('astro-island[ssr]')`,
    `${route} hydration`
  );
}

const makeImageFiles = `
  (async (definitions) => {
    const files = [];
    for (const definition of definitions) {
      if (definition.corrupt) {
        files.push(new File([new Uint8Array([1, 2, 3, 4])], definition.name, { type: definition.type }));
        continue;
      }
      const canvas = document.createElement('canvas');
      canvas.width = definition.width;
      canvas.height = definition.height;
      const context = canvas.getContext('2d');
      if (!definition.transparent) {
        context.fillStyle = definition.background || '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (definition.kind === 'portrait') {
        context.fillStyle = '#2563eb';
        context.beginPath();
        context.arc(canvas.width / 2, canvas.height * 0.3, canvas.width * 0.16, 0, Math.PI * 2);
        context.fill();
        context.fillRect(canvas.width * 0.32, canvas.height * 0.47, canvas.width * 0.36, canvas.height * 0.42);
      } else if (definition.kind === 'product') {
        context.fillStyle = '#dc2626';
        context.fillRect(canvas.width * 0.25, canvas.height * 0.25, canvas.width * 0.5, canvas.height * 0.5);
      } else {
        context.fillStyle = definition.color || '#16a34a';
        context.fillRect(canvas.width * 0.1, canvas.height * 0.15, canvas.width * 0.8, canvas.height * 0.7);
      }
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, definition.type, definition.type === 'image/jpeg' ? 0.9 : undefined)
      );
      files.push(new File([blob], definition.name, { type: definition.type }));
    }
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    const input = document.querySelector('input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return files.map((file) => ({ name: file.name, size: file.size, type: file.type }));
  })
`;

async function upload(definitions) {
  return evaluate(`(${makeImageFiles})(${JSON.stringify(definitions)})`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath });
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

const pdfVariants = [
  ['jpg-to-pdf', 'jpg', 'a4', 'image/jpeg'],
  ['png-to-pdf', 'png', 'a4', 'image/png'],
  ['image-to-a4-pdf', 'a4', 'a4', 'image/jpeg,image/png,image/webp'],
  ['multiple-images-to-pdf', 'multiple', 'a4', 'image/jpeg,image/png,image/webp'],
  ['image-to-pdf-no-margin', 'no_margin', 'fit', 'image/jpeg,image/png,image/webp'],
  ['photo-to-pdf', 'photo', 'a4', 'image/jpeg,image/png,image/webp'],
];
for (const [slug, preset, pageSize, accept] of pdfVariants) {
  await navigate(`/tools/image-to-pdf/${slug}`);
  const state = await evaluate(`(() => {
    const root = document.querySelector('[data-pdf-preset]');
    return {
      preset: root.dataset.pdfPreset,
      pageSize: root.dataset.pageSize,
      margin: Number(root.dataset.margin),
      accept: document.querySelector('input[type="file"]').accept,
    };
  })()`);
  assert.equal(state.preset, preset, slug);
  assert.equal(state.pageSize, pageSize, slug);
  assert.equal(state.margin, preset === 'no_margin' ? 0 : 10, slug);
  assert.equal(state.accept, accept, slug);
}

await navigate('/tools/image-to-pdf/multiple-images-to-pdf');
await upload([
  { name: 'first.png', type: 'image/png', width: 400, height: 200, color: '#ef4444' },
  { name: 'second.png', type: 'image/png', width: 200, height: 400, color: '#22c55e', transparent: true },
  { name: 'broken.png', type: 'image/png', corrupt: true },
]);
await waitFor(`document.querySelectorAll('[data-pdf-file]').length === 3`, 'three PDF inputs');
await evaluate(`document.querySelector('button[aria-label="Move second.png up"]').click()`);
await waitFor(
  `document.querySelector('[data-pdf-file]')?.dataset.pdfFile === 'second.png'`,
  'PDF reorder'
);
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Convert 3 images to PDF')
    .click()
`);
await waitFor(`Boolean(document.querySelector('[data-pdf-result]'))`, 'partial PDF result');
assert.equal(await evaluate(`Boolean(document.querySelector('[data-pdf-error="broken.png"]'))`), true);
assert.equal(await evaluate(`Number(document.querySelector('[data-pdf-result]').dataset.pages)`), 2);
const pdfBase64 = await evaluate(`
  (async () => {
    const url = document.querySelector('[data-pdf-result]').dataset.pdfUrl;
    const buffer = await fetch(url).then((response) => response.arrayBuffer());
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary);
  })()
`);
const pdfBuffer = Buffer.from(pdfBase64, 'base64');
const pdfText = pdfBuffer.toString('latin1');
assert.equal(pdfText.startsWith('%PDF-'), true);
assert.equal(pdfText.trimEnd().endsWith('%%EOF'), true);
assert.equal((pdfText.match(/\/Type \/Page\b/g) || []).length, 2);
assert.equal((pdfText.match(/\/MediaBox/g) || []).length >= 2, true);
const pdfStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(pdfStats.active, 4, 'Three previews plus one PDF result should remain active');

await navigate('/tools/image-to-pdf/image-to-pdf-no-margin');
await upload([{ name: 'wide.png', type: 'image/png', width: 400, height: 200 }]);
await waitFor(`Boolean(document.querySelector('[data-pdf-file]'))`, 'fit PDF input');
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Convert 1 image to PDF')
    .click()
`);
await waitFor(`Boolean(document.querySelector('[data-pdf-result]'))`, 'fit PDF result');
const fitPdfBase64 = await evaluate(`
  (async () => {
    const url = document.querySelector('[data-pdf-result]').dataset.pdfUrl;
    const buffer = await fetch(url).then((response) => response.arrayBuffer());
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  })()
`);
const fitPdfText = Buffer.from(fitPdfBase64, 'base64').toString('latin1');
const mediaBox = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(fitPdfText);
assert.ok(mediaBox, 'Fit PDF must include a MediaBox');
assert.equal(Math.abs(Number(mediaBox[1]) / Number(mediaBox[2]) - 2) < 0.01, true);

await navigate('/tools/favicon-generator');
await upload([
  {
    name: 'wide-logo.png',
    type: 'image/png',
    width: 120,
    height: 60,
    color: '#2563eb',
    transparent: true,
  },
]);
await waitFor(
  `[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Generate Favicons')`,
  'favicon input'
);
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Generate Favicons')
    .click()
`);
await waitFor(`document.querySelectorAll('[data-favicon-icon]').length === 5`, 'five favicon outputs');
const faviconResults = await evaluate(`
  (async () => Promise.all(
    [...document.querySelectorAll('[data-favicon-icon]')].map(async (item) => {
      const blob = await fetch(item.querySelector('img').src).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const result = {
        name: item.dataset.faviconIcon,
        declared: Number(item.dataset.size),
        width: bitmap.width,
        height: bitmap.height,
        type: blob.type,
      };
      bitmap.close();
      return result;
    })
  ))()
`);
for (const icon of faviconResults) {
  assert.equal(icon.width, icon.declared);
  assert.equal(icon.height, icon.declared);
  assert.equal(icon.type, 'image/png');
}
const paddingPixels = await evaluate(`
  (async () => {
    const image = document.querySelector('[data-favicon-icon="android-chrome-512x512.png"] img');
    const blob = await fetch(image.src).then((response) => response.blob());
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const top = context.getImageData(256, 32, 1, 1).data;
    const center = context.getImageData(256, 256, 1, 1).data;
    bitmap.close();
    return { topAlpha: top[3], centerAlpha: center[3] };
  })()
`);
assert.equal(paddingPixels.topAlpha, 0);
assert.equal(paddingPixels.centerAlpha, 255);
const zipBase64 = await evaluate(`
  (async () => {
    const url = document.querySelector('[data-favicon-zip-url]').dataset.faviconZipUrl;
    const buffer = await fetch(url).then((response) => response.arrayBuffer());
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  })()
`);
const zip = await JSZip.loadAsync(Buffer.from(zipBase64, 'base64'));
const zipNames = Object.keys(zip.files).sort();
assert.deepEqual(zipNames, [
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'site.webmanifest',
]);
const manifest = JSON.parse(await zip.file('site.webmanifest').async('string'));
assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
assert.equal(await evaluate(`document.querySelector('pre').innerText.includes('.ico')`), false);

await navigate('/tools/qr-generator');
assert.equal(await evaluate(`Boolean(document.querySelector('[data-qr-ready="true"]'))`), false);
assert.equal(await evaluate(`document.querySelectorAll('button').length > 0 && !document.body.innerText.includes('Download PNG')`), true);
await evaluate(`
  (() => {
    const input = document.querySelector('textarea[placeholder="Enter text or URL..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, 'https://example.com/a?x=1&y=2');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitFor(
  `document.querySelector('[data-qr-data]')?.dataset.qrData === 'https://example.com/a?x=1&y=2'`,
  'text QR data'
);
await waitFor(`Boolean(document.querySelector('[data-qr-data] canvas'))`, 'QR canvas');

await evaluate(`document.querySelector('[data-qr-tab="wifi"]').click()`);
await waitFor(`document.querySelector('[data-qr-input-type]').dataset.qrInputType === 'wifi'`, 'WiFi tab');
await evaluate(`
  (() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const ssid = document.querySelector('input[placeholder="MyWiFi"]');
    setter.call(ssid, 'Cafe;5G');
    ssid.dispatchEvent(new Event('input', { bubbles: true }));
    const password = document.querySelector('input[placeholder="WiFi password"]');
    setter.call(password, 'p,a:ss\\\\word');
    password.dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitFor(
  `document.querySelector('[data-qr-data]')?.dataset.qrData === 'WIFI:T:WPA;S:Cafe\\\\;5G;P:p\\\\,a\\\\:ss\\\\\\\\word;;'`,
  'escaped WiFi QR data'
);

await evaluate(`document.querySelector('[data-qr-tab="vcard"]').click()`);
await waitFor(`document.querySelector('[data-qr-input-type]').dataset.qrInputType === 'vcard'`, 'vCard tab');
await evaluate(`
  (() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const first = document.querySelector('input[placeholder="John"]');
    setter.call(first, 'Ana;Marie');
    first.dispatchEvent(new Event('input', { bubbles: true }));
    const last = document.querySelector('input[placeholder="Doe"]');
    setter.call(last, 'O,Neil');
    last.dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitFor(
  `document.querySelector('[data-qr-data]')?.dataset.qrData.includes('N:O\\\\,Neil;Ana\\\\;Marie;;;')`,
  'escaped vCard QR data'
);

await evaluate(`document.querySelector('[data-qr-tab="text"]').click()`);
await waitFor(`document.querySelector('[data-qr-input-type]').dataset.qrInputType === 'text'`, 'Text tab');
await evaluate(`
  (() => {
    const input = document.querySelector('textarea[placeholder="Enter text or URL..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, 'download-check');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitFor(`document.querySelector('[data-qr-data]')?.dataset.qrData === 'download-check'`, 'download QR');
await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Download PNG').click()`);
await waitForFile('qrcode.png');
await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Download SVG').click()`);
await waitForFile('qrcode.svg');
const pngBytes = fs.readFileSync(path.join(downloadPath, 'qrcode.png'));
assert.equal(pngBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
const svgText = fs.readFileSync(path.join(downloadPath, 'qrcode.svg'), 'utf8');
assert.equal(svgText.includes('<svg'), true);
assert.equal(svgText.includes('<path') || svgText.includes('<rect'), true);

await evaluate(`
  (() => {
    const colors = document.querySelectorAll('input[type="color"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(colors[0], '#777777');
    colors[0].dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(colors[1], '#777777');
    colors[1].dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitFor(`Boolean(document.querySelector('[data-qr-contrast-warning]'))`, 'QR contrast warning');
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Download PNG').disabled`
  ),
  true
);

await navigate('/tools/background-remover');
await upload([{ name: 'corrupt.png', type: 'image/png', corrupt: true }]);
await waitFor(`document.body.innerText.includes('corrupt.png')`, 'corrupt background input');
await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').click()`);
await waitFor(`Boolean(document.querySelector('.status-error'))`, 'background error recovery', 180_000);
assert.equal(await evaluate(`Boolean(document.querySelector('button[aria-label="Remove corrupt.png"]'))`), true);
await evaluate(`document.querySelector('button[aria-label="Remove corrupt.png"]').click()`);
await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, 'background input reset');

const backgroundCases = [
  { name: 'portrait.png', kind: 'portrait', background: '#f3f4f6', color: 'transparent' },
  { name: 'product.png', kind: 'product', background: '#ffffff', color: '#0000ff' },
  { name: 'transparent.png', kind: 'product', transparent: true, color: 'transparent' },
];
const backgroundResults = [];
const backgroundCleanupStats = [];
for (const definition of backgroundCases) {
  await upload([
    {
      name: definition.name,
      type: 'image/png',
      width: 96,
      height: 96,
      kind: definition.kind,
      background: definition.background,
      transparent: definition.transparent,
    },
  ]);
  await waitFor(`document.body.innerText.includes('${definition.name}')`, `${definition.name} input`);
  if (definition.color !== 'transparent') {
    await evaluate(`document.querySelector('[data-background-color="${definition.color}"]').click()`);
  }
  await evaluate(`
    (() => {
      window.__backgroundStages = [];
      const observer = new MutationObserver(() => {
        const stage = document.querySelector('[data-background-stage]')?.dataset.backgroundStage;
        if (stage && !window.__backgroundStages.includes(stage)) window.__backgroundStages.push(stage);
      });
      observer.observe(document.body, { subtree: true, attributes: true, childList: true });
      window.__backgroundObserver = observer;
    })()
  `);
  await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').click()`);
  await waitFor(`Boolean(document.querySelector('[data-background-result]'))`, `${definition.name} background result`, 240_000);
  const inspected = await evaluate(`
    (async () => {
      window.__backgroundObserver?.disconnect();
      const image = document.querySelector('[data-background-result]').previousElementSibling.querySelector('img[alt="Result"]');
      const blob = await fetch(image.src).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const corner = [...context.getImageData(0, 0, 1, 1).data];
      bitmap.close();
      return {
        name: document.querySelector('[data-background-result]').dataset.backgroundResult,
        type: blob.type,
        width: canvas.width,
        height: canvas.height,
        corner,
        stages: window.__backgroundStages,
      };
    })()
  `);
  assert.equal(inspected.type, 'image/png');
  assert.equal(inspected.width > 0 && inspected.height > 0, true);
  assert.equal(inspected.stages.includes('runtime'), true);
  assert.equal(inspected.stages.includes('model-initialization') || inspected.stages.includes('model-download'), true);
  if (definition.color === '#0000ff') {
    assert.equal(inspected.corner[2] > inspected.corner[0], true, 'Colored background should be blue');
    assert.equal(inspected.corner[3], 255);
  }
  backgroundResults.push(inspected);
  await evaluate(`document.querySelector('button[aria-label="Remove ${definition.name}"]').click()`);
  await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, `${definition.name} cleanup`);
  backgroundCleanupStats.push(await evaluate(`window.__objectUrlStats()`));
}
const backgroundStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(new Set(backgroundCleanupStats.map((stats) => stats.active)).size, 1, 'Background URL baseline must not grow between runs');
assert.equal(backgroundStats.active <= 2, true, 'Only model runtime session URLs may remain active');

assert.deepEqual(browserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'SECONDARY_TOOLS_BROWSER_OK',
    pdf: { variants: pdfVariants.length, bytes: pdfBuffer.length, pages: 2, fitMediaBox: mediaBox.slice(1) },
    favicon: { icons: faviconResults.length, zipNames, paddingPixels },
    qr: { pngBytes: pngBytes.length, svgBytes: Buffer.byteLength(svgText), contrastBlocked: true },
    background: backgroundResults.map(({ name, type, width, height, stages }) => ({
      name,
      type,
      width,
      height,
      stages,
    })),
    pdfStats,
    backgroundStats,
    backgroundCleanupStats,
    browserErrors: browserErrors.length,
  })
);
