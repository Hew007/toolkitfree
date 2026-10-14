import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';
import { openBrowserSession } from './browser-session.mjs';

const root = process.cwd();
const fixtures = path.join(root, 'test-fixtures');
const tempDir = process.env.BROWSER_TEMP_DIR || path.join(root, '.tmp-opt07-browser');
const downloadDir = path.join(tempDir, 'downloads');
const duplicatePng = path.join(tempDir, 'sample.png');

fs.mkdirSync(downloadDir, { recursive: true });
fs.copyFileSync(path.join(fixtures, 'transparent.png'), duplicatePng);

const session = await openBrowserSession({
  defaultEndpoint: 'http://127.0.0.1:9227',
  waitTimeoutMs: 30_000,
  pollMs: 100,
});
const { browserErrors, send, evaluate, waitFor } = session;
// This suite also waits for the file input itself, not only for hydration.
const navigate = (route) =>
  session.navigate(route, { ready: `Boolean(document.querySelector('input[type="file"]'))` });

async function setFiles(filePaths) {
  const documentNode = await send('DOM.getDocument', { depth: 1, pierce: true });
  const inputNode = await send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type="file"]',
  });
  assert.notEqual(inputNode.nodeId, 0);
  await send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files: filePaths });
}

/**
 * Every tool this suite drives now produces its results without a submit step, so
 * the helper that clicked one is gone. This replaces it: if a submit button ever
 * comes back, some route here will say so.
 */
async function assertNoSubmitButton(label) {
  assert.equal(
    await evaluate(`
    [...document.querySelectorAll('button')]
      .some((button) => /^(Convert|Compress|Resize) /.test(button.textContent.trim()))
  `),
    false,
    `${label} must not reintroduce a submit button`
  );
}

async function waitForDownload(filename) {
  const destination = path.join(downloadDir, filename);
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (fs.existsSync(destination) && !fs.existsSync(`${destination}.crdownload`)) {
      return destination;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${filename}`);
}

async function inspectResults() {
  return evaluate(`
    (async () => Promise.all(
      [...document.querySelectorAll('.result-item a[download]')].map(async (link) => {
        const blob = await fetch(link.href).then((response) => response.blob());
        const bytes = await blob.arrayBuffer();
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('');
        return { name: link.download, type: blob.type, size: blob.size, digest };
      })
    ))()
  `);
}

async function downloadAndInspectZip(filename, expectedResults) {
  const destination = path.join(downloadDir, filename);
  if (fs.existsSync(destination)) fs.rmSync(destination);

  await evaluate(`document.querySelector('[data-batch-download]').click()`);
  const downloaded = await waitForDownload(filename);
  const archive = await JSZip.loadAsync(fs.readFileSync(downloaded));
  const entries = Object.keys(archive.files).filter((name) => !archive.files[name].dir);

  assert.deepEqual(
    entries,
    expectedResults.map((result) => result.name)
  );
  for (const result of expectedResults) {
    const content = await archive.file(result.name).async('uint8array');
    assert.equal(content.byteLength, result.size, `${result.name} ZIP size`);
    assert.equal(
      createHash('sha256').update(content).digest('hex'),
      result.digest,
      `${result.name} ZIP content`
    );
  }
  return { filename, bytes: fs.statSync(downloaded).size, entries };
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

const reports = [];

await navigate('/tools/image-converter/');
await setFiles([
  path.join(fixtures, 'sample.webp'),
  duplicatePng,
  path.join(fixtures, 'invalid.txt'),
]);
await waitFor(`document.querySelectorAll('.file-item').length === 3`, 'converter files');
// The converter has no submit step any more: the batch follows the chosen format.
await assertNoSubmitButton('image-converter');
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="1"]'))`,
  'converter mixed results'
);
assert.equal(await evaluate(`document.body.innerText.includes('invalid.txt:')`), true);
const converterResults = await inspectResults();
assert.deepEqual(
  converterResults.map((result) => result.name),
  ['sample.png', 'sample-2.png']
);
assert.equal(
  converterResults.every((result) => result.type === 'image/png'),
  true
);
reports.push(await downloadAndInspectZip('toolkitfree-converted-images.zip', converterResults));
assert.deepEqual(await evaluate(`window.__objectUrlStats()`), {
  created: 7,
  revoked: 2,
  active: 5,
});

// Switching the format has to release the URLs the previous results held. A chip
// that is already selected fires no change event, so this picks a different one —
// which also proves the re-run happens without a submit step.
await evaluate(`
  (() => {
    const chip = document.querySelector('input[name="converter-output-format"][value="image/jpeg"]');
    chip.click();
  })()
`);
await waitFor(
  `document.querySelectorAll('.result-item a[download]').length === 2
   && [...document.querySelectorAll('.result-item a[download]')].every((link) => link.download.endsWith('.jpg'))`,
  'converter re-runs on the new format'
);

await navigate('/tools/image-compressor/');
await setFiles([path.join(fixtures, 'photo.jpg'), path.join(fixtures, 'sample.webp')]);
await waitFor(`document.querySelectorAll('.file-item').length === 2`, 'compressor files');
await assertNoSubmitButton('image-compressor');
// The compressor has no submit step: results follow the selected purpose.
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="0"]'))`,
  'compressor results'
);
const compressorResults = await inspectResults();
assert.deepEqual(
  compressorResults.map((result) => result.type),
  ['image/jpeg', 'image/webp']
);
reports.push(await downloadAndInspectZip('toolkitfree-compressed-images.zip', compressorResults));

await navigate('/tools/image-resizer/');
await setFiles([path.join(fixtures, 'photo.jpg'), path.join(fixtures, 'sample.webp')]);
await waitFor(`document.querySelectorAll('.file-item').length === 2`, 'resizer files');
await assertNoSubmitButton('image-resizer');
// The resizer has no submit step either, since 54e9774: results follow the controls,
// debounced, so the wait below is what stands in for a click.
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="0"]'))`,
  'resizer results'
);
const resizerResults = await inspectResults();
assert.equal(
  resizerResults.every((result) => result.type === 'image/jpeg'),
  true
);
reports.push(await downloadAndInspectZip('toolkitfree-resized-images.zip', resizerResults));

await navigate('/tools/image-converter/');
await setFiles([path.join(fixtures, 'invalid.txt')]);
await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'all-failure file');
// Again no submit step; the failure summary has to arrive on its own.
await assertNoSubmitButton('image-converter all-failure');
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="0"][data-batch-failure-count="1"]'))`,
  'all-failure result'
);
assert.equal(await evaluate(`document.querySelector('[data-batch-download]').disabled`), true);

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await session.close();

console.log(
  JSON.stringify({
    status: 'BATCH_DOWNLOAD_BROWSER_OK',
    reports,
    mixedBatch: { success: 2, failure: 1 },
    allFailureBlocked: true,
    oldUrlsReleased: true,
    browserErrors: actionableBrowserErrors.length,
  })
);
