import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import JSZip from 'jszip';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const root = process.cwd();
const tempDir = process.env.BROWSER_TEMP_DIR || path.join(root, '.tmp-splitter-browser');
const downloadDir = process.env.BROWSER_DOWNLOAD_DIR || path.join(tempDir, 'downloads');
const downloadPath = path.join(downloadDir, 'toolkitfree-split-images.zip');
const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const pageUrl = `${process.env.BASE_URL || 'http://127.0.0.1:4321'}/tools/image-splitter/`;

const SOURCE_WIDTH = 400;
const SOURCE_HEIGHT = 300;
// Each quadrant gets its own colour so every produced piece can be identified.
const QUADRANTS = [
  { hex: '#ff0000', rgb: [255, 0, 0] },
  { hex: '#00ff00', rgb: [0, 255, 0] },
  { hex: '#0000ff', rgb: [0, 0, 255] },
  { hex: '#ffff00', rgb: [255, 255, 0] },
];

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** Minimal truecolour PNG encoder so the fixture is generated rather than committed. */
function encodePng(width, height, pixelAt) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(tempDir, { recursive: true });
fs.mkdirSync(downloadDir, { recursive: true });
if (fs.existsSync(downloadPath)) fs.rmSync(downloadPath);

const fixture = path.join(tempDir, 'quadrants.png');
fs.writeFileSync(
  fixture,
  encodePng(SOURCE_WIDTH, SOURCE_HEIGHT, (x, y) => {
    const index = (y < SOURCE_HEIGHT / 2 ? 0 : 2) + (x < SOURCE_WIDTH / 2 ? 0 : 1);
    return QUADRANTS[index].rgb;
  })
);

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

async function waitFor(expression, label, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function setFile(filePath) {
  const documentNode = await send('DOM.getDocument');
  const inputNode = await send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type="file"]',
  });
  assert.notEqual(inputNode.nodeId, 0, 'File input should exist');
  await send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files: [filePath] });
}

function clickButton(label) {
  return evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === ${JSON.stringify(label)})
      .click()
  `);
}

function clickButtonStartingWith(prefix) {
  return evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim().startsWith(${JSON.stringify(prefix)}))
      .click()
  `);
}

/** Set a React-controlled number input the way a keyboard user would. */
function setNumberInput(id, value) {
  return evaluate(`
    (() => {
      const input = document.getElementById(${JSON.stringify(id)});
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(String(value))});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return input.value;
    })()
  `);
}

/** Decode every produced piece and report its size plus its centre pixel. */
const readPieces = `
  (async () => {
    const links = [...document.querySelectorAll('[data-split-results] a[download]')];
    const pieces = [];
    for (const link of links) {
      const blob = await fetch(link.href).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const pixel = context.getImageData(
        Math.floor(bitmap.width / 2),
        Math.floor(bitmap.height / 2),
        1,
        1
      ).data;
      pieces.push({
        name: link.getAttribute('download'),
        width: bitmap.width,
        height: bitmap.height,
        centre:
          '#' + [pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, '0')).join(''),
      });
    }
    return pieces;
  })()
`;

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
      const originalCreate = URL.createObjectURL.bind(URL);
      const originalRevoke = URL.revokeObjectURL.bind(URL);
      const active = new Set();
      const stats = { created: 0, revoked: 0 };
      URL.createObjectURL = (value) => {
        const url = originalCreate(value);
        stats.created += 1;
        active.add(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        stats.revoked += 1;
        active.delete(url);
        return originalRevoke(url);
      };
      window.__objectUrlStats = () => ({ ...stats, active: active.size });
    })();
  `,
});

await send('Page.navigate', { url: pageUrl });
await waitFor(
  `document.readyState === 'complete' && Boolean(document.querySelector('input[type="file"]'))`,
  'hydrated splitter uploader'
);

await setFile(fixture);
await waitFor(`document.getElementById('splitter-x-cut-0')`, 'split lines ready');

// --- Default even grid -------------------------------------------------------

assert.deepEqual(
  await evaluate(`(() => {
    const root = document.querySelector('[data-image-splitter]');
    return {
      rows: root.dataset.splitRows,
      cols: root.dataset.splitCols,
      tiles: root.dataset.splitTileCount,
      handles: String(document.querySelectorAll('.splitter-handle').length),
      xCut: document.getElementById('splitter-x-cut-0').value,
      yCut: document.getElementById('splitter-y-cut-0').value,
    };
  })()`),
  { rows: '2', cols: '2', tiles: '4', handles: '2', xCut: '200', yCut: '150' },
  'A 400x300 source opens as an even 2x2 grid'
);

await clickButtonStartingWith('Split into');
await waitFor(`document.querySelector('[data-split-results]')`, 'even split results');

// Pixel-level round trip: each quadrant must land in the matching piece.
const evenPieces = await evaluate(readPieces);
assert.deepEqual(
  evenPieces,
  [
    { name: 'quadrants-r1-c1.png', width: 200, height: 150, centre: QUADRANTS[0].hex },
    { name: 'quadrants-r1-c2.png', width: 200, height: 150, centre: QUADRANTS[1].hex },
    { name: 'quadrants-r2-c1.png', width: 200, height: 150, centre: QUADRANTS[2].hex },
    { name: 'quadrants-r2-c2.png', width: 200, height: 150, centre: QUADRANTS[3].hex },
  ],
  'Even split reproduces the four source quadrants in row-major order'
);

// --- ZIP download ------------------------------------------------------------

await clickButton('Download all as ZIP');
const downloadStarted = Date.now();
while (!fs.existsSync(downloadPath) && Date.now() - downloadStarted < 15_000) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.equal(fs.existsSync(downloadPath), true, 'toolkitfree-split-images.zip should download');
const archive = await JSZip.loadAsync(fs.readFileSync(downloadPath));
assert.deepEqual(
  Object.keys(archive.files).sort(),
  ['quadrants-r1-c1.png', 'quadrants-r1-c2.png', 'quadrants-r2-c1.png', 'quadrants-r2-c2.png'],
  'The archive keeps the row and column naming'
);

// --- Precise positioning -----------------------------------------------------

assert.equal(await setNumberInput('splitter-x-cut-0', 120), '120');
await waitFor(`!document.querySelector('[data-split-results]')`, 'results cleared after a change');

await clickButtonStartingWith('Split into');
await waitFor(`document.querySelector('[data-split-results]')`, 'uneven split results');
assert.deepEqual(
  (await evaluate(readPieces)).map((piece) => `${piece.width}x${piece.height} ${piece.centre}`),
  [
    `120x150 ${QUADRANTS[0].hex}`,
    `280x150 ${QUADRANTS[1].hex}`,
    `120x150 ${QUADRANTS[2].hex}`,
    `280x150 ${QUADRANTS[3].hex}`,
  ],
  'A typed cut position produces uneven pieces cut at exactly that pixel'
);

// --- Keyboard nudge ----------------------------------------------------------

await evaluate(`
  (() => {
    const handle = document.querySelector('.splitter-handle-x');
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  })()
`);
await waitFor(`document.getElementById('splitter-x-cut-0').value === '121'`, 'arrow key nudge');

await evaluate(`
  (() => {
    const handle = document.querySelector('.splitter-handle-x');
    handle.focus();
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true })
    );
  })()
`);
await waitFor(`document.getElementById('splitter-x-cut-0').value === '111'`, 'shifted nudge');

// --- Adding and removing split lines -----------------------------------------

await evaluate(
  `[...document.querySelectorAll('.splitter-cut-group')][0].querySelector('button').click()`
);
await waitFor(
  `document.querySelector('[data-image-splitter]').dataset.splitTileCount === '6'`,
  'added vertical line'
);

await evaluate(`document.querySelector('[aria-label="Remove vertical line 1"]').click()`);
await waitFor(
  `document.querySelector('[data-image-splitter]').dataset.splitTileCount === '4'`,
  'removed vertical line'
);

// --- Rejected configuration --------------------------------------------------

await setNumberInput('splitter-margin', 200);
await waitFor(
  `document.body.innerText.includes('would be empty')`,
  'impossible margin is explained rather than silently accepted'
);
assert.equal(
  await evaluate(
    `document.querySelector('[data-image-splitter]').querySelector('.btn-primary[disabled]') !== null ||
     [...document.querySelectorAll('button')].some((b) => b.disabled && b.textContent.includes('Split into'))`
  ),
  true,
  'Splitting stays disabled while the layout is impossible'
);
await setNumberInput('splitter-margin', 0);

// --- Number fields can be cleared while typing -------------------------------
// Mobile browsers render no spinner, so the field has to be typeable: clearing it
// must not snap straight back to the minimum, which would force people to type the
// new digits in front of the old ones.

assert.equal(await setNumberInput('splitter-rows', ''), '');
assert.deepEqual(
  await evaluate(`(() => {
    const root = document.querySelector('[data-image-splitter]');
    return { shown: document.getElementById('splitter-rows').value, rows: root.dataset.splitRows };
  })()`),
  { shown: '', rows: '2' },
  'An emptied row count stays empty and leaves the committed value alone'
);

await setNumberInput('splitter-rows', '3');
await waitFor(
  `document.querySelector('[data-image-splitter]').dataset.splitTileCount === '6'`,
  'typed row count applies'
);

// Leaving the field empty restores the committed value. A programmatic blur() does
// not dispatch focus events while the headless window lacks system focus, so move
// focus with a real Tab keypress.
await setNumberInput('splitter-rows', '');
await evaluate(`document.getElementById('splitter-rows').focus()`);
for (const type of ['rawKeyDown', 'keyUp']) {
  await send('Input.dispatchKeyEvent', {
    type,
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
    key: 'Tab',
    code: 'Tab',
  });
}
await waitFor(
  `document.getElementById('splitter-rows').value === '3'`,
  'leaving the field empty restores the committed row count'
);

// --- Steppers are for touch devices only -------------------------------------

const stepperDisplay = `getComputedStyle(document.querySelector('[aria-label="Increase rows"]')).display`;
assert.equal(
  await evaluate(stepperDisplay),
  'none',
  'Desktop draws a native spinner, so the extra buttons stay hidden'
);

// Device metrics plus touch emulation is what actually flips the hover and pointer
// media features; Emulation.setEmulatedMedia does not support them.
await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
assert.equal(
  await evaluate(`matchMedia('(hover: none) and (pointer: coarse)').matches`),
  true,
  'Touch emulation is active'
);
// The declared inline-flex is blockified to flex because the button is a flex item,
// so assert only that the buttons are rendered.
assert.notEqual(
  await evaluate(stepperDisplay),
  'none',
  'Touch devices draw no spinner, so the buttons appear'
);

await evaluate(`document.querySelector('[aria-label="Increase rows"]').click()`);
await waitFor(`document.getElementById('splitter-rows').value === '4'`, 'increase stepper');
for (let index = 0; index < 3; index += 1) {
  await evaluate(`document.querySelector('[aria-label="Decrease rows"]').click()`);
}
await waitFor(`document.getElementById('splitter-rows').value === '1'`, 'decrease stepper');
assert.equal(
  await evaluate(`document.querySelector('[aria-label="Decrease rows"]').disabled`),
  true,
  'The decrease stepper stops at the minimum'
);

await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Emulation.clearDeviceMetricsOverride');

// --- Object URL hygiene ------------------------------------------------------

await clickButton('Choose a different image');
await waitFor(`Boolean(document.querySelector('input[type="file"]'))`, 'uploader restored');
const finalStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(finalStats.active, 0, 'Every object URL is revoked when the image is removed');
assert.equal(finalStats.created > 0, true);

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);

await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'IMAGE_SPLITTER_BROWSER_VALIDATION_OK',
    fixture: `${SOURCE_WIDTH}x${SOURCE_HEIGHT} generated`,
    evenPieces: evenPieces.length,
    zipEntries: Object.keys(archive.files).length,
    zipBytes: fs.statSync(downloadPath).size,
    objectUrls: finalStats,
    browserErrors: actionableBrowserErrors.length,
  })
);
