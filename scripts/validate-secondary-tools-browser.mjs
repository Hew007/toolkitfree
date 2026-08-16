import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9227';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
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
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

/**
 * `waitFor` wraps its expression in `Boolean(...)`, which is always true for a
 * promise. Async conditions have to poll the resolved value instead.
 */
async function waitForValue(expression, predicate, label, timeoutMs = 90_000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await evaluate(expression);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last)}`);
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
  await navigate(`/tools/image-to-pdf/${slug}/`);
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

await navigate('/tools/image-to-pdf/multiple-images-to-pdf/');
await upload([
  { name: 'first.png', type: 'image/png', width: 400, height: 200, color: '#ef4444' },
  {
    name: 'second.png',
    type: 'image/png',
    width: 200,
    height: 400,
    color: '#22c55e',
    transparent: true,
  },
  { name: 'broken.png', type: 'image/png', corrupt: true },
]);
// Two decodable images become two pages; the corrupt one is reported immediately
// rather than being held back until the convert click.
await waitFor(`document.querySelectorAll('[data-pdf-page]').length === 2`, 'two PDF pages');
assert.equal(
  await evaluate(`Boolean(document.querySelector('[data-pdf-error="broken.png"]'))`),
  true,
  'a corrupt file is flagged as soon as it is added'
);
assert.equal(await evaluate(`document.querySelectorAll('[data-pdf-file]').length`), 2);

// The editor is driven from the keyboard: it is the accessible path and, unlike
// synthetic pointer drags, it is reliable over CDP.
const pressOnImage = (name, key, modifiers = {}) => `
  (async () => {
    const box = document.querySelector('[data-pdf-file="${name}"]');
    box.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)}, bubbles: true, cancelable: true, ...${JSON.stringify(modifiers)}
    }));
    // React commits the state update asynchronously; wait for it to paint.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return document.querySelector('[data-pdf-file="${name}"]')?.dataset.pdfPlacement;
  })()
`;

const placementBefore = await evaluate(
  `document.querySelector('[data-pdf-file="first.png"]').dataset.pdfPlacement`
);
const placementAfterMove = await evaluate(pressOnImage('first.png', 'ArrowRight'));
assert.notEqual(placementAfterMove, placementBefore, 'arrow keys must move the image');
assert.equal(
  Number(placementAfterMove.split(',')[0]) - Number(placementBefore.split(',')[0]),
  1,
  'one arrow press moves exactly 1mm'
);

const placementAfterRotate = await evaluate(pressOnImage('first.png', ']'));
assert.equal(placementAfterRotate.split(',')[4], '90', 'the bracket key rotates a quarter turn');
// A quarter turn swaps the footprint.
assert.equal(placementAfterRotate.split(',')[2], placementAfterMove.split(',')[3]);
assert.equal(placementAfterRotate.split(',')[3], placementAfterMove.split(',')[2]);

// Alt+PageUp merges the second image onto the first page — the keyboard equivalent
// of dragging it there, and the way a user puts several images on one page.
await evaluate(pressOnImage('second.png', 'PageUp', { altKey: true }));
await waitFor(
  `document.querySelectorAll('[data-pdf-page]').length === 1`,
  'images merged onto one page'
);
assert.equal(
  await evaluate(`document.querySelector('[data-pdf-page-count]').dataset.pdfPageCount`),
  '1'
);

const pageLayout = `
  [...document.querySelectorAll('[data-pdf-page]')].map((page) =>
    [...page.querySelectorAll('[data-pdf-file]')].map((item) => item.dataset.pdfFile)
  )
`;

// Alt+Enter splits an image back onto a page of its own. Combining used to be a
// one-way trip: nothing could undo it, so a mis-drop meant starting over.
await evaluate(pressOnImage('second.png', 'Enter', { altKey: true }));
await waitFor(`document.querySelectorAll('[data-pdf-page]').length === 2`, 'image split back out');
assert.deepEqual(
  await evaluate(pageLayout),
  [['first.png'], ['second.png']],
  'splitting restores one image per page'
);

// Page order is its own control, so changing it never combines images.
await evaluate(`document.querySelector('[data-pdf-page-up="2"]').click()`);
await waitFor(`${pageLayout}[0][0] === 'second.png'`, 'pages reordered');
assert.deepEqual(
  await evaluate(pageLayout),
  [['second.png'], ['first.png']],
  'moving a page up swaps whole pages instead of merging them'
);
assert.equal(
  await evaluate(`document.querySelector('[data-pdf-page-up="1"]').disabled`),
  true,
  'the first page cannot move any earlier'
);

// Put the order back and combine again so the conversion below still covers a
// single page holding two images.
await evaluate(`document.querySelector('[data-pdf-page-up="2"]').click()`);
await waitFor(`${pageLayout}[0][0] === 'first.png'`, 'pages reordered back');
await evaluate(pressOnImage('second.png', 'PageUp', { altKey: true }));
await waitFor(
  `document.querySelectorAll('[data-pdf-page]').length === 1`,
  'images merged onto one page again'
);

await evaluate(`document.querySelector('[data-testid="pdf-convert"]').click()`);
await waitFor(`Boolean(document.querySelector('[data-pdf-result]'))`, 'partial PDF result');
assert.equal(
  await evaluate(`Number(document.querySelector('[data-pdf-result]').dataset.pages)`),
  1
);
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
// Both images were merged onto a single page, so the PDF holds exactly one.
assert.equal((pdfText.match(/\/Type \/Page\b/g) || []).length, 1);
assert.equal((pdfText.match(/\/MediaBox/g) || []).length >= 1, true);
const pdfStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(pdfStats.active, 4, 'Three previews plus one PDF result should remain active');

// Starting the next PDF must not mean removing images one at a time or
// reloading the page — the result panel offers it directly.
await evaluate(`document.querySelector('[data-testid="pdf-start-over"]').click()`);
await waitFor(
  `document.querySelectorAll('[data-pdf-file]').length === 0`,
  'editor cleared for the next PDF'
);
assert.equal(await evaluate(`Boolean(document.querySelector('[data-pdf-result]'))`), false);
assert.equal(await evaluate(`Boolean(document.querySelector('[data-pdf-page-count]'))`), false);
assert.equal(
  await evaluate(`Boolean(document.querySelector('[data-pdf-error="broken.png"]'))`),
  false,
  'the earlier decode failure is cleared along with its file'
);
assert.equal(
  (await evaluate(`window.__objectUrlStats()`)).active,
  0,
  'starting over releases every preview and the finished PDF'
);

// ...and the tool is usable again straight away.
await upload([{ name: 'third.png', type: 'image/png', width: 300, height: 300 }]);
await waitFor(
  `document.querySelectorAll('[data-pdf-file]').length === 1`,
  'a fresh image after starting over'
);

await navigate('/tools/image-to-pdf/image-to-pdf-no-margin/');
await upload([{ name: 'wide.png', type: 'image/png', width: 400, height: 200 }]);
await waitFor(`Boolean(document.querySelector('[data-pdf-file]'))`, 'fit PDF input');
await evaluate(`document.querySelector('[data-testid="pdf-convert"]').click()`);
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

// The "what you see is what you export" guarantee: jsPDF records each image as a
// `width 0 0 height x y cm` matrix. In fit mode the preview shows the image
// covering the whole page, so the drawn box must equal the MediaBox.
const drawMatrix = /([\d.]+) 0 0 ([\d.]+) [\d.-]+ [\d.-]+ cm/.exec(fitPdfText);
assert.ok(drawMatrix, 'Fit PDF must place the image with a transform matrix');
assert.ok(
  Math.abs(Number(drawMatrix[1]) - Number(mediaBox[1])) < 0.5,
  `Drawn width ${drawMatrix[1]} should fill the page width ${mediaBox[1]}`
);
assert.ok(
  Math.abs(Number(drawMatrix[2]) - Number(mediaBox[2])) < 0.5,
  `Drawn height ${drawMatrix[2]} should fill the page height ${mediaBox[2]}`
);

await navigate('/tools/favicon-generator/');
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
await waitFor(
  `document.querySelectorAll('[data-favicon-icon]').length === 5`,
  'five favicon outputs'
);
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
assert.deepEqual(
  manifest.icons.map((icon) => icon.sizes),
  ['192x192', '512x512']
);
assert.equal(await evaluate(`document.querySelector('pre').innerText.includes('.ico')`), false);

await navigate('/tools/qr-generator/');
assert.equal(await evaluate(`Boolean(document.querySelector('[data-qr-ready="true"]'))`), false);
assert.equal(
  await evaluate(
    `document.querySelectorAll('button').length > 0 && !document.body.innerText.includes('Download PNG')`
  ),
  true
);
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
await waitFor(
  `document.querySelector('[data-qr-input-type]').dataset.qrInputType === 'wifi'`,
  'WiFi tab'
);
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
await waitFor(
  `document.querySelector('[data-qr-input-type]').dataset.qrInputType === 'vcard'`,
  'vCard tab'
);
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
await waitFor(
  `document.querySelector('[data-qr-input-type]').dataset.qrInputType === 'text'`,
  'Text tab'
);
await evaluate(`
  (() => {
    const input = document.querySelector('textarea[placeholder="Enter text or URL..."]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(input, 'download-check');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()
`);
await waitFor(
  `document.querySelector('[data-qr-data]')?.dataset.qrData === 'download-check'`,
  'download QR'
);
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Download PNG').click()`
);
await waitForFile('qrcode.png');
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Download SVG').click()`
);
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
await waitFor(
  `Boolean(document.querySelector('[data-qr-contrast-warning]'))`,
  'QR contrast warning'
);
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Download PNG').disabled`
  ),
  true
);

await navigate('/tools/image-enhancer/');
await upload([
  {
    name: 'enhance-source.png',
    type: 'image/png',
    width: 120,
    height: 60,
    color: '#16a34a',
  },
]);
await waitFor(
  `(() => {
    const canvas = document.querySelector('[data-enhancer-preview]');
    return canvas?.width === 120 && canvas?.height === 60;
  })()`,
  'enhancer preview'
);
const enhancerInitial = await evaluate(`(() => {
  const canvas = document.querySelector('[data-enhancer-preview]');
  const pixel = [...canvas.getContext('2d').getImageData(60, 30, 1, 1).data];
  return { width: canvas.width, height: canvas.height, pixel };
})()`);
assert.equal(enhancerInitial.width, 120);
assert.equal(enhancerInitial.height, 60);
assert.equal(enhancerInitial.pixel[3], 255);
await evaluate(`(() => {
  const brightness = document.querySelector('#enhancer-brightness');
  const sharpness = document.querySelector('#enhancer-sharpness');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(brightness, '20');
  brightness.dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(sharpness, '50');
  sharpness.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await waitFor(
  `document.querySelector('output[for="enhancer-brightness"]')?.textContent.trim() === '+20'`,
  'enhancer controls'
);
await evaluate(`document.querySelector('button[aria-label="Reset brightness"]').click()`);
await waitFor(`document.querySelector('#enhancer-brightness').value === '0'`, 'brightness reset');
await evaluate(`document.querySelector('[data-enhancer-download]').click()`);
const enhancerDownload = await waitForFile('enhance-source-enhanced.png');
const enhancerBytes = fs.readFileSync(enhancerDownload);
assert.equal(
  enhancerBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  true
);
const enhancerStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(enhancerStats.active, 0, 'Enhancer download URLs should be revoked');
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove image').click()`
);
await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, 'enhancer cleanup');

await navigate('/tools/background-remover/');
await upload([{ name: 'corrupt.png', type: 'image/png', corrupt: true }]);
await waitFor(`document.body.innerText.includes('corrupt.png')`, 'corrupt background input');
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').click()`
);
await waitFor(
  `Boolean(document.querySelector('.status-error'))`,
  'background error recovery',
  180_000
);
assert.equal(
  await evaluate(`Boolean(document.querySelector('button[aria-label="Remove corrupt.png"]'))`),
  true
);
await evaluate(`document.querySelector('button[aria-label="Remove corrupt.png"]').click()`);
await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, 'background input reset');

await upload([
  {
    name: 'cancel-background.png',
    type: 'image/png',
    width: 96,
    height: 96,
    kind: 'portrait',
    background: '#f3f4f6',
  },
]);
await waitFor(
  `document.body.innerText.includes('cancel-background.png')`,
  'cancel background input'
);
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').click()`
);
await waitFor(
  `[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Cancel')`,
  'background cancel control'
);
assert.equal(
  await evaluate(`document.querySelector('[data-background-stage]').getAttribute('aria-busy')`),
  'true'
);
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Cancel').click()`
);
await waitFor(
  `document.querySelector('.status-error')?.textContent.includes('canceled')`,
  'background cancellation recovery'
);
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').disabled`
  ),
  false
);
await evaluate(
  `document.querySelector('button[aria-label="Remove cancel-background.png"]').click()`
);
await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, 'canceled input reset');

const backgroundCases = [
  { name: 'portrait.png', kind: 'portrait', background: '#f3f4f6', color: 'transparent' },
  { name: 'product.png', kind: 'product', background: '#ffffff', color: '#0000ff' },
  { name: 'transparent.png', kind: 'product', transparent: true, color: 'transparent' },
  // A colour reachable only through the hex field, not through any preset swatch.
  { name: 'custom.png', kind: 'product', background: '#ffffff', color: '#7a45ff', viaHex: true },
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
  await waitFor(
    `document.body.innerText.includes('${definition.name}')`,
    `${definition.name} input`
  );
  if (definition.viaHex) {
    // React controlled inputs only see a change when the native setter is used.
    const typeHex = (value) => `
      (async () => {
        const input = document.querySelector('[data-testid="bg-color-hex"]');
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ).set;
        setter.call(input, ${JSON.stringify(value)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true
        }));
        // React commits the state update asynchronously; wait for it to paint.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return document.querySelector('[data-active-background]').dataset.activeBackground;
      })()
    `;
    // An invalid hex must be rejected in place rather than reaching fillStyle,
    // where it would silently paint the previous colour instead. The colour
    // carries over between files, so compare against whatever is active now.
    const colorBeforeInvalid = await evaluate(
      `document.querySelector('[data-active-background]').dataset.activeBackground`
    );
    assert.equal(
      await evaluate(typeHex('#12')),
      colorBeforeInvalid,
      'invalid hex must not change the active colour'
    );
    assert.equal(
      await evaluate(
        `Boolean(document.querySelector('[data-testid="bg-color-hex"][aria-invalid="true"]'))`
      ),
      true,
      'invalid hex must be flagged'
    );
    assert.equal(await evaluate(typeHex(definition.color)), definition.color);
  } else if (definition.color !== 'transparent') {
    await evaluate(
      `document.querySelector('[data-background-color="${definition.color}"]').click()`
    );
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
  await evaluate(
    `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').click()`
  );
  await waitFor(
    `Boolean(document.querySelector('[data-background-result], .status-error'))`,
    `${definition.name} background completion`,
    240_000
  );
  const backgroundError = await evaluate(`document.querySelector('.status-error')?.textContent`);
  assert.equal(backgroundError, undefined, `${definition.name}: ${backgroundError}`);
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
  assert.equal(
    inspected.stages.includes('model-initialization') ||
      inspected.stages.includes('model-download'),
    true
  );
  if (definition.color === '#0000ff') {
    assert.equal(
      inspected.corner[2] > inspected.corner[0],
      true,
      'Colored background should be blue'
    );
    assert.equal(inspected.corner[3], 255);
  }
  if (definition.viaHex) {
    // #7a45ff -> blue channel highest, then red, then green.
    const [red, green, blue, alpha] = inspected.corner;
    assert.equal(blue > red && red > green, true, `Custom hex background, got ${inspected.corner}`);
    assert.equal(alpha, 255);
  }
  backgroundResults.push(inspected);
  await evaluate(
    `document.querySelector('button[aria-label="Remove ${definition.name}"]').click()`
  );
  await waitFor(
    `Boolean(document.querySelector('input[type="file"]'))`,
    `${definition.name} cleanup`
  );
  backgroundCleanupStats.push(await evaluate(`window.__objectUrlStats()`));
}
const backgroundStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(
  new Set(backgroundCleanupStats.map((stats) => stats.active)).size,
  1,
  'Background URL baseline must not grow between runs'
);
assert.equal(
  backgroundStats.active <= 2,
  true,
  'Only model runtime session URLs may remain active'
);

// Once a cutout exists, changing the background must recompose locally: the
// result and its "Process Again" state survive, and the model does not re-run.
const readBackgroundResult = `
  (async () => {
    const container = document.querySelector('[data-background-result]');
    const image = container?.previousElementSibling?.querySelector('img[alt="Result"]');
    if (!container || !image) return null;
    // The URL can be replaced between reading it and reading its bytes; that
    // simply means another poll is needed.
    const decoded = await (async () => {
      const blob = await fetch(image.src).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const corner = [...context.getImageData(0, 0, 1, 1).data];
      bitmap.close();
      return { corner, bytes: blob.size };
    })().catch(() => null);
    if (!decoded) return null;
    return {
      corner: decoded.corner,
      src: image.src,
      bytes: decoded.bytes,
      name: container.dataset.backgroundResult,
      composing: document.querySelector('[data-background-composing]').dataset.backgroundComposing,
      downloadDisabled: container.querySelector('button').disabled,
      modelRuns: Number(document.querySelector('[data-background-model-runs]').dataset.backgroundModelRuns),
    };
  })()
`;
const watchRecomposition = `
  (() => {
    window.__recomposeObserver?.disconnect();
    window.__recompose = {
      stages: [],
      buttons: [],
      downloadDisabled: [],
      colorsLocked: [],
      resultRemovals: 0,
      resultMissing: false,
    };
    const sample = () => {
      const root = document.querySelector('[data-background-stage]');
      const stage = root?.dataset.backgroundStage;
      if (stage && !window.__recompose.stages.includes(stage)) window.__recompose.stages.push(stage);
      const label = [...document.querySelectorAll('button')]
        .map((button) => button.textContent.trim())
        .find((text) => ['Remove Background', 'Process Again', 'Processing...'].includes(text));
      if (label && !window.__recompose.buttons.includes(label)) window.__recompose.buttons.push(label);
      const result = document.querySelector('[data-background-result]');
      if (!result) window.__recompose.resultMissing = true;
      const download = result?.querySelector('button')?.disabled;
      const last = window.__recompose.downloadDisabled;
      if (download !== undefined && last[last.length - 1] !== download) last.push(download);
      const locked = document.querySelector('[data-background-color="#ff0000"]')?.disabled;
      const lockedLog = window.__recompose.colorsLocked;
      if (locked !== undefined && lockedLog[lockedLog.length - 1] !== locked) lockedLog.push(locked);
    };
    sample();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches('[data-background-result]') || node.querySelector('[data-background-result]')) {
            window.__recompose.resultRemovals += 1;
          }
        }
      }
      sample();
    });
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
    window.__recomposeObserver = observer;
  })()
`;

await upload([
  {
    name: 'recompose.png',
    type: 'image/png',
    width: 96,
    height: 96,
    kind: 'portrait',
    background: '#f3f4f6',
  },
]);
await waitFor(`document.body.innerText.includes('recompose.png')`, 'recompose input');
// The colour survives file changes, so the previous case's custom hex would still
// be selected. Start from Transparent explicitly.
await evaluate(`document.querySelector('[data-background-color="transparent"]').click()`);
await waitFor(
  `document.querySelector('[data-active-background]').dataset.activeBackground === 'transparent'`,
  'transparent baseline selection'
);
// The counter is cumulative for the mounted island, so compare against a baseline.
const runsBaseline = await evaluate(
  `Number(document.querySelector('[data-background-model-runs]').dataset.backgroundModelRuns)`
);
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Remove Background').click()`
);
await waitFor(
  `Boolean(document.querySelector('[data-background-result], .status-error'))`,
  'recompose first result',
  240_000
);
assert.equal(await evaluate(`document.querySelector('.status-error')?.textContent`), undefined);
const transparentResult = await waitForValue(
  readBackgroundResult,
  (state) => state !== null && state.composing === 'false',
  'transparent recompose baseline'
);
assert.equal(
  transparentResult.corner[3] < 32,
  true,
  `Transparent result should have a clear corner, got ${transparentResult.corner}`
);
assert.equal(transparentResult.modelRuns, runsBaseline + 1);
assert.equal(transparentResult.downloadDisabled, false, 'A settled result must be downloadable');
const urlsBeforeRecompose = await evaluate(`window.__objectUrlStats()`);

await evaluate(watchRecomposition);
await evaluate(`document.querySelector('[data-background-color="#ff0000"]').click()`);
const redResult = await waitForValue(
  readBackgroundResult,
  (state) => state !== null && state.composing === 'false' && state.corner[3] === 255,
  'red recomposition'
);
const redWatch = await evaluate(`window.__recompose`);
assert.equal(
  redResult.corner[0] > 200 && redResult.corner[1] < 80,
  true,
  `Red corner ${redResult.corner}`
);
assert.equal(
  redResult.modelRuns,
  runsBaseline + 1,
  'Changing the background must not re-run the model'
);
assert.deepEqual(redWatch.stages, ['idle'], 'No model stage may appear while recomposing');
assert.deepEqual(
  redWatch.buttons,
  ['Process Again'],
  'The action button must stay in its processed state'
);
assert.equal(redWatch.resultMissing, false, 'The result must stay on screen while recomposing');
assert.equal(redWatch.resultRemovals, 0, 'The result must not be unmounted while recomposing');
assert.deepEqual(
  redWatch.downloadDisabled,
  [false, true, false],
  'Download must be blocked while the shown result does not match the chosen colour'
);
assert.deepEqual(
  redWatch.colorsLocked,
  [false, true, false],
  'Colour controls must be locked for the duration of a recomposition'
);
assert.equal(redResult.downloadDisabled, false, 'Download must return once the colour is applied');
assert.equal(redResult.name, transparentResult.name);
assert.notEqual(
  redResult.src,
  transparentResult.src,
  'Recomposition must publish a new object URL'
);

// Back to Transparent: the cached cutout is reused, still without the model.
await evaluate(watchRecomposition);
await evaluate(`document.querySelector('[data-background-color="transparent"]').click()`);
const backToTransparent = await waitForValue(
  readBackgroundResult,
  (state) => state !== null && state.composing === 'false' && state.corner[3] < 32,
  'transparent recomposition'
);
const transparentWatch = await evaluate(`window.__recompose`);
assert.equal(
  backToTransparent.modelRuns,
  runsBaseline + 1,
  'Returning to transparent must not re-run the model'
);
assert.equal(
  backToTransparent.bytes,
  transparentResult.bytes,
  'The cached cutout should be reused'
);
assert.deepEqual(transparentWatch.stages, ['idle']);
assert.deepEqual(transparentWatch.buttons, ['Process Again']);
assert.equal(transparentWatch.resultRemovals, 0);
assert.equal(transparentWatch.resultMissing, false);
// Reusing the cached cutout needs no canvas, so it must end unlocked either way.
assert.equal(transparentWatch.downloadDisabled.at(-1), false);
assert.equal(transparentWatch.colorsLocked.at(-1), false);
assert.equal(backToTransparent.downloadDisabled, false);
assert.equal(
  await evaluate(
    `document.querySelector('[data-active-background]').dataset.activeBackground === 'transparent'`
  ),
  true
);
const urlsAfterRecompose = await evaluate(`window.__objectUrlStats()`);
assert.equal(
  urlsAfterRecompose.active,
  urlsBeforeRecompose.active,
  'Each recomposition must revoke the previous result URL'
);
assert.equal(
  urlsAfterRecompose.created > urlsBeforeRecompose.created,
  true,
  'Recomposition should publish fresh result URLs'
);

// Only the explicit action re-runs the model.
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Process Again').click()`
);
const reprocessed = await waitForValue(
  readBackgroundResult,
  (state) => state !== null && state.composing === 'false' && state.modelRuns === runsBaseline + 2,
  'process again re-runs the model',
  240_000
);
assert.equal(await evaluate(`document.querySelector('.status-error')?.textContent`), undefined);
assert.equal(reprocessed.corner[3] < 32, true, `Reprocessed corner ${reprocessed.corner}`);
await evaluate(`window.__recomposeObserver?.disconnect()`);
await evaluate(`document.querySelector('button[aria-label="Remove recompose.png"]').click()`);
await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, 'recompose cleanup');
const recomposeStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(
  recomposeStats.active <= backgroundStats.active,
  true,
  'Recomposition must not leak object URLs'
);

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'SECONDARY_TOOLS_BROWSER_OK',
    pdf: {
      variants: pdfVariants.length,
      bytes: pdfBuffer.length,
      pages: (pdfText.match(/\/Type \/Page\b/g) || []).length,
      fitMediaBox: mediaBox.slice(1),
    },
    favicon: { icons: faviconResults.length, zipNames, paddingPixels },
    qr: { pngBytes: pngBytes.length, svgBytes: Buffer.byteLength(svgText), contrastBlocked: true },
    enhancer: {
      width: enhancerInitial.width,
      height: enhancerInitial.height,
      pngBytes: enhancerBytes.length,
      objectUrls: enhancerStats,
    },
    background: backgroundResults.map(({ name, type, width, height, stages }) => ({
      name,
      type,
      width,
      height,
      stages,
    })),
    backgroundRecompose: {
      modelRuns: { baseline: runsBaseline, afterColorChanges: backToTransparent.modelRuns },
      corners: {
        transparent: transparentResult.corner,
        red: redResult.corner,
        backToTransparent: backToTransparent.corner,
        reprocessed: reprocessed.corner,
      },
      objectUrls: { before: urlsBeforeRecompose, after: urlsAfterRecompose },
      downloadDisabled: {
        red: redWatch.downloadDisabled,
        backToTransparent: transparentWatch.downloadDisabled,
      },
    },
    pdfStats,
    backgroundStats,
    backgroundCleanupStats,
    browserErrors: actionableBrowserErrors.length,
  })
);
