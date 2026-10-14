import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';
import { openBrowserSession } from './browser-session.mjs';

const root = process.cwd();
const fixture = path.join(root, 'test-fixtures/opaque.png');
const emptyFixture = path.join(root, 'test-fixtures/empty.bin');
const downloadDir = path.join(root, '.tmp-opt02-downloads');
const downloadPath = path.join(downloadDir, 'favicons.zip');
const pageUrl = `${process.env.BASE_URL || 'http://127.0.0.1:4321'}/tools/favicon-generator/`;

fs.mkdirSync(downloadDir, { recursive: true });
if (fs.existsSync(downloadPath)) fs.rmSync(downloadPath);

const session = await openBrowserSession({
  defaultEndpoint: 'http://127.0.0.1:9222',
  waitTimeoutMs: 20_000,
  pollMs: 100,
});
const { browserErrors, send, evaluate, waitFor } = session;

async function setFile(filePath) {
  const documentNode = await send('DOM.getDocument');
  const inputNode = await send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type="file"]',
  });
  assert.notEqual(inputNode.nodeId, 0, 'File input should exist');
  await send('DOM.setFileInputFiles', {
    nodeId: inputNode.nodeId,
    files: [filePath],
  });
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
await session.trackObjectUrls();

await session.navigate(pageUrl, { label: 'favicon uploader' });

await setFile(fixture);
await waitFor(`document.body.innerText.includes('opaque.png')`, 'valid file selection');

// The generate button is gone: the icons follow the chosen size set. If anyone
// puts a submit step back, this is what says so.
assert.equal(
  await evaluate(`
    [...document.querySelectorAll('button')]
      .some((button) => button.textContent.trim() === 'Generate Favicons')
  `),
  false,
  'There must be no generate step'
);

await waitFor(
  `document.querySelectorAll('[data-favicon-icon]').length === 5`,
  'first automatic favicon run'
);
const firstStats = await evaluate(`window.__objectUrlStats()`);
// 1 preview + 1 decode (revoked by loadImage) + 5 icons. There is no ZIP URL
// yet: packaging is still a deliberate action, so JSZip has not been asked for.
assert.deepEqual(firstStats, { created: 7, revoked: 1, active: 6 });

// Three size sets chosen back to back, faster than a run completes. The debounce
// collapses them into one run and the token makes any run that did start abandon
// itself, so the icons on screen must match the last chip only.
await evaluate(`
  (() => {
    const pick = (value) =>
      document.querySelector('input[name="favicon-size-set"][value="' + value + '"]').click();
    pick('tabs');
    pick('largest');
    pick('website');
  })()
`);
await waitFor(`document.querySelectorAll('[data-favicon-icon]').length === 3`, 'website size set');
await new Promise((resolve) => setTimeout(resolve, 600));
assert.deepEqual(
  await evaluate(
    `[...document.querySelectorAll('[data-favicon-icon]')].map((item) => item.dataset.faviconIcon)`
  ),
  ['favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
  'No superseded run may leave its icons behind'
);
const narrowedStats = await evaluate(`window.__objectUrlStats()`);
// The five icons of the first run are revoked and three replace them. The source
// is decoded once per file, so switching sets adds no decode URL, and the active
// count is back to the baseline of 1 preview plus one URL per icon on screen.
assert.deepEqual(narrowedStats, { created: 10, revoked: 6, active: 4 });

// Every size stays reachable from the fine-tune panel: the two the "Website only"
// chip left out are ticked back on by hand.
await evaluate(`
  (() => {
    document.querySelector('#favicon-size-192').click();
    document.querySelector('#favicon-size-512').click();
  })()
`);
await waitFor(
  `document.querySelectorAll('[data-favicon-icon]').length === 5`,
  'hand-picked size list'
);
const secondStats = await evaluate(`window.__objectUrlStats()`);
// 3 icons revoked, 5 created; still one decode for the same file.
assert.deepEqual(secondStats, { created: 15, revoked: 9, active: 6 });

// Hand-editing a size offers the way back to the named chip.
assert.equal(
  await evaluate(`
    [...document.querySelectorAll('button')]
      .some((button) => button.textContent.trim() === 'Back to the Website only set')
  `),
  true,
  'Reset back to the chip must appear once a size is hand-picked'
);

await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Download ZIP')
    .click()
`);
await waitFor(`Boolean(document.querySelector('[data-favicon-zip-url]'))`, 'ZIP packaging');
const zippedStats = await evaluate(`window.__objectUrlStats()`);
// One more URL than the run leaves behind, and it is the ZIP: packaging writes
// its own key, so it cannot revoke an icon the page is showing.
assert.deepEqual(zippedStats, { created: 16, revoked: 9, active: 7 });

const downloadStarted = Date.now();
while (!fs.existsSync(downloadPath) && Date.now() - downloadStarted < 10_000) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.equal(fs.existsSync(downloadPath), true, 'favicons.zip should download');

const archive = await JSZip.loadAsync(fs.readFileSync(downloadPath));
assert.deepEqual(Object.keys(archive.files).sort(), [
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'site.webmanifest',
]);

// The snippet has to name the files that were actually produced.
const snippet = await evaluate(`document.querySelector('pre').innerText`);
for (const expected of [
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'site.webmanifest',
]) {
  assert.equal(snippet.includes(expected), true, `HTML snippet should reference ${expected}`);
}
assert.equal(snippet.includes('.ico'), false, 'HTML snippet must not promise an .ico file');

await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Remove')
    .click()
`);
await waitFor(`!document.body.innerText.includes('opaque.png')`, 'file removal');
const removedStats = await evaluate(`window.__objectUrlStats()`);
assert.deepEqual(removedStats, { created: 16, revoked: 16, active: 0 });

await setFile(emptyFixture);
await waitFor(
  `document.body.innerText.includes('This file is empty. Choose a non-empty image.')`,
  'empty file validation'
);
const emptyStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(emptyStats.active, 0);
assert.equal(
  await evaluate(`document.querySelectorAll('[data-favicon-icon]').length`),
  0,
  'Empty file must not enter the processing workflow'
);
// Variant routes: the URL is the page's promise, so the chip must open on the set
// that route already named, and the run must follow that chip rather than a global
// default. WordPress builds every smaller size from the site icon, so that page
// opens on 512 alone; the other three promise the full set.
const variantExpectations = [
  { slug: 'png-to-favicon', set: 'all', icons: 5 },
  { slug: 'jpg-to-favicon', set: 'all', icons: 5 },
  { slug: 'logo-to-favicon', set: 'all', icons: 5 },
  { slug: 'favicon-for-wordpress', set: 'largest', icons: 1 },
];
const variantResults = {};
for (const variant of variantExpectations) {
  await session.navigate(`${pageUrl}${variant.slug}/`, { label: `${variant.slug} uploader` });
  await setFile(fixture);
  await waitFor(
    `document.querySelectorAll('[data-favicon-icon]').length === ${variant.icons}`,
    `${variant.slug} default run`
  );
  const lit = await evaluate(
    `document.querySelector('input[name="favicon-size-set"]:checked').value`
  );
  assert.equal(lit, variant.set, `${variant.slug} should open on the ${variant.set} size set`);
  variantResults[variant.slug] = {
    set: lit,
    icons: await evaluate(`document.querySelectorAll('[data-favicon-icon]').length`),
  };
}

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);

await session.close();

console.log(
  JSON.stringify({
    status: 'FAVICON_BROWSER_VALIDATION_OK',
    fixture: path.basename(fixture),
    firstStats,
    narrowedStats,
    secondStats,
    zippedStats,
    removedStats,
    variantResults,
    zipBytes: fs.statSync(downloadPath).size,
    zipEntries: Object.keys(archive.files).length,
    browserErrors: actionableBrowserErrors.length,
  })
);
