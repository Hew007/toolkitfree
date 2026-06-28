import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const root = process.cwd();
const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9227';
const baseUrl = 'http://127.0.0.1:4321';
const fixtures = path.join(root, 'docs/optimization/baseline/fixtures');
const tempDir = path.join(root, '.tmp-opt07-browser');
const downloadDir = path.join(tempDir, 'downloads');
const duplicatePng = path.join(tempDir, 'sample.png');

fs.mkdirSync(downloadDir, { recursive: true });
fs.copyFileSync(path.join(fixtures, 'transparent.png'), duplicatePng);

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
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(route) {
  await send('Page.navigate', { url: `${baseUrl}${route}` });
  await waitFor(
    `Boolean(document.querySelector('input[type="file"]')) && !document.querySelector('astro-island[ssr]')`,
    `${route} hydration`
  );
}

async function setFiles(filePaths) {
  const documentNode = await send('DOM.getDocument', { depth: 1, pierce: true });
  const inputNode = await send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: 'input[type="file"]',
  });
  assert.notEqual(inputNode.nodeId, 0);
  await send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files: filePaths });
}

async function clickAction(text) {
  assert.equal(await evaluate(`
    (() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(text)});
      if (!button) return false;
      button.click();
      return true;
    })()
  `), true, `${text} button`);
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

  assert.deepEqual(entries, expectedResults.map((result) => result.name));
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

const reports = [];

await navigate('/tools/image-converter');
await setFiles([
  path.join(fixtures, 'sample.webp'),
  duplicatePng,
  path.join(fixtures, 'invalid.txt'),
]);
await waitFor(`document.querySelectorAll('.file-item').length === 3`, 'converter files');
await clickAction('Convert 3 images');
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="1"]'))`,
  'converter mixed results'
);
assert.equal(await evaluate(`document.body.innerText.includes('invalid.txt:')`), true);
const converterResults = await inspectResults();
assert.deepEqual(converterResults.map((result) => result.name), ['sample.png', 'sample-2.png']);
assert.equal(converterResults.every((result) => result.type === 'image/png'), true);
reports.push(await downloadAndInspectZip('toolkitfree-converted-images.zip', converterResults));
assert.deepEqual(await evaluate(`window.__objectUrlStats()`), {
  created: 5,
  revoked: 2,
  active: 3,
});

await evaluate(`
  (() => {
    const select = document.querySelector('select[aria-label="Output Format"]');
    select.value = 'image/png';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()
`);
await waitFor(`window.__objectUrlStats().active === 0`, 'old converter URLs cleanup');

await navigate('/tools/image-compressor');
await setFiles([
  path.join(fixtures, 'photo.jpg'),
  path.join(fixtures, 'sample.webp'),
]);
await waitFor(`document.querySelectorAll('.file-item').length === 2`, 'compressor files');
await clickAction('Compress 2 images');
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="0"]'))`,
  'compressor results'
);
const compressorResults = await inspectResults();
assert.deepEqual(compressorResults.map((result) => result.type), ['image/jpeg', 'image/webp']);
reports.push(await downloadAndInspectZip('toolkitfree-compressed-images.zip', compressorResults));

await navigate('/tools/image-resizer');
await setFiles([
  path.join(fixtures, 'photo.jpg'),
  path.join(fixtures, 'sample.webp'),
]);
await waitFor(`document.querySelectorAll('.file-item').length === 2`, 'resizer files');
await clickAction('Resize 2 images');
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="2"][data-batch-failure-count="0"]'))`,
  'resizer results'
);
const resizerResults = await inspectResults();
assert.equal(resizerResults.every((result) => result.type === 'image/jpeg'), true);
reports.push(await downloadAndInspectZip('toolkitfree-resized-images.zip', resizerResults));

await navigate('/tools/image-converter');
await setFiles([path.join(fixtures, 'invalid.txt')]);
await waitFor(`document.querySelectorAll('.file-item').length === 1`, 'all-failure file');
await clickAction('Convert 1 image');
await waitFor(
  `Boolean(document.querySelector('[data-batch-success-count="0"][data-batch-failure-count="1"]'))`,
  'all-failure result'
);
assert.equal(await evaluate(`document.querySelector('[data-batch-download]').disabled`), true);

assert.deepEqual(browserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(JSON.stringify({
  status: 'BATCH_DOWNLOAD_BROWSER_OK',
  reports,
  mixedBatch: { success: 2, failure: 1 },
  allFailureBlocked: true,
  oldUrlsReleased: true,
  browserErrors: browserErrors.length,
}));
