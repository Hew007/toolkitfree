import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9227';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
const downloadPath = process.env.BROWSER_DOWNLOAD_DIR || 'C:\\tmp\\toolkitfree-collage-downloads';
const screenshotPath = process.env.COLLAGE_SCREENSHOT_PATH;
const mobileScreenshotPath = process.env.COLLAGE_MOBILE_SCREENSHOT_PATH;
const fineTuneScreenshotPath = process.env.COLLAGE_FINE_TUNE_SCREENSHOT_PATH;
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

async function waitFor(expression, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
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

async function upload(definitions) {
  return evaluate(`
    (async () => {
      const definitions = ${JSON.stringify(definitions)};
      const transfer = new DataTransfer();
      for (const definition of definitions) {
        const canvas = document.createElement('canvas');
        canvas.width = definition.width;
        canvas.height = definition.height;
        const context = canvas.getContext('2d');
        context.fillStyle = definition.color;
        context.fillRect(0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, definition.type));
        transfer.items.add(new File([blob], definition.name, { type: definition.type }));
      }
      const input = document.querySelector('input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return definitions.length;
    })()
  `);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath });

await navigate('/tools/image-collage/');
await evaluate(`
  (() => {
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    const active = new Set();
    const stats = { created: 0, revoked: 0 };
    URL.createObjectURL = (value) => {
      const url = originalCreate(value);
      active.add(url);
      stats.created += 1;
      return url;
    };
    URL.revokeObjectURL = (url) => {
      if (active.delete(url)) stats.revoked += 1;
      return originalRevoke(url);
    };
    window.__objectUrlStats = () => ({ ...stats, active: active.size });
  })()
`);

assert.equal(
  await upload([
    { name: 'wide.png', type: 'image/png', width: 120, height: 60, color: '#2563eb' },
    { name: 'tall.png', type: 'image/png', width: 60, height: 120, color: '#16a34a' },
  ]),
  2
);

await waitFor(
  `(() => {
    const canvas = document.querySelector('[data-collage-preview]');
    return canvas?.width === 768 && canvas?.height === 320;
  })()`,
  'default collage preview'
);
assert.equal(
  await evaluate(`document.querySelectorAll('[aria-label="Collage images"] li').length`),
  2
);
assert.equal(
  await evaluate(`document.querySelectorAll('.tool-chip input[name="collage-layout"]').length`),
  4,
  'The four arrangements should be chips'
);
assert.equal(
  await evaluate(`document.querySelector('.collage-controls .fine-tune').open`),
  false,
  'Fine-tune should stay collapsed in the fast path'
);
assert.equal(
  await evaluate(`Boolean(document.querySelector('.collage-controls .fine-tune-reset'))`),
  false,
  'No way back is offered before a value has been hand-edited'
);

// The collage file must exist before anything is clicked. This is the whole point
// of the conversion: the download button saves a file that is already built, it
// does not build one. If someone ever puts the work back behind the button, the
// button stays disabled here and this times out.
await waitFor(
  `document.querySelector('[data-collage-download]')?.disabled === false`,
  'collage file built without a submit step'
);
const builtWithoutClick = await evaluate(`window.__objectUrlStats()`);
assert.equal(
  builtWithoutClick.active,
  1,
  'Exactly one live object URL: the collage file the download button saves'
);

// No-regression guard: nothing on the page may ask to be pressed before results
// appear. `Download collage` saves the finished file and is not such a step.
assert.deepEqual(
  await evaluate(`
    [...document.querySelectorAll('[data-image-collage] button')]
      .map((button) => button.textContent.trim())
      .filter((text) => /^(make|create|build|generate|combine|merge|convert)\b/i.test(text))
  `),
  [],
  'The collage must not gain a submit button'
);

const uiLayouts = [];
for (const width of [1440, 900, 600, 390, 375]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width <= 600,
  });
  const layout = await evaluate(`(() => {
    const tool = document.querySelector('[data-image-collage]');
    const editor = document.querySelector('.collage-editor');
    const controls = document.querySelector('.collage-controls');
    const preview = document.querySelector('.collage-preview-panel');
    const controlRect = controls.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    return {
      width: ${width},
      fits: tool.scrollWidth <= tool.clientWidth + 1 && editor.scrollWidth <= editor.clientWidth + 1,
      stacked: controlRect.top >= previewRect.bottom - 1,
    };
  })()`);
  assert.equal(layout.fits, true, `Collage builder should not overflow at ${width}px`);
  assert.equal(layout.stacked, width <= 900, `Collage editor stack state at ${width}px`);
  if (width === 1440 && screenshotPath) {
    await evaluate(
      `document.querySelector('.collage-status-bar').scrollIntoView({ block: 'start' })`
    );
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  }
  if (width === 390 && mobileScreenshotPath) {
    // Framed on the controls rather than the status bar: the chips, the folded
    // summary row, the run note and the download button are what has to be read
    // on a phone, and they are below the fold from the top of the builder.
    await evaluate(
      `document.querySelector('.collage-controls').scrollIntoView({ block: 'start' })`
    );
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(mobileScreenshotPath), { recursive: true });
    fs.writeFileSync(mobileScreenshotPath, Buffer.from(screenshot.data, 'base64'));
  }
  uiLayouts.push(layout);
}

await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await evaluate(
  `document.querySelector('[data-collage-preview]').scrollIntoView({ block: 'center' })`
);
const dragPoints = await evaluate(`(() => {
  const canvas = document.querySelector('[data-collage-preview]');
  const bounds = canvas.getBoundingClientRect();
  return {
    first: { x: bounds.left + bounds.width * 0.25, y: bounds.top + bounds.height * 0.5 },
    middle: { x: bounds.left + bounds.width * 0.5, y: bounds.top + bounds.height * 0.5 },
    second: { x: bounds.left + bounds.width * 0.75, y: bounds.top + bounds.height * 0.5 },
  };
})()`);
await send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [dragPoints.first],
});
await send('Input.dispatchTouchEvent', {
  type: 'touchMove',
  touchPoints: [dragPoints.middle],
});
await send('Input.dispatchTouchEvent', {
  type: 'touchMove',
  touchPoints: [dragPoints.second],
});
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await waitFor(
  `document.querySelector('[aria-label="Collage images"] li .collage-image-info strong')?.textContent === 'tall.png'`,
  'mobile preview touch swap'
);
const previewTouchDragOrder = await evaluate(
  `[...document.querySelectorAll('[aria-label="Collage images"] li .collage-image-info strong')].map((item) => item.textContent)`
);
assert.deepEqual(previewTouchDragOrder, ['tall.png', 'wide.png']);
assert.equal(
  await evaluate(
    `document.querySelector('.collage-preview-help').textContent.includes('Drag a picture')`
  ),
  true
);
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Emulation.clearDeviceMetricsOverride');

const beforeVertical = await evaluate(`window.__objectUrlStats()`);
await evaluate(
  `document.querySelector('.tool-chip input[name="collage-layout"][value="vertical"]').click()`
);
await waitFor(
  `(() => {
    const canvas = document.querySelector('[data-collage-preview]');
    return canvas?.width === 392 && canvas?.height === 624;
  })()`,
  'vertical collage preview'
);
// The downloadable file follows the chip, not a button: it is revoked and rebuilt.
await waitFor(
  `document.querySelector('[data-collage-download]')?.disabled === false`,
  'collage file rebuilt for the vertical layout'
);
const afterVertical = await evaluate(`window.__objectUrlStats()`);
assert.equal(
  afterVertical.created > beforeVertical.created,
  true,
  'Changing the arrangement should rebuild the collage file'
);
assert.equal(afterVertical.active, 1, 'The superseded collage file should be revoked');

await evaluate(
  `document.querySelector('.tool-chip input[name="collage-layout"][value="columns"]').click()`
);
// The column count lives in the fine-tune panel and is mounted at all times, so
// what changes with the arrangement is whether its field is shown.
await waitFor(
  `document.querySelector('#collage-columns').closest('.fine-tune-field').hidden === false`,
  'columns control'
);
await evaluate(`
  (() => {
    const columns = document.querySelector('#collage-columns');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(columns, '1');
    columns.dispatchEvent(new Event('input', { bubbles: true }));
    columns.dispatchEvent(new Event('change', { bubbles: true }));
  })()
`);
await waitFor(
  `(() => {
    const canvas = document.querySelector('[data-collage-preview]');
    return canvas?.width === 392 && canvas?.height === 624;
  })()`,
  'single-column collage preview'
);

// Fine-tune holds every value the arrangement does not ask about, and hand-editing
// one has to be reversible: the way back to the recommended values is the only
// thing that makes the panel safe to open.
await evaluate(`document.querySelector('.collage-controls .fine-tune').open = true`);
if (fineTuneScreenshotPath) {
  await evaluate(`document.querySelector('.collage-controls').scrollIntoView({ block: 'start' })`);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(fineTuneScreenshotPath), { recursive: true });
  fs.writeFileSync(fineTuneScreenshotPath, Buffer.from(screenshot.data, 'base64'));
}
await evaluate(`
  (() => {
    const gap = document.querySelector('#collage-gap');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(gap, '40');
    gap.dispatchEvent(new Event('input', { bubbles: true }));
    gap.dispatchEvent(new Event('change', { bubbles: true }));
  })()
`);
await waitFor(
  `document.querySelector('.collage-controls .fine-tune-reset')?.textContent.includes('recommended')`,
  'fine-tune reset offered after a hand edit'
);
await waitFor(
  `(() => {
    const canvas = document.querySelector('[data-collage-preview]');
    return canvas?.width === 392 && canvas?.height === 648;
  })()`,
  'preview follows the hand-edited gap'
);
await evaluate(`document.querySelector('.collage-controls .fine-tune-reset').click()`);
await waitFor(
  `document.querySelector('#collage-gap').value === '16' &&
   document.querySelector('#collage-cell-width').value === '360' &&
   document.querySelector('#collage-cell-height').value === '288' &&
   !document.querySelector('.collage-controls .fine-tune-reset')`,
  'fine-tune returns to the recommended values'
);
await evaluate(`document.querySelector('.collage-controls .fine-tune').open = false`);

// Supersession: each click lands while the previous run is in flight or has just
// finished, so older runs have to abandon themselves instead of writing over the
// newer ones. What is checked afterwards is that the file on offer belongs to the
// arrangement that is selected at the end, not to one of the ones passed through.
for (const layout of ['auto-grid', 'horizontal', 'vertical', 'columns']) {
  await evaluate(
    `document.querySelector('.tool-chip input[name="collage-layout"][value="${layout}"]').click()`
  );
  await new Promise((resolve) => setTimeout(resolve, 330));
}
await waitFor(
  `document.querySelector('[data-collage-download]')?.disabled === false`,
  'collage file settled after rapid arrangement changes'
);
const settled = await evaluate(`(() => {
  const canvas = document.querySelector('[data-collage-preview]');
  const note = document.querySelector('.collage-controls .tool-run-note');
  return {
    width: canvas.width,
    height: canvas.height,
    checked: document.querySelector('.tool-chip input[name="collage-layout"]:checked').value,
    note: note.textContent.trim(),
    summary: document.querySelector('.collage-controls .fine-tune-summary').textContent.trim(),
  };
})()`);
assert.equal(settled.checked, 'columns');
assert.equal(settled.note.startsWith('Collage file ready'), true, settled.note);

await evaluate(`document.querySelector('[data-collage-download]').click()`);
const download = await waitForFile('toolkitfree-collage.png');
const bytes = fs.readFileSync(download);
assert.equal(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
// The saved file is the settled one, not a stale run's: PNG IHDR carries the size.
assert.deepEqual(
  { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
  { width: settled.width, height: settled.height },
  'The downloaded collage should match the arrangement on screen'
);

const urlStats = await evaluate(`window.__objectUrlStats()`);
// One more URL is created than revoked, and it is nameable: the collage file the
// download button now saves. It used to be revoked immediately after the click
// because the click is what built it; it is now held for as long as it is the
// answer to the settings on screen.
assert.equal(urlStats.active, 1);
assert.equal(urlStats.created - urlStats.revoked, 1);
assert.equal(urlStats.created >= 3, true);

// Start over drops it, so the registry returns to the baseline it started from.
await evaluate(`document.querySelector('.collage-clear').click()`);
await waitFor(`!document.querySelector('.collage-builder')`, 'cleared collage builder');
const clearedStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(clearedStats.active, 0);
assert.equal(clearedStats.created, clearedStats.revoked);

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await Promise.race([
  send('Target.closeTarget', { targetId: target.id }),
  new Promise((resolve) => setTimeout(resolve, 1_000)),
]);
socket.close();

console.log(
  JSON.stringify({
    status: 'IMAGE_COLLAGE_BROWSER_OK',
    uploaded: 2,
    defaultSize: { width: 768, height: 320 },
    verticalSize: { width: 392, height: 624 },
    uiLayouts,
    previewTouchDragOrder,
    pngBytes: bytes.length,
    settled,
    objectUrls: { afterDownload: urlStats, afterClear: clearedStats },
    browserErrors: actionableBrowserErrors.length,
  })
);
