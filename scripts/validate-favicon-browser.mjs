import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const root = process.cwd();
const fixture = path.join(root, 'docs/optimization/baseline/fixtures/opaque.png');
const emptyFixture = path.join(root, 'docs/optimization/baseline/fixtures/empty.bin');
const downloadDir = path.join(root, '.tmp-opt02-downloads');
const downloadPath = path.join(downloadDir, 'favicons.zip');
const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const pageUrl = `${process.env.BASE_URL || 'http://127.0.0.1:4321'}/tools/favicon-generator/`;

fs.mkdirSync(downloadDir, { recursive: true });
if (fs.existsSync(downloadPath)) fs.rmSync(downloadPath);

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
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }
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
  'hydrated favicon uploader'
);

await setFile(fixture);
await waitFor(`document.body.innerText.includes('opaque.png')`, 'valid file selection');

await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Generate Favicons')
    .click()
`);
await waitFor(`document.body.innerText.includes('favicons.zip')`, 'first favicon generation');
const firstStats = await evaluate(`window.__objectUrlStats()`);
assert.deepEqual(firstStats, { created: 8, revoked: 1, active: 7 });

await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Generate Favicons')
    .click()
`);
await waitFor(`window.__objectUrlStats().created >= 15`, 'second favicon generation');
await waitFor(
  `document.body.innerText.includes('favicons.zip') && !document.body.innerText.includes('Generating...')`,
  'second favicon completion'
);
const secondStats = await evaluate(`window.__objectUrlStats()`);
assert.deepEqual(secondStats, { created: 15, revoked: 8, active: 7 });

await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Download ZIP')
    .click()
`);
await waitFor(`true`, 'download click dispatch');

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

await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Remove')
    .click()
`);
await waitFor(`!document.body.innerText.includes('opaque.png')`, 'file removal');
const removedStats = await evaluate(`window.__objectUrlStats()`);
assert.deepEqual(removedStats, { created: 15, revoked: 15, active: 0 });

await setFile(emptyFixture);
await waitFor(
  `document.body.innerText.includes('This file is empty. Choose a non-empty image.')`,
  'empty file validation'
);
const emptyStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(emptyStats.active, 0);
assert.equal(
  await evaluate(`
    [...document.querySelectorAll('button')]
      .some((button) => button.textContent.trim() === 'Generate Favicons')
  `),
  false,
  'Empty file must not enter the processing workflow'
);
const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);

await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'FAVICON_BROWSER_VALIDATION_OK',
    fixture: path.basename(fixture),
    firstStats,
    secondStats,
    removedStats,
    zipBytes: fs.statSync(downloadPath).size,
    zipEntries: Object.keys(archive.files).length,
    browserErrors: actionableBrowserErrors.length,
  })
);
