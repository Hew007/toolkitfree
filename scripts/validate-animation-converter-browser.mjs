import assert from 'node:assert/strict';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9226';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
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
  if (message.method === 'Runtime.exceptionThrown')
    browserErrors.push(message.params.exceptionDetails.text);
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
async function waitFor(expression, label, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    if (label.includes('conversion')) {
      const failure = await evaluate(
        `document.querySelector('[data-animation-converter] .error-message')?.textContent?.trim() || ''`
      );
      if (failure) throw new Error(`${label} failed: ${failure}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const diagnostic = await evaluate(`({
    status: document.querySelector('[data-animation-converter] .conversion-progress span')?.textContent?.trim(),
    error: document.querySelector('[data-animation-converter] .error-message')?.textContent?.trim(),
    progress: document.querySelector('[data-animation-converter] [role="progressbar"]')?.getAttribute('aria-valuenow'),
    resources: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/generated/ffmpeg/')).map((entry) => entry.name)
  })`);
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(diagnostic)}`);
}
let progressMotionChecked = false;
async function convertTo(format, sourceKey = null) {
  if (sourceKey) {
    await evaluate(`window.__animationTest.upload(window.__animationTest.outputs.${sourceKey})`);
    await waitFor(
      `document.querySelector('.file-item-name')?.textContent.includes(window.__animationTest.outputs.${sourceKey}.name)`,
      `${sourceKey} upload`
    );
  }
  // The output format is chosen with the chip row now. The equivalent control in
  // the fine-tune panel is asserted below to stay in step with it, so neither can
  // drift into disagreeing with the other.
  await evaluate(`(() => {
    const converter = document.querySelector('[data-animation-converter]');
    converter.querySelector('input[name="animation-output"][value="${format}"]').click();
    const duration = converter.querySelector('#animation-duration');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setValue.call(duration, '0.7'); duration.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(
    `[...document.querySelectorAll('[data-animation-converter] button')].some((item) => item.textContent.trim() === 'Create ${format.toUpperCase()}')`,
    `${format} settings`
  );
  const chipState = await evaluate(`(() => {
    const converter = document.querySelector('[data-animation-converter]');
    return {
      selectedChip: converter.querySelector('input[name="animation-output"]:checked')?.value,
      fineTuneFormat: converter.querySelector('#animation-output-format')?.value,
      summary: converter.querySelector('.fine-tune-summary')?.textContent.trim(),
      runNote: converter.querySelector('.tool-run-note')?.textContent.trim(),
      createDisabled: [...converter.querySelectorAll('button')].find((item) => item.textContent.trim().startsWith('Create'))?.disabled
    };
  })()`);
  assert.equal(chipState.selectedChip, format, 'The chip row should hold the chosen output format');
  assert.equal(
    chipState.fineTuneFormat,
    format,
    'The fine-tune format control should mirror the chip'
  );
  assert.ok(chipState.summary?.includes('fps'), 'The folded fine-tune row should state its values');
  assert.ok(chipState.runNote?.length > 0, 'The run note should say what happens next');
  assert.equal(chipState.createDisabled, false, 'These settings are inside every budget');
  // A settings change drops the previous download, so a result on screen always
  // belongs to the controls above it.
  await waitFor(
    `!document.querySelector('[data-animation-converter] .result-item a[download]')`,
    `${format} previous result cleared`
  );
  await evaluate(
    `[...document.querySelectorAll('[data-animation-converter] button')].find((item) => item.textContent.trim() === 'Create ${format.toUpperCase()}').click()`
  );
  if (!progressMotionChecked) {
    await waitFor(
      `document.querySelector('[data-animation-converter] .conversion-progress-track.is-active')`,
      'animated progress indicator'
    );
    const progressMotion = await evaluate(`(() => {
      const track = document.querySelector('[data-animation-converter] .conversion-progress-track.is-active');
      const fill = track.querySelector('.conversion-progress-fill');
      return {
        fillAnimation: getComputedStyle(fill).animationName,
        shimmerAnimation: getComputedStyle(track, '::after').animationName,
        value: Number(track.getAttribute('aria-valuenow'))
      };
    })()`);
    assert.notEqual(progressMotion.fillAnimation, 'none');
    assert.notEqual(progressMotion.shimmerAnimation, 'none');
    assert.equal(Number.isFinite(progressMotion.value), true);
    progressMotionChecked = true;
  }
  await waitFor(
    `document.querySelector('[data-animation-converter] .result-item a[download$=".${format === 'apng' ? 'apng' : format}"]')`,
    `${format} conversion`,
    180_000
  );
  return evaluate(`(async () => {
    const link = document.querySelector('[data-animation-converter] .result-item a[download]');
    const blob = await fetch(link.href).then((response) => response.blob());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ascii = new TextDecoder('latin1').decode(bytes);
    const result = { name: link.download, type: blob.type, size: blob.size, prefix: [...bytes.slice(0, 12)], hasAnim: ascii.includes('ANIM'), hasActl: ascii.includes('acTL'), gifFrames: (ascii.match(/\x21\xF9\x04/g) || []).length };
    window.__animationTest.outputs.${format} = new File([blob], link.download, { type: blob.type });
    return result;
  })()`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
// The progress indicator is intentionally still under `prefers-reduced-motion: reduce`, so the
// motion assertions below only hold when the preference is pinned rather than inherited from the
// host operating system.
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
});
await send('Page.navigate', { url: `${baseUrl}/tools/video-to-gif/` });
await waitFor(
  `document.querySelector('[data-animation-converter] input[type="file"]') && !document.querySelector('astro-island[ssr]')`,
  'animation converter hydration'
);

await send('Emulation.setDeviceMetricsOverride', {
  width: 375,
  height: 812,
  deviceScaleFactor: 2,
  mobile: true,
});
const mobileFormatGuide = await evaluate(`(() => ({
  viewportWidth: document.documentElement.clientWidth,
  items: [...document.querySelectorAll('.format-guide-item')].map((item) => {
    const label = item.querySelector('strong').getBoundingClientRect();
    const description = item.querySelector('span').getBoundingClientRect();
    return {
      labelWidth: label.width,
      labelHeight: label.height,
      descriptionTop: description.top,
      labelBottom: label.bottom,
      display: getComputedStyle(item).display
    };
  })
}))()`);
assert.equal(mobileFormatGuide.viewportWidth, 375);
assert.equal(mobileFormatGuide.items.length, 3);
assert.equal(
  mobileFormatGuide.items.every(
    (item) =>
      item.display === 'grid' &&
      item.labelWidth > 30 &&
      item.labelHeight < 30 &&
      item.descriptionTop >= item.labelBottom - 1
  ),
  true,
  'Format labels should remain intact and descriptions should stack below them on narrow screens'
);
await send('Emulation.clearDeviceMetricsOverride');

const initialCoreRequests = await evaluate(
  `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/generated/ffmpeg/')).length`
);
assert.equal(initialCoreRequests, 0, 'FFmpeg assets must stay lazy before file conversion');

await evaluate(`(async () => {
  const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 32;
  const context = canvas.getContext('2d');
  const stream = canvas.captureStream(8);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
  const chunks = []; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.start(50);
  for (let frame = 0; frame < 6; frame += 1) {
    context.fillStyle = frame % 2 ? '#2563eb' : '#f59e0b'; context.fillRect(0, 0, 48, 32);
    context.fillStyle = '#ffffff'; context.fillRect(frame * 6, 8, 12, 12);
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
  const source = new File(chunks, 'browser-test.webm', { type: 'video/webm' });
  window.__animationTest = {
    source,
    outputs: {},
    upload(file) {
      const transfer = new DataTransfer(); transfer.items.add(file);
      const input = document.querySelector('[data-animation-converter] input[type="file"]');
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  window.__animationTest.upload(source);
})()`);
await waitFor(
  `document.querySelector('.file-item-name')?.textContent.includes('browser-test.webm')`,
  'video upload'
);

const chipRow = await evaluate(`(() => {
  const converter = document.querySelector('[data-animation-converter]');
  const group = converter.querySelector('.tool-chip-group');
  return {
    legend: group?.querySelector('legend')?.textContent.trim(),
    chips: [...converter.querySelectorAll('input[name="animation-output"]')].map((input) => ({
      value: input.value,
      label: input.closest('.tool-chip')?.querySelector('.tool-chip-label')?.textContent.trim(),
      hint: input.closest('.tool-chip')?.querySelector('.tool-chip-hint')?.textContent.trim()
    })),
    fineTuneOpen: converter.querySelector('.fine-tune')?.open,
    fineTuneControls: [...converter.querySelectorAll('.fine-tune-field')].map((field) => field.querySelector('select,input')?.id)
  };
})()`);
assert.equal(chipRow.legend, 'What is the animation for?');
assert.deepEqual(
  chipRow.chips.map((chip) => chip.value),
  ['gif', 'webp', 'apng']
);
assert.deepEqual(
  chipRow.chips.map((chip) => chip.label),
  ['GIF', 'Animated WebP', 'APNG']
);
assert.equal(
  chipRow.chips.every((chip) => chip.hint && chip.hint.length > 0),
  true,
  'Every chip should say what its format is good for'
);
assert.equal(chipRow.fineTuneOpen, false, 'The fine-tune panel starts folded');
// Nothing the old settings grid offered was removed; it was moved into the panel.
// WebP quality was conditional on the output format there too, so it appears once
// Animated WebP is selected, below.
assert.deepEqual(chipRow.fineTuneControls, [
  'animation-output-format',
  'animation-preset',
  'animation-start',
  'animation-duration',
  'animation-loop',
]);

const gif = await convertTo('gif');
assert.equal(String.fromCharCode(...gif.prefix.slice(0, 3)), 'GIF');
assert.ok(gif.gifFrames >= 2, 'GIF output should contain multiple frames');

const webpQualityField = await evaluate(`(() => {
  const converter = document.querySelector('[data-animation-converter]');
  converter.querySelector('input[name="animation-output"][value="webp"]').click();
  return Boolean(converter.querySelector('#animation-quality'));
})()`);
assert.equal(webpQualityField, true, 'WebP quality belongs in the fine-tune panel');

const webp = await convertTo('webp');
assert.equal(String.fromCharCode(...webp.prefix.slice(0, 4)), 'RIFF');
assert.equal(webp.hasAnim, true, 'WebP output should contain ANIM');

const apng = await convertTo('apng');
assert.deepEqual(apng.prefix.slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(apng.hasActl, true, 'APNG output should contain acTL');

const webpToGif = await convertTo('gif', 'webp');
assert.ok(webpToGif.gifFrames >= 2, 'Animated WebP input should retain multiple frames');
const gifToApng = await convertTo('apng', 'gif');
assert.equal(gifToApng.hasActl, true, 'GIF input should create APNG animation');
const apngToWebp = await convertTo('webp', 'apng');
assert.equal(apngToWebp.hasAnim, true, 'APNG input should create animated WebP');

// The budget check is the half of the work that is cheap enough to run on every
// change: a combination that cannot finish is refused before anyone spends the
// engine download and the CPU on it.
await evaluate(`window.__animationTest.upload(window.__animationTest.outputs.gif)`);
await waitFor(
  `document.querySelector('.file-item-name')?.textContent.includes(window.__animationTest.outputs.gif.name)`,
  'preflight upload'
);
await evaluate(`(() => {
  const converter = document.querySelector('[data-animation-converter]');
  converter.querySelector('input[name="animation-output"][value="apng"]').click();
  const preset = converter.querySelector('#animation-preset');
  preset.value = 'high'; preset.dispatchEvent(new Event('change', { bubbles: true }));
  const duration = converter.querySelector('#animation-duration');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(duration, '20'); duration.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await waitFor(
  `[...document.querySelectorAll('[data-animation-converter] .notice-card')].some((card) => card.textContent.includes('frames'))`,
  'over-budget notice'
);
const overBudget = await evaluate(`(() => {
  const converter = document.querySelector('[data-animation-converter]');
  return {
    createDisabled: [...converter.querySelectorAll('button')].find((item) => item.textContent.trim().startsWith('Create'))?.disabled,
    resetOffered: Boolean(converter.querySelector('.fine-tune-reset')),
    resetLabel: converter.querySelector('.fine-tune-reset')?.textContent.trim(),
    ffmpegRequests: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/generated/ffmpeg/')).length
  };
})()`);
assert.equal(overBudget.createDisabled, true, 'An over-budget combination cannot be started');
assert.equal(overBudget.resetOffered, true, 'A hand-edited preset offers a way back');
assert.equal(overBudget.resetLabel, 'Back to the APNG preset');
// The reset returns the hand-edited preset to the one the chip applies.
await evaluate(`document.querySelector('[data-animation-converter] .fine-tune-reset').click()`);
await waitFor(
  `!document.querySelector('[data-animation-converter] .fine-tune-reset')`,
  'fine-tune reset applied'
);
assert.equal(
  await evaluate(`document.querySelector('[data-animation-converter] #animation-preset').value`),
  'balanced'
);
// Shortening the clip is what brings this combination back inside the budget.
await evaluate(`(() => {
  const duration = document.querySelector('[data-animation-converter] #animation-duration');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call(duration, '1'); duration.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
await waitFor(
  `![...document.querySelectorAll('[data-animation-converter] .notice-card')].some((card) => card.textContent.includes('frames'))`,
  'over-budget notice cleared'
);
const afterFix = await evaluate(`(() => {
  const converter = document.querySelector('[data-animation-converter]');
  return {
    createDisabled: [...converter.querySelectorAll('button')].find((item) => item.textContent.trim().startsWith('Create'))?.disabled,
    ffmpegRequests: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/generated/ffmpeg/')).length
  };
})()`);
assert.equal(afterFix.createDisabled, false);
assert.equal(
  afterFix.ffmpegRequests,
  overBudget.ffmpegRequests,
  'Changing settings must not start any conversion work on its own'
);

const assetEntries = await evaluate(
  `performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/generated/ffmpeg/')).map((entry) => entry.name)`
);
assert.equal(
  assetEntries.some((entry) => entry.endsWith('manifest.json')),
  true
);
assert.equal(assetEntries.filter((entry) => entry.includes('.wasm.gzipdata')).length, 1);

// Each variant page arrives with its own output format. The chip row is the
// control that format now lands in, so the variant default has to survive into it.
const variantDefaults = [];
for (const [slug, format, label] of [
  ['video-to-webp', 'webp', 'Animated WebP'],
  ['video-to-apng', 'apng', 'APNG'],
]) {
  await send('Page.navigate', { url: `${baseUrl}/tools/video-to-gif/${slug}/` });
  await waitFor(
    `document.querySelector('[data-animation-converter] input[type="file"]') && !document.querySelector('astro-island[ssr]')`,
    `${slug} hydration`
  );
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 32;
    const context = canvas.getContext('2d');
    const stream = canvas.captureStream(8);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = []; recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.start(50);
    for (let frame = 0; frame < 4; frame += 1) {
      context.fillStyle = frame % 2 ? '#2563eb' : '#f59e0b'; context.fillRect(0, 0, 48, 32);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    await new Promise((resolve) => { recorder.onstop = resolve; recorder.stop(); });
    const transfer = new DataTransfer();
    transfer.items.add(new File(chunks, 'variant-test.webm', { type: 'video/webm' }));
    const input = document.querySelector('[data-animation-converter] input[type="file"]');
    input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(
    `document.querySelector('[data-animation-converter] input[name="animation-output"]:checked')`,
    `${slug} settings`
  );
  const state = await evaluate(`(() => {
    const converter = document.querySelector('[data-animation-converter]');
    return {
      slug: '${slug}',
      selectedChip: converter.querySelector('input[name="animation-output"]:checked')?.value,
      chipLabel: converter.querySelector('.tool-chip.is-selected .tool-chip-label')?.textContent.trim(),
      fineTuneFormat: converter.querySelector('#animation-output-format')?.value,
      createLabel: [...converter.querySelectorAll('button')].find((item) => item.textContent.trim().startsWith('Create'))?.textContent.trim(),
      qualityField: Boolean(converter.querySelector('#animation-quality'))
    };
  })()`);
  assert.equal(state.selectedChip, format, `${slug} should open on its own format`);
  assert.equal(state.chipLabel, label);
  assert.equal(state.fineTuneFormat, format);
  assert.equal(state.createLabel, `Create ${format.toUpperCase()}`);
  assert.equal(state.qualityField, format === 'webp');
  variantDefaults.push(state);
}

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();
console.log(
  JSON.stringify({
    status: 'ANIMATION_CONVERTER_BROWSER_OK',
    outputs: { gif, webp, apng, webpToGif, gifToApng, apngToWebp },
    mobileFormatGuide,
    chipRow,
    variantDefaults,
    progressMotionChecked,
    assetRequests: assetEntries.length,
    browserErrors: actionableBrowserErrors.length,
  })
);
