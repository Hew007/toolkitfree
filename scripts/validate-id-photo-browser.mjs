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

/** Both exports decoded to the sizes the current settings ask for. */
function exportsAt(photoWidth, photoHeight, sheetWidth, sheetHeight) {
  return `(() => {
    const images = [...document.querySelectorAll('[data-id-photo-result] img')];
    return images.length === 2 &&
      images[0].naturalWidth === ${photoWidth} && images[0].naturalHeight === ${photoHeight} &&
      images[1].naturalWidth === ${sheetWidth} && images[1].naturalHeight === ${sheetHeight};
  })()`;
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

// Every exact value now lives in the fine-tune panel, which starts folded. The
// layout assertions below measure those fields, so the panel is opened first —
// a closed `details` reports zero-sized rectangles, which would pass the
// overlap check while measuring nothing at all.
await evaluate(`(() => { document.querySelector('.fine-tune').open = true; })()`);

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

// No click: both files follow the frame and the settings. Waiting on the decoded
// size rather than on the element count is what makes this assertion mean "the
// output matches the settings" instead of "two elements exist".
await waitFor(exportsAt(413, 531, 1800, 1200), 'custom-size exports');
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

// The submit button is gone and must stay gone: without this, adding one back
// would break nothing that any test can see.
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].some((button) => /Prepare photo and print sheet/i.test(button.textContent))`
  ),
  false,
  'the tool must not regain a submit button'
);

// The chip row is the document question, derived from the selectable presets.
const chipLabels = await evaluate(
  `[...document.querySelectorAll('input[name="id-photo-document"]')].map((input) => input.closest('.tool-chip').querySelector('.tool-chip-label').textContent)`
);
assert.deepEqual(chipLabels, [
  'Custom ID photo',
  'US passport print size reference',
  'UK passport paper size reference',
]);

// Two chip changes back to back, the second landing while the first run is still
// in flight. A superseded run that wrote its results anyway would leave the UK
// size on screen under the US chip.
await evaluate(
  `document.querySelector('input[name="id-photo-document"][value="uk-passport-paper-reference"]').click()`
);
await evaluate(
  `document.querySelector('input[name="id-photo-document"][value="us-passport-print-reference"]').click()`
);
await waitFor(
  `document.querySelector('[data-testid="id-photo-output-size"]').textContent.includes('600 × 600px')`,
  'US reference size'
);
await waitFor(exportsAt(600, 600, 1800, 1200), 'US reference exports');
const referenceResults = await inspectResults();
assert.deepEqual(
  referenceResults.map(({ width, height, type }) => ({ width, height, type })),
  [
    { width: 600, height: 600, type: 'image/jpeg' },
    { width: 1800, height: 1200, type: 'image/png' },
  ]
);

// Settle time for any late run that ignored its guard, then look again: the
// export must still belong to the settings on screen.
await new Promise((resolve) => setTimeout(resolve, 1200));
assert.deepEqual(
  (await inspectResults()).map(({ width, height }) => ({ width, height })),
  referenceResults.map(({ width, height }) => ({ width, height })),
  'a superseded run must not overwrite the current export'
);

// The two outputs are keyed on what each of them actually depends on, and this
// is what that buys: a quality change re-encodes the 11 KB photo without
// rebuilding the print sheet, and a print-layout change does the reverse. Each
// object URL below is one produced artifact, so a URL that changed names exactly
// one file that was re-encoded.
await evaluate(`(() => { document.querySelector('.fine-tune').open = true; })()`);
const setField = (startsWith, value) => `(() => {
  const field = [...document.querySelectorAll('.id-photo-field')].find((item) => item.textContent.trim().startsWith(${JSON.stringify(startsWith)}));
  const input = field.querySelector('input');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`;
const exportUrls = () =>
  evaluate(
    `[...document.querySelectorAll('[data-id-photo-result] img')].map((image) => image.src)`
  );
const settle = () => new Promise((resolve) => setTimeout(resolve, 1200));

const beforeTuning = await exportUrls();
await evaluate(setField('JPG quality', '60'));
await settle();
const afterQuality = await exportUrls();
assert.notEqual(beforeTuning[0], afterQuality[0], 'quality must re-encode the photo');
assert.equal(beforeTuning[1], afterQuality[1], 'quality must not re-encode the PNG print sheet');

await evaluate(setField('Print gap', '6'));
await settle();
const afterGap = await exportUrls();
assert.equal(afterQuality[0], afterGap[0], 'the print gap must not re-encode the photo');
assert.notEqual(afterQuality[1], afterGap[1], 'the print gap must rebuild the print sheet');

// Hand-editing a value offers the way back, and the offer is derived from the
// values themselves, so returning to the preset withdraws it again.
assert.equal(
  await evaluate(`document.querySelector('.fine-tune-reset').textContent`),
  'Back to the US passport print size reference preset'
);
await evaluate(`document.querySelector('.fine-tune-reset').click()`);
await waitFor(exportsAt(600, 600, 1800, 1200), 'exports back at the preset');
assert.equal(
  await evaluate(`document.querySelector('.fine-tune-summary').textContent`),
  '2 × 2 in · 300 DPI · JPG 92% · 4×6 sheet'
);
assert.equal(
  await evaluate(`document.querySelector('.fine-tune-reset') === null`),
  true,
  'the reset offer must withdraw once the values match the preset again'
);

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
console.log(
  JSON.stringify({
    status: 'ID_PHOTO_BROWSER_OK',
    customResults,
    referenceResults,
    uiLayouts,
    browserErrors: actionableBrowserErrors.length,
  })
);
