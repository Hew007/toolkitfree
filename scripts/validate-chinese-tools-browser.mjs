import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openBrowserSession } from './browser-session.mjs';

const evidence = path.resolve(
  'docs/chinese-acceptance',
  new Date().toISOString().replaceAll(':', '-')
);
const downloads = path.join(evidence, 'downloads');
fs.mkdirSync(downloads, { recursive: true });
const fixture = path.join(evidence, '测试图片.png');
fs.copyFileSync(path.resolve('test-fixtures/opaque.png'), fixture);
const invalidFixture = path.join(evidence, '损坏图片.png');
fs.writeFileSync(invalidFixture, 'This is deliberately not a decodable image.');
const replacementFixture = path.join(evidence, '新图片.png');
fs.copyFileSync(fixture, replacementFixture);
const session = await openBrowserSession({ waitTimeoutMs: 90_000 });
const { send, evaluate, waitFor, navigate, setInputFiles } = session;
const begun = [];
const completed = new Set();
session.on('Browser.downloadWillBegin', (event) => begun.push(event));
session.on('Browser.downloadProgress', (event) => {
  if (event.state === 'completed') completed.add(event.guid);
});
const results = [];
const interactionChecks = [];
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
const independentTools = new Set([
  'image-converter',
  'image-compressor',
  'image-resizer',
  'image-enhancer',
  'image-collage',
  'image-splitter',
  'image-cropper',
]);
const cases = [
  ['image-converter', '.result-item a[download]'],
  ['image-compressor', '.result-item a[download]'],
  ['image-resizer', '.result-item a[download]'],
  ['image-enhancer', '[data-enhancer-result] button'],
  ['image-collage', '[data-collage-download]'],
  ['image-splitter', '[data-split-results] a[download]'],
  ['image-cropper', '[data-crop-result] button'],
  ['id-photo-maker', '[data-id-photo-result] button'],
  ['image-to-pdf', '[data-pdf-result] button'],
  ['favicon-generator', '.result-item button'],
];
const requestedTools = process.env.CHINESE_TOOL_FILTER?.split(',');
const selectedCases = requestedTools
  ? cases.filter(([tool]) => requestedTools.includes(tool))
  : cases;
assert.ok(selectedCases.length > 0, 'At least one known tool must be selected');
if (requestedTools)
  assert.equal(selectedCases.length, requestedTools.length, 'Unknown or duplicate tool filter');
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
  for (const [tool, selector] of selectedCases) {
    await navigate(`/zh/tools/${tool}/`);
    assert.equal(await evaluate('document.documentElement.lang'), 'zh-CN', `${tool} locale`);
    assert.match(
      await evaluate('document.querySelector("h1").textContent'),
      /[\u4e00-\u9fff]/,
      `${tool} title`
    );
    await setInputFiles('input[type="file"]', [fixture]);
    await waitFor(
      `document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`,
      `${tool} downloadable result`
    );
    const label = await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).textContent.trim()`
    );
    assert.match(label, /[\u4e00-\u9fff]/, `${tool} Chinese download action`);
    {
      await evaluate(`document.querySelector('details.fine-tune > summary').click()`);
      const fineTune = await evaluate(`(() => {
        const panel = document.querySelector('details.fine-tune');
        return { open: panel.open, text: panel.innerText,
          labels: [...panel.querySelectorAll('label')].filter(el => el.getClientRects().length).map(el => el.textContent.trim()) };
      })()`);
      assert.equal(fineTune.open, true, `${tool} fine-tune opens`);
      assert.match(fineTune.text, /微调/, `${tool} fine-tune Chinese`);
      assert.doesNotMatch(
        fineTune.labels.join(' '),
        /Quality|Output format|Brightness|Contrast|Saturation|Width|Height|Padding|Margin/,
        `${tool} translated field labels`
      );
      interactionChecks.push({ tool, fineTune });
    }
    const previous = begun.length;
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const deadline = Date.now() + 60_000;
    while (
      Date.now() < deadline &&
      (begun.length === previous || !completed.has(begun.at(-1).guid))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(begun.length > previous, `${tool} begins real download`);
    const download = begun.at(-1);
    assert.ok(completed.has(download.guid), `${tool} finishes real download`);
    const bytes = fs.readFileSync(path.join(downloads, download.guid));
    assert.ok(bytes.length > 0, `${tool} nonempty output`);
    const prefix = bytes.subarray(0, 12);
    assert.ok(
      prefix.subarray(0, 4).toString() === '%PDF' ||
        prefix.subarray(0, 2).toString() === 'PK' ||
        prefix[0] === 0x89 ||
        (prefix[0] === 0xff && prefix[1] === 0xd8) ||
        prefix.subarray(0, 4).toString() === 'RIFF',
      `${tool} valid output signature`
    );
    await capture(tool);
    results.push({ tool, name: download.suggestedFilename, bytes: bytes.length, label });
    console.log(JSON.stringify(results.at(-1)));
    if (independentTools.has(tool)) {
      try {
        await navigate(`/zh/tools/${tool}/`);
        await setInputFiles('input[type="file"]', [invalidFixture]);
        await waitFor(
          `Array.from(document.querySelectorAll('[role="alert"], .error-message, .status-error')).some(el => el.getClientRects().length && el.textContent.trim())`,
          `${tool} invalid input feedback`
        );
        const feedback = await evaluate(
          `Array.from(document.querySelectorAll('[role="alert"], .error-message, .status-error')).filter(el => el.getClientRects().length).map(el => el.textContent.trim()).join(' ')`
        );
        assert.match(feedback, /[\u4e00-\u9fff]/, `${tool} Chinese invalid input feedback`);
        assert.doesNotMatch(
          feedback,
          /could not be opened|processing failed|Choose a|damaged or unsupported/i,
          `${tool} no untranslated known input error`
        );
        interactionChecks.at(-1).invalidInput = feedback;
        await capture(`${tool}-invalid`);
        if (tool === 'image-cropper') {
          assert.equal(
            await evaluate(`Boolean(document.querySelector('[data-crop-result]'))`),
            false,
            'Corrupt crop input has no download'
          );
          await setInputFiles('input[type="file"]', [fixture]);
          await waitFor(
            `document.querySelector('[data-crop-result] button:not(:disabled)')`,
            'cropper recovery after invalid upload'
          );
          await evaluate(
            `window.__previousCropPreview = document.querySelector('.cropper-preview-image'); document.querySelector('.cropper-file-summary button').click()`
          );
          await waitFor(
            `document.querySelector('input[type="file"]')`,
            'cropper replacement input'
          );
          await setInputFiles('input[type="file"]', [replacementFixture]);
          await waitFor(
            `document.querySelector('.cropper-preview-image')`,
            'replacement crop preview'
          );
          await evaluate(
            `window.__previousCropPreview.dispatchEvent(new Event('error')); window.__previousCropPreview.dispatchEvent(new Event('load'));`
          );
          await waitFor(
            `document.querySelector('[data-crop-result]')?.dataset.cropResult.includes('新图片')`,
            'new crop result survives old events'
          );
          assert.equal(
            await evaluate(`Boolean(document.querySelector('.status-error'))`),
            false,
            'Stale crop image events cannot set an error'
          );
          assert.match(
            await evaluate(`document.querySelector('.cropper-file-summary').textContent`),
            /新图片/
          );
          interactionChecks.at(-1).recovery =
            'Corrupt input has no download; valid re-upload succeeds; stale previous load/error events preserve the replacement';
          await evaluate(`document.querySelector('details.fine-tune').open = true`);
          await capture('image-cropper-recovery');
        }
      } catch (error) {
        failures.push({ tool, phase: 'invalid input', message: error.message });
        await capture(`${tool}-invalid-failure`);
      }
    }
  }
  assert.deepEqual(session.actionableErrors(), []);
  assert.deepEqual(failures, [], 'All invalid input paths must report an actionable Chinese error');
} finally {
  fs.writeFileSync(
    path.join(evidence, 'results.json'),
    JSON.stringify(
      { results, interactionChecks, failures, errors: session.actionableErrors() },
      null,
      2
    )
  );
  await session.close();
}
console.log(
  JSON.stringify({ status: 'CHINESE_IMAGE_TOOLS_BROWSER_OK', cases: results.length, evidence })
);
