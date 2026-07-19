import assert from 'node:assert/strict';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9226';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
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
async function waitFor(expression, label, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function inspectResults() {
  return evaluate(`Promise.all([...document.querySelectorAll('[data-id-photo-result]')].map(async (item) => {
    const blob = await fetch(item.querySelector('img').src).then((response) => response.blob());
    const bitmap = await createImageBitmap(blob);
    const result = { name: item.dataset.idPhotoResult, width: bitmap.width, height: bitmap.height, type: blob.type, size: blob.size };
    bitmap.close();
    return result;
  }))`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: `${baseUrl}/tools/id-photo-maker/` });
await waitFor(
  `Boolean(document.querySelector('[data-id-photo-maker] input[type="file"]')) && !document.querySelector('astro-island[ssr]')`,
  'ID photo maker hydration'
);
await evaluate(`(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 600;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 900, 600);
  gradient.addColorStop(0, '#1d4ed8'); gradient.addColorStop(1, '#fbbf24');
  context.fillStyle = gradient; context.fillRect(0, 0, 900, 600);
  context.fillStyle = '#ffffff'; context.fillRect(350, 100, 200, 400);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], 'id-photo-test.png', { type: 'image/png' }));
  const input = document.querySelector('[data-id-photo-maker] input[type="file"]');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

await waitFor(`Boolean(document.querySelector('[data-testid="id-photo-editor"]'))`, 'photo editor');
const uiLayouts = [];
for (const width of [1440, 1240, 900, 600, 375]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width <= 600,
  });
  const layout = await evaluate(`(() => {
    const maker = document.querySelector('[data-id-photo-maker]');
    const grids = [...document.querySelectorAll('.id-photo-options-grid')];
    const gridReports = grids.map((grid) => {
      const fields = [...grid.querySelectorAll(':scope > .id-photo-field')];
      const rectangles = fields.map((field) => {
        const rect = field.getBoundingClientRect();
        const control = field.querySelector('.id-photo-control').getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          controlInside: control.left >= rect.left - 1 && control.right <= rect.right + 1
        };
      });
      const overlaps = rectangles.some((first, index) => rectangles.slice(index + 1).some((second) =>
        first.left < second.right - 1 && first.right > second.left + 1 &&
        first.top < second.bottom - 1 && first.bottom > second.top + 1
      ));
      const firstTop = rectangles[0]?.top ?? 0;
      return {
        columns: rectangles.filter((rect) => Math.abs(rect.top - firstTop) < 2).length,
        overlaps,
        controlsInside: rectangles.every((rect) => rect.controlInside),
        scrollWidth: grid.scrollWidth,
        clientWidth: grid.clientWidth
      };
    });
    return {
      width: ${width},
      makerFits: maker.scrollWidth <= maker.clientWidth + 1,
      grids: gridReports
    };
  })()`);
  assert.equal(layout.makerFits, true, `ID photo maker should fit at ${width}px`);
  assert.equal(
    layout.grids.every(
      (grid) => !grid.overlaps && grid.controlsInside && grid.scrollWidth <= grid.clientWidth + 1
    ),
    true,
    `ID photo fields should not overlap or overflow at ${width}px`
  );
  uiLayouts.push(layout);
}
assert.equal(
  uiLayouts.at(-1).grids.every((grid) => grid.columns === 1),
  true
);
await send('Emulation.clearDeviceMetricsOverride');

assert.match(
  await evaluate(`document.querySelector('[data-testid="id-photo-output-size"]').textContent`),
  /413\s*×\s*531px/
);
await evaluate(
  `[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Prepare photo and print sheet').click()`
);
await waitFor(`document.querySelectorAll('[data-id-photo-result]').length === 2`, 'two exports');
const customResults = await inspectResults();
assert.deepEqual(
  customResults.map(({ width, height, type }) => ({ width, height, type })),
  [
    { width: 413, height: 531, type: 'image/jpeg' },
    { width: 1800, height: 1200, type: 'image/png' },
  ]
);
assert.equal(
  customResults.every((result) => result.size > 0),
  true
);

await evaluate(`(() => {
  const select = [...document.querySelectorAll('select')].find((item) => [...item.options].some((option) => option.value === 'us-passport-print-reference'));
  select.value = 'us-passport-print-reference';
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor(
  `document.querySelector('[data-testid="id-photo-output-size"]').textContent.includes('600 × 600px')`,
  'US reference size'
);
const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
console.log(
  JSON.stringify({
    status: 'ID_PHOTO_BROWSER_OK',
    customResults,
    uiLayouts,
    browserErrors: actionableBrowserErrors.length,
  })
);
