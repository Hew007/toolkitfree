import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import { openBrowserSession } from './browser-session.mjs';

const evidence = path.resolve(
  'docs/chinese-acceptance',
  `${new Date().toISOString().replaceAll(':', '-')}-special`
);
const downloads = path.join(evidence, 'downloads');
fs.mkdirSync(downloads, { recursive: true });
const imageFile = path.join(evidence, '中文测试图片.png');
fs.copyFileSync(path.resolve('test-fixtures/opaque.png'), imageFile);
const invalidPdf = path.join(evidence, '损坏文档.pdf');
fs.writeFileSync(invalidPdf, 'Not a PDF.');
const source = await PDFDocument.create();
for (let index = 0; index < 3; index++) {
  const page = source.addPage([300 + index * 20, 420]);
  page.drawRectangle({
    x: 30,
    y: 30,
    width: 70 + index * 20,
    height: 80,
    color: rgb(0.2, 0.4, 0.8),
  });
}
const pdfFile = path.join(evidence, '中文三页.pdf');
fs.writeFileSync(pdfFile, await source.save());

const session = await openBrowserSession({
  waitTimeoutMs: 120_000,
  commandTimeoutMs: 300_000,
  diagnoseTimeout: () =>
    `({url:location.href,errors:[...document.querySelectorAll('[role="alert"],.error-message')].map(el=>el.textContent),status:[...document.querySelectorAll('[role="status"]')].map(el=>el.textContent)})`,
});
const { send, evaluate, waitFor, navigate, setInputFiles } = session;
const begun = [];
const completed = new Set();
session.on('Browser.downloadWillBegin', (event) => begun.push(event));
session.on('Browser.downloadProgress', (event) => {
  if (event.state === 'completed') completed.add(event.guid);
});
const results = [];
const failures = [];

async function capture(name) {
  const { cssContentSize } = await send('Page.getLayoutMetrics');
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
  });
  fs.writeFileSync(path.join(evidence, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
}

async function page(tool) {
  await navigate(`/zh/tools/${tool}/`);
  assert.equal(await evaluate('document.documentElement.lang'), 'zh-CN');
  assert.match(await evaluate('document.querySelector("h1").textContent'), /[\u4e00-\u9fff]/);
}

async function setValue(selector, value) {
  await evaluate(`(async () => {
    const field = document.querySelector(${JSON.stringify(selector)});
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    await new Promise(resolve => requestAnimationFrame(resolve));
  })()`);
}

async function clickText(label, root = 'body') {
  await evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(`${root} button`)})].find(el => el.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Expected enabled button: ' + ${JSON.stringify(label)});
    button.click();
  })()`);
}

async function download(expression, label) {
  const previous = begun.length;
  await evaluate(expression);
  const deadline = Date.now() + 60_000;
  while (
    Date.now() < deadline &&
    (begun.length === previous || !completed.has(begun.at(-1).guid))
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(begun.length > previous, `${label} starts actual download`);
  const event = begun.at(-1);
  assert.ok(completed.has(event.guid), `${label} completes actual download`);
  const bytes = fs.readFileSync(path.join(downloads, event.guid));
  assert.ok(bytes.length > 0, `${label} nonempty download`);
  return { name: event.suggestedFilename, bytes };
}

async function settledPdf() {
  let previous = null;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const state = await evaluate(
      `({busy:document.querySelector('[data-pdf-page-tool]')?.getAttribute('aria-busy'),href:document.querySelector('[data-pdf-page-result] a[download]')?.href})`
    );
    if (state.href && state.href === previous && state.busy === 'false') return;
    previous = state.href;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('PDF output did not settle');
}

async function pdfSplitter() {
  await page('pdf-splitter');
  await setInputFiles('input[type="file"]', [pdfFile]);
  await waitFor(
    `document.querySelectorAll('[data-pdf-page]').length === 3`,
    'three Chinese PDF previews'
  );
  await setValue('#pdf-page-range', '4');
  await clickText('应用');
  await waitFor(
    `document.querySelector('[role="alert"]')?.textContent.includes('必须在 1 到 3 之间')`,
    'Chinese out-of-range error'
  );
  await capture('pdf-splitter-range-error');
  await setValue('#pdf-page-range', '1,3');
  await clickText('应用');
  await settledPdf();
  const combined = await download(
    `document.querySelector('[data-pdf-page-result] a[download]').click()`,
    'combined PDF'
  );
  const document = await PDFDocument.load(combined.bytes);
  assert.equal(document.getPageCount(), 2);
  assert.deepEqual(
    document.getPages().map((item) => item.getWidth()),
    [300, 340]
  );
  assert.match(combined.name, /中文三页/);
  await evaluate(
    `document.querySelector('input[name="pdf-output-mode"][value="individual"]').click()`
  );
  await settledPdf();
  const archive = await download(
    `document.querySelector('[data-pdf-page-result] a[download]').click()`,
    'separate PDF ZIP'
  );
  const zip = await JSZip.loadAsync(archive.bytes);
  const files = Object.values(zip.files).filter((item) => !item.dir);
  assert.equal(files.length, 2);
  for (const entry of files)
    assert.equal((await PDFDocument.load(await entry.async('uint8array'))).getPageCount(), 1);
  await capture('pdf-splitter-success');
  await page('pdf-splitter');
  await setInputFiles('input[type="file"]', [invalidPdf]);
  await waitFor(
    `document.querySelector('[role="alert"]')?.textContent.includes('有效的 PDF')`,
    'Chinese invalid PDF header'
  );
  await capture('pdf-splitter-invalid-file');
  return {
    tool: 'pdf-splitter',
    combined: combined.name,
    pageWidths: [300, 340],
    zipEntries: files.map((item) => item.name),
    invalidRange: true,
    invalidFile: true,
  };
}

async function qrGenerator() {
  await page('qr-generator');
  const payload = '中文二维码：你好，世界！\nhttps://example.com/中文?q=测试&value=原样';
  await setValue('#qr-text', payload);
  await waitFor(`document.querySelector('[data-qr-ready="true"]')`, 'Chinese QR render');
  assert.equal(await evaluate(`document.querySelector('[data-qr-data]').dataset.qrData`), payload);
  await setInputFiles('input[type="file"]', [imageFile]);
  await waitFor(
    `document.querySelector('img[alt="标志图片"]') && document.querySelector('input[name="qr-error-correction"][value="H"]').checked`,
    'QR logo upload'
  );
  await waitFor(`document.querySelector('[data-qr-ready="true"]')`, 'QR with logo');
  const png = await download(
    `[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='下载 PNG').click()`,
    'Chinese QR PNG'
  );
  assert.equal(png.bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const svg = await download(
    `[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='下载 SVG').click()`,
    'Chinese QR SVG'
  );
  assert.match(svg.bytes.toString('utf8'), /<svg[\s>]/);
  await capture('qr-success');
  await setValue('input[type="color"]', '#ffffff');
  await waitFor(
    `document.querySelector('[data-qr-download-enabled="false"]')`,
    'low contrast blocks QR download'
  );
  const warning = await evaluate(
    `document.querySelector('[data-qr-contrast-warning]').textContent`
  );
  assert.match(warning, /提高.*对比度/);
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('[data-qr-ready] button')].every(el=>el.disabled)`
    ),
    true
  );
  assert.equal(await evaluate(`document.querySelector('[data-qr-data]').dataset.qrData`), payload);
  await capture('qr-contrast-error');
  return {
    tool: 'qr-generator',
    payload,
    pngBytes: png.bytes.length,
    svgBytes: svg.bytes.length,
    logo: true,
    lowContrastBlocked: true,
  };
}

async function backgroundRemover() {
  await page('background-remover');
  await setInputFiles('input[type="file"]', [imageFile]);
  await waitFor(`document.querySelector('details.fine-tune')`, 'background controls');
  await evaluate(`document.querySelector('details.fine-tune > summary').click()`);
  await setValue('#background-hex', 'invalid');
  await evaluate(
    `document.querySelector('#background-hex').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`
  );
  await waitFor(
    `document.querySelector('#background-hex[aria-invalid="true"]')`,
    'background invalid hex'
  );
  assert.match(
    await evaluate(`document.querySelector('[role="alert"]').textContent`),
    /请输入.*颜色值/
  );
  await capture('background-hex-error');
  await setValue('#background-hex', '#ffffff');
  await evaluate(
    `document.querySelector('#background-hex').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`
  );
  await clickText('移除背景');
  await waitFor(
    `document.querySelector('[data-background-result]') || document.querySelector('.status-error')`,
    'background model completion',
    240_000
  );
  assert.equal(
    await evaluate(`document.querySelector('.status-error')?.textContent ?? null`),
    null
  );
  await waitFor(
    `document.querySelector('[data-background-result] button:not(:disabled)')`,
    'background download ready'
  );
  const runCount = await evaluate(
    `Number(document.querySelector('[data-background-model-runs]').dataset.backgroundModelRuns)`
  );
  await clickText('蓝色', '[data-background-chips]');
  await waitFor(
    `document.querySelector('[data-active-background]').dataset.activeBackground === '#0000ff' && document.querySelector('[data-background-composing]').dataset.backgroundComposing === 'false' && !document.querySelector('[data-background-result] button').disabled`,
    'background recolored result'
  );
  assert.equal(
    await evaluate(
      `Number(document.querySelector('[data-background-model-runs]').dataset.backgroundModelRuns)`
    ),
    runCount
  );
  const result = await download(
    `document.querySelector('[data-background-result] button').click()`,
    'background PNG'
  );
  assert.equal(result.bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const original = fs.readFileSync(imageFile);
  assert.equal(result.bytes.readUInt32BE(16), original.readUInt32BE(16));
  assert.equal(result.bytes.readUInt32BE(20), original.readUInt32BE(20));
  assert.match(result.name, /中文测试图片/);
  const environment = await evaluate(
    `({isolated:self.crossOriginIsolated,threads:document.querySelector('[data-background-threads]').dataset.backgroundThreads})`
  );
  await capture('background-success');
  return {
    tool: 'background-remover',
    name: result.name,
    bytes: result.bytes.length,
    modelRuns: runCount,
    recolorWithoutModel: true,
    environment,
  };
}

async function animationConverter() {
  await page('video-to-gif');
  await setInputFiles('input[type="file"]', [imageFile]);
  await waitFor(
    `document.querySelector('.error-message')?.textContent.includes('静态 PNG')`,
    'Chinese static PNG rejection'
  );
  assert.equal(
    await evaluate(`document.querySelector('.error-message a').getAttribute('href')`),
    '/zh/tools/image-converter/'
  );
  await capture('video-static-input-error');
  await page('video-to-gif');
  const video = await evaluate(`(async () => {
    const canvas=document.createElement('canvas');canvas.width=48;canvas.height=32;
    const context=canvas.getContext('2d');const stream=canvas.captureStream(8);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});const chunks=[];
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.start(50);
    for(let frame=0;frame<8;frame++){context.fillStyle=frame%2?'#2563eb':'#f59e0b';context.fillRect(0,0,48,32);context.fillStyle='#ffffff';context.fillRect(frame*4,8,12,12);await new Promise(resolve=>setTimeout(resolve,100));}
    await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});stream.getTracks().forEach(track=>track.stop());
    const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());return btoa(String.fromCharCode(...bytes));
  })()`);
  const videoFile = path.join(evidence, '中文短视频.webm');
  fs.writeFileSync(videoFile, Buffer.from(video, 'base64'));
  await setInputFiles('input[type="file"]', [videoFile]);
  await waitFor(`document.querySelector('#animation-duration')`, 'video conversion controls');
  await evaluate(`document.querySelector('details.fine-tune > summary').click()`);
  await setValue('#animation-duration', '0.5');
  await waitFor(
    `[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='生成 GIF'&&!el.disabled)`,
    'Chinese GIF create button'
  );
  await clickText('生成 GIF');
  await waitFor(
    `document.querySelector('[data-animation-converter] a[download]') || document.querySelector('.error-message')`,
    'GIF conversion completion',
    240_000
  );
  assert.equal(
    await evaluate(`document.querySelector('.error-message')?.textContent ?? null`),
    null
  );
  const result = await download(
    `document.querySelector('[data-animation-converter] a[download]').click()`,
    'GIF output'
  );
  assert.match(result.bytes.subarray(0, 6).toString(), /^GIF8[79]a$/);
  assert.ok(result.bytes.readUInt16LE(6) > 0 && result.bytes.readUInt16LE(8) > 0);
  assert.match(result.name, /中文短视频/);
  assert.match(
    await evaluate(`document.querySelector('.tool-run-note').textContent`),
    /已在此设备上完成/
  );
  await capture('video-gif-success');
  return {
    tool: 'video-to-gif',
    name: result.name,
    bytes: result.bytes.length,
    staticImageRejected: true,
    sourceBytes: fs.statSync(videoFile).size,
  };
}

try {
  for (const domain of ['Page', 'Runtime', 'DOM', 'Log']) await send(`${domain}.enable`);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: downloads,
    eventsEnabled: true,
  });
  const tests = {
    'pdf-splitter': pdfSplitter,
    'qr-generator': qrGenerator,
    'background-remover': backgroundRemover,
    'video-to-gif': animationConverter,
  };
  const selected = process.env.CHINESE_SPECIAL_FILTER?.split(',') ?? Object.keys(tests);
  for (const tool of selected) {
    assert.ok(tests[tool], `Unknown tool: ${tool}`);
    try {
      results.push(await tests[tool]());
      console.log(JSON.stringify(results.at(-1)));
    } catch (error) {
      failures.push({ tool, message: error.message });
      await capture(`${tool}-failure`);
      console.error(JSON.stringify(failures.at(-1)));
    }
  }
  assert.deepEqual(failures, [], 'Chinese special tool flows');
  assert.deepEqual(session.actionableErrors(), [], 'Browser errors');
} finally {
  fs.writeFileSync(
    path.join(evidence, 'results.json'),
    JSON.stringify({ results, failures, errors: session.actionableErrors() }, null, 2)
  );
  await session.close();
}
console.log(
  JSON.stringify({ status: 'CHINESE_SPECIAL_TOOLS_BROWSER_OK', tools: results.length, evidence })
);
