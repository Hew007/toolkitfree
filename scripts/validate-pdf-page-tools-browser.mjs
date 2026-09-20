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

/**
 * Waits for the download to match the controls. There is no submit step any
 * more, so "the link exists" is not enough — an older link can still be on
 * screen for a moment after a change. Settled means the tool is not busy and
 * the href has stopped changing across a poll longer than the rebuild debounce.
 */
async function waitForSettledResult(label, timeoutMs = 120_000) {
  const started = Date.now();
  let previous = null;
  while (Date.now() - started < timeoutMs) {
    const state = await evaluate(`(() => {
      const tool = document.querySelector('[data-pdf-page-tool]');
      const link = document.querySelector('[data-pdf-page-result] a[download]');
      return { busy: tool?.getAttribute('aria-busy'), href: link?.href ?? null };
    })()`);
    if (state.href && state.busy === 'false' && state.href === previous) return;
    previous = state.href;
    const failure = await evaluate(
      `document.querySelector('[data-pdf-page-tool] .status-error')?.textContent?.trim() || ''`
    );
    if (failure) throw new Error(`${label} failed: ${failure}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

/** No submit step: the download follows the pages, so these must not come back. */
async function assertNoSubmitStep(where) {
  const submitLabels = await evaluate(`
    [...document.querySelectorAll('[data-pdf-page-tool] button')]
      .map((button) => button.textContent.trim())
      .filter((text) => /^(extract|split|export)\\b/i.test(text))
  `);
  assert.deepEqual(submitLabels, [], `There must be no export button (${where})`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
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
const resourcesBeforeUpload = await evaluate(
  `performance.getEntriesByType('resource').map((entry) => entry.name)`
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
  'JSZip should stay lazy while one combined PDF is wanted'
);
await assertNoSubmitStep('after upload');
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

// Nothing has been clicked yet: every page arrives selected, so the combined
// download builds itself. This is the behaviour the old Extract button gated.
await waitForSettledResult('first automatic combined export');
const firstResult = await resultBase64();
assert.equal(firstResult.name, 'four-pages-extracted.pdf');
const firstPdf = await PDFDocument.load(Buffer.from(firstResult.base64, 'base64'));
assert.equal(firstPdf.getPageCount(), 4, 'The automatic export covers all four pages');
const resourcesAfterFirstRun = await evaluate(
  `performance.getEntriesByType('resource').map((entry) => entry.name)`
);
assert.ok(
  resourcesAfterFirstRun.some(
    (name) => /\/_astro\/index\.[^/]+\.js$/.test(name) && !resourcesBeforeUpload.includes(name)
  ),
  'The PDF export library should stay lazy until a PDF is chosen'
);
// 4 page thumbnails + 1 result. pdf.js renders into a canvas rather than through
// a blob URL, so nothing else here holds one.
assert.deepEqual(await evaluate(`window.__objectUrlStats()`), {
  created: 5,
  revoked: 0,
  active: 5,
});

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
// Three changes back to back, faster than a rebuild finishes. The debounce
// collapses them and the token makes any run that did start abandon itself, so
// the link that survives must describe the last of them and not an earlier one.
await evaluate(`(() => {
  const second = document.querySelector('[data-pdf-page="2"]');
  [...second.querySelectorAll('button')].find((button) => button.getAttribute('aria-label').includes('right')).click();
  [...second.querySelectorAll('button')].find((button) => button.getAttribute('aria-label').includes('earlier')).click();
})()`);
await waitFor(
  `document.querySelector('[data-pdf-page="2"]')?.dataset.order === '1' && document.querySelector('[data-pdf-page="2"]')?.dataset.rotation === '90'`,
  'page reorder and rotation'
);
await waitForSettledResult('combined page extraction');

// Page 4 is not selected, so the download does not depend on it: removing it
// must leave the existing link exactly as it is rather than rebuilding.
const hrefBeforeRemoval = await evaluate(
  `document.querySelector('[data-pdf-page-result] a[download]').href`
);
await evaluate(`document.querySelector('[data-pdf-page="4"] .pdf-page-remove').click()`);
await waitFor(`document.querySelectorAll('[data-pdf-page]').length === 3`, 'page removal');
await new Promise((resolve) => setTimeout(resolve, 1200));
assert.equal(
  await evaluate(`document.querySelector('[data-pdf-page-result] a[download]')?.href ?? null`),
  hrefBeforeRemoval,
  'Removing an unselected page must not rebuild the download'
);
const combinedResult = await resultBase64();
assert.equal(combinedResult.name, 'four-pages-extracted.pdf');
assert.equal(combinedResult.type, 'application/pdf');
const combinedPdf = await PDFDocument.load(Buffer.from(combinedResult.base64, 'base64'));
assert.equal(combinedPdf.getPageCount(), 2);
assert.equal(combinedPdf.getPage(0).getRotation().angle, degrees(90).angle);
assert.notEqual(
  combinedResult.base64,
  firstResult.base64,
  'The download must follow the range, order, and rotation'
);
const resourcesAfterCombined = await evaluate(
  `performance.getEntriesByType('resource').map((entry) => entry.name)`
);
assert.equal(
  resourcesAfterCombined.some((name) => name.includes('jszip.min.')),
  false,
  'JSZip should stay lazy for combined PDF export'
);
// Three surviving thumbnails plus one result. The created/revoked totals are
// deliberately not pinned: a rebuild that is superseded before it registers its
// URL never creates one, so how many of them exist depends on how fast this
// machine is. What must hold either way is that nothing is left behind.
const editedStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(editedStats.active, 4, 'Three page thumbnails and one result');
assert.equal(
  editedStats.created - editedStats.revoked,
  editedStats.active,
  'Every superseded result must be revoked'
);

await evaluate(`(() => {
  document.querySelectorAll('input[name="pdf-output-mode"]')[1].click();
  [...document.querySelectorAll('[data-pdf-page-tool] button')]
    .find((button) => button.textContent.trim() === 'Select all').click();
})()`);
await waitForSettledResult('individual page split');
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
await assertNoSubmitStep('after switching output mode');

// Clearing the selection must take the download with it, rather than leaving a
// link that no longer matches the pages above it.
await evaluate(`
  [...document.querySelectorAll('[data-pdf-page-tool] button')]
    .find((button) => button.textContent.trim() === 'Clear selection').click()
`);
await waitFor(
  `!document.querySelector('[data-pdf-page-result]')`,
  'download withdrawn with the selection'
);
const clearedStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(clearedStats.active, 3, 'Only the three page thumbnails should remain');

const workerRequests = await evaluate(
  `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('pdf.worker')).map((entry) => entry.name)`
);
assert.ok(workerRequests.length >= 1, 'PDF worker should load after a PDF is selected');
// The two variant routes are this tool's answer to the same question the chips
// ask, so each one must open on its own chip. A chip that quietly reset the
// output mode would break the promise the URL makes, and nothing else checks it.
const variantModes = [];
for (const [slug, expectedChip, extension] of [
  ['extract-pages-from-pdf', 'One combined PDF', '.pdf'],
  ['split-pdf-into-pages', 'Separate page files', '.zip'],
]) {
  await send('Page.navigate', { url: `${baseUrl}/tools/pdf-splitter/${slug}/` });
  await waitFor(
    `document.querySelector('[data-pdf-page-tool] input[type="file"]') && !document.querySelector('astro-island[ssr]')`,
    `${slug} hydration`
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
  await waitFor(`document.querySelectorAll('[data-pdf-page]').length === 4`, `${slug} previews`);
  const chip = await evaluate(`
    [...document.querySelectorAll('input[name="pdf-output-mode"]')]
      .find((input) => input.checked)
      ?.closest('.tool-chip')
      ?.querySelector('.tool-chip-label')
      ?.textContent?.trim() ?? null
  `);
  assert.equal(chip, expectedChip, `${slug} must open on its own chip`);
  await waitForSettledResult(`${slug} automatic export`);
  const download = await evaluate(
    `document.querySelector('[data-pdf-page-result] a[download]').download`
  );
  assert.ok(download.endsWith(extension), `${slug} must produce a ${extension}`);
  await assertNoSubmitStep(slug);
  variantModes.push({ slug, chip, download });
}

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
console.log(
  JSON.stringify({
    status: 'PDF_PAGE_TOOLS_BROWSER_OK',
    firstRun: { name: firstResult.name, size: firstResult.size, pages: 4 },
    combined: { name: combinedResult.name, size: combinedResult.size, pages: 2 },
    split: { name: splitResult.name, size: splitResult.size, files: splitNames.length },
    uiLayouts,
    workerRequests: workerRequests.length,
    objectUrls: clearedStats,
    variantModes,
    browserErrors: actionableBrowserErrors.length,
  })
);
