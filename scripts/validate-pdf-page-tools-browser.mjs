import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9226';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
const sourceDocument = await PDFDocument.create();
const font = await sourceDocument.embedFont(StandardFonts.Helvetica);
for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
  const page = sourceDocument.addPage([400 + pageNumber * 10, 560 + pageNumber * 15]);
  page.drawText(`ToolkitFree PDF page ${pageNumber}`, {
    x: 48,
    y: page.getHeight() - 72,
    size: 24,
    font,
    color: rgb(0.1, 0.25, 0.65),
  });
  page.drawRectangle({
    x: 48,
    y: 80,
    width: 80 + pageNumber * 20,
    height: 80,
    color: rgb(0.95, 0.55, 0.1),
  });
}
const sourceBytes = await sourceDocument.save();
const sourceBase64 = Buffer.from(sourceBytes).toString('base64');

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
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description || response.exceptionDetails.text
    );
  }
  return response.result.value;
}
async function waitFor(expression, label, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    const failure = await evaluate(
      `document.querySelector('[data-pdf-page-tool] .status-error')?.textContent?.trim() || ''`
    );
    if (failure) throw new Error(`${label} failed: ${failure}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function resultBase64() {
  return evaluate(`(async () => {
    const link = document.querySelector('[data-pdf-page-result] a[download]');
    const blob = await fetch(link.href).then((response) => response.blob());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return { name: link.download, type: blob.type, size: blob.size, base64: btoa(binary) };
  })()`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: `${baseUrl}/tools/pdf-splitter/` });
await waitFor(
  `document.querySelector('[data-pdf-page-tool] input[type="file"]') && !document.querySelector('astro-island[ssr]')`,
  'PDF splitter hydration'
);
assert.equal(
  await evaluate(
    `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('pdf.worker')).length`
  ),
  0,
  'PDF worker should stay lazy before upload'
);

await evaluate(`(() => {
  const binary = atob('${sourceBase64}');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const transfer = new DataTransfer();
  transfer.items.add(new File([bytes], 'four-pages.pdf', { type: 'application/pdf' }));
  const input = document.querySelector('[data-pdf-page-tool] input[type="file"]');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
await waitFor(`document.querySelectorAll('[data-pdf-page]').length === 4`, 'four page previews');
const resourcesAfterUpload = await evaluate(
  `performance.getEntriesByType('resource').map((entry) => entry.name)`
);
assert.ok(
  resourcesAfterUpload.some((name) => /\/_astro\/pdf\.[^/]+\.js$/.test(name)),
  'PDF.js should load after a PDF is selected'
);
assert.equal(
  resourcesAfterUpload.some((name) => name.includes('jszip.min.')),
  false,
  'JSZip should stay lazy until split export'
);
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('[data-pdf-page] img')].every((image) => image.complete && image.naturalWidth > 0)`
  ),
  true
);

const uiLayouts = [];
for (const width of [1440, 1240, 900, 600, 375]) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width <= 600,
  });
  const layout = await evaluate(`(() => {
    const tool = document.querySelector('[data-pdf-page-tool]');
    const grid = document.querySelector('[data-pdf-page-grid]');
    const cards = [...document.querySelectorAll('[data-pdf-page]')].map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    const overlaps = cards.some((first, index) => cards.slice(index + 1).some((second) =>
      first.left < second.right - 1 && first.right > second.left + 1 &&
      first.top < second.bottom - 1 && first.bottom > second.top + 1
    ));
    const firstTop = cards[0]?.top ?? 0;
    return {
      width: ${width},
      columns: cards.filter((card) => Math.abs(card.top - firstTop) < 2).length,
      overlaps,
      toolFits: tool.scrollWidth <= tool.clientWidth + 1,
      gridFits: grid.scrollWidth <= grid.clientWidth + 1
    };
  })()`);
  assert.equal(layout.overlaps, false, `Page cards should not overlap at ${width}px`);
  assert.equal(layout.toolFits && layout.gridFits, true, `PDF tool should fit at ${width}px`);
  uiLayouts.push(layout);
}
assert.equal(uiLayouts.at(-1).columns, 1);
await send('Emulation.clearDeviceMetricsOverride');

await evaluate(`(() => {
  const input = document.querySelector('#pdf-page-range');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(input, '2-3');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('[data-pdf-page-tool] button')]
    .find((button) => button.textContent.trim() === 'Apply').click();
})()`);
await waitFor(
  `document.querySelectorAll('[data-pdf-page] input[type="checkbox"]:checked').length === 2`,
  'range selection'
);
await evaluate(`(() => {
  const second = document.querySelector('[data-pdf-page="2"]');
  [...second.querySelectorAll('button')].find((button) => button.getAttribute('aria-label').includes('right')).click();
  [...second.querySelectorAll('button')].find((button) => button.getAttribute('aria-label').includes('earlier')).click();
})()`);
await waitFor(
  `document.querySelector('[data-pdf-page="2"]')?.dataset.order === '1' && document.querySelector('[data-pdf-page="2"]')?.dataset.rotation === '90'`,
  'page reorder and rotation'
);
await evaluate(`document.querySelector('[data-pdf-page="4"] .pdf-page-remove').click()`);
await waitFor(`document.querySelectorAll('[data-pdf-page]').length === 3`, 'page removal');

await evaluate(`
  [...document.querySelectorAll('[data-pdf-page-tool] button')]
    .find((button) => button.textContent.trim() === 'Extract 2 pages').click()
`);
await waitFor(
  `document.querySelector('[data-pdf-page-result] a[download$=".pdf"]')`,
  'combined page extraction'
);
const combinedResult = await resultBase64();
assert.equal(combinedResult.name, 'four-pages-extracted.pdf');
assert.equal(combinedResult.type, 'application/pdf');
const combinedPdf = await PDFDocument.load(Buffer.from(combinedResult.base64, 'base64'));
assert.equal(combinedPdf.getPageCount(), 2);
assert.equal(combinedPdf.getPage(0).getRotation().angle, degrees(90).angle);
const resourcesAfterCombined = await evaluate(
  `performance.getEntriesByType('resource').map((entry) => entry.name)`
);
assert.ok(
  resourcesAfterCombined.some(
    (name) => name.includes('/_astro/index.') && !resourcesAfterUpload.includes(name)
  ),
  'The PDF export library should load only when export begins'
);
assert.equal(
  resourcesAfterCombined.some((name) => name.includes('jszip.min.')),
  false,
  'JSZip should stay lazy for combined PDF export'
);

await evaluate(`(() => {
  [...document.querySelectorAll('[data-pdf-page-tool] button')]
    .find((button) => button.textContent.trim() === 'Select all').click();
  document.querySelectorAll('input[name="pdf-output-mode"]')[1].click();
})()`);
await waitFor(
  `[...document.querySelectorAll('[data-pdf-page-tool] button')].some((button) => button.textContent.trim() === 'Split 3 pages')`,
  'split mode'
);
await evaluate(`
  [...document.querySelectorAll('[data-pdf-page-tool] button')]
    .find((button) => button.textContent.trim() === 'Split 3 pages').click()
`);
await waitFor(
  `document.querySelector('[data-pdf-page-result] a[download$=".zip"]')`,
  'individual page split'
);
const splitResult = await resultBase64();
assert.equal(splitResult.name, 'four-pages-split-pages.zip');
const zip = await JSZip.loadAsync(Buffer.from(splitResult.base64, 'base64'));
assert.ok(
  await evaluate(
    `performance.getEntriesByType('resource').some((entry) => entry.name.includes('jszip.min.'))`
  ),
  'JSZip should load for individual-page export'
);
const splitNames = Object.keys(zip.files).filter((name) => name.endsWith('.pdf'));
assert.equal(splitNames.length, 3);
for (const name of splitNames) {
  const bytes = await zip.file(name).async('uint8array');
  const pagePdf = await PDFDocument.load(bytes);
  assert.equal(pagePdf.getPageCount(), 1);
}

const workerRequests = await evaluate(
  `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('pdf.worker')).map((entry) => entry.name)`
);
assert.ok(workerRequests.length >= 1, 'PDF worker should load after a PDF is selected');
const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
console.log(
  JSON.stringify({
    status: 'PDF_PAGE_TOOLS_BROWSER_OK',
    combined: { name: combinedResult.name, size: combinedResult.size, pages: 2 },
    split: { name: splitResult.name, size: splitResult.size, files: splitNames.length },
    uiLayouts,
    workerRequests: workerRequests.length,
    browserErrors: actionableBrowserErrors.length,
  })
);
