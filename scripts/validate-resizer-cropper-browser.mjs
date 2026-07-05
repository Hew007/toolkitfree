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

async function navigate(path) {
  await send('Page.navigate', { url: `${baseUrl}${path}` });
  await waitFor(
    `Boolean(document.querySelector('input[type="file"]')) && !document.querySelector('astro-island[ssr]')`,
    `${path} hydration`
  );
}

async function uploadGenerated({
  name = 'fixture.png',
  type = 'image/png',
  width = 400,
  height = 300,
  transparent = false,
}) {
  return evaluate(`
    (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = ${width};
      canvas.height = ${height};
      const context = canvas.getContext('2d');
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, 'rgba(18, 94, 180, ${transparent ? 0 : 1})');
      gradient.addColorStop(0.5, 'rgba(220, 80, 90, 0.7)');
      gradient.addColorStop(1, 'rgba(250, 210, 40, 1)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#123456';
      context.fillRect(canvas.width * 0.2, canvas.height * 0.2, canvas.width * 0.4, canvas.height * 0.4);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, '${type}', 0.9));
      const file = new File([blob], '${name}', { type: '${type}' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector('input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { size: file.size, type: file.type };
    })()
  `);
}

async function inspectResult(selector) {
  return evaluate(`
    (async () => {
      const item = document.querySelector('${selector}');
      const image = item.querySelector('img');
      const blob = await fetch(image.src).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const result = {
        declaredWidth: Number(item.dataset.width),
        declaredHeight: Number(item.dataset.height),
        width: bitmap.width,
        height: bitmap.height,
        size: blob.size,
        type: blob.type,
      };
      bitmap.close();
      return result;
    })()
  `);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
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

const resizerVariants = [
  ['resize-for-instagram', 'instagram_post', 1080, 1080],
  ['resize-for-facebook', 'facebook_cover', 820, 312],
  ['resize-for-twitter', 'twitter_header', 1500, 500],
  ['resize-for-youtube', 'youtube_thumbnail', 1280, 720],
  ['resize-for-linkedin', 'linkedin_post', 1200, 627],
  ['resize-for-tiktok', 'tiktok_cover', 1080, 1920],
  ['resize-to-1920x1080', 'full_hd', 1920, 1080],
];
const resizerResults = [];

for (const [slug, preset, width, height] of resizerVariants) {
  await navigate(`/tools/image-resizer/${slug}`);
  await uploadGenerated({ name: `${slug}.png`, width: 400, height: 300 });
  await waitFor(
    `Boolean(document.querySelector('[data-testid="resize-preset"]'))`,
    `${slug} controls`
  );

  const controls = await evaluate(`({
    preset: document.querySelector('[data-testid="resize-preset"]').value,
    width: Number(document.querySelector('[data-testid="resize-width"]').value),
    height: Number(document.querySelector('[data-testid="resize-height"]').value),
    maintainRatio: document.querySelector('[data-testid="resize-maintain-ratio"]').checked,
    ratioDisabled: document.querySelector('[data-testid="resize-maintain-ratio"]').disabled,
  })`);
  assert.deepEqual(controls, {
    preset,
    width,
    height,
    maintainRatio: false,
    ratioDisabled: true,
  });

  await evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Resize 1 image')
      .click()
  `);
  await waitFor(`Boolean(document.querySelector('[data-resize-result]'))`, `${slug} result`);
  const result = await inspectResult('[data-resize-result]');
  assert.equal(result.width, width, `${slug} bitmap width`);
  assert.equal(result.height, height, `${slug} bitmap height`);
  assert.equal(result.declaredWidth, width, `${slug} declared width`);
  assert.equal(result.declaredHeight, height, `${slug} declared height`);
  resizerResults.push({ slug, width: result.width, height: result.height });
}

await navigate('/tools/image-resizer');
await uploadGenerated({ name: 'landscape.png', width: 400, height: 300, transparent: true });
await waitFor(
  `Boolean(document.querySelector('[data-testid="resize-width"]'))`,
  'custom resizer controls'
);
assert.deepEqual(
  await evaluate(`({
    preset: document.querySelector('[data-testid="resize-preset"]').value,
    width: Number(document.querySelector('[data-testid="resize-width"]').value),
    height: Number(document.querySelector('[data-testid="resize-height"]').value),
    maintainRatio: document.querySelector('[data-testid="resize-maintain-ratio"]').checked,
  })`),
  { preset: 'custom', width: 800, height: 600, maintainRatio: true }
);
await evaluate(`
  const format = document.querySelector('[data-testid="resize-format"]');
  format.value = 'image/webp';
  format.dispatchEvent(new Event('change', { bubbles: true }));
  const quality = document.querySelector('[data-testid="resize-quality"]');
  quality.value = '75';
  quality.dispatchEvent(new Event('change', { bubbles: true }));
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Resize 1 image')
    .click();
`);
await waitFor(`Boolean(document.querySelector('[data-resize-result]'))`, 'custom WebP result');
const customContain = await inspectResult('[data-resize-result]');
assert.deepEqual(
  { width: customContain.width, height: customContain.height, type: customContain.type },
  { width: 800, height: 600, type: 'image/webp' }
);

await evaluate(`
  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const width = document.querySelector('[data-testid="resize-width"]');
  setInputValue.call(width, '1920');
  width.dispatchEvent(new Event('input', { bubbles: true }));
  const height = document.querySelector('[data-testid="resize-height"]');
  setInputValue.call(height, '1080');
  height.dispatchEvent(new Event('input', { bubbles: true }));
`);
await waitFor(
  `document.querySelector('[data-testid="resize-width"]').value === '1920' && document.querySelector('[data-testid="resize-height"]').value === '1080'`,
  'custom resize bounds'
);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Resize 1 image')
    .click()
`);
await waitFor(`Boolean(document.querySelector('[data-resize-result]'))`, 'custom contained result');
const boundedResult = await inspectResult('[data-resize-result]');
assert.deepEqual(
  { width: boundedResult.width, height: boundedResult.height },
  { width: 1440, height: 1080 }
);

await evaluate(`
  const ratio = document.querySelector('[data-testid="resize-maintain-ratio"]');
  ratio.click();
`);
await waitFor(
  `document.querySelector('[data-testid="resize-maintain-ratio"]').checked === false`,
  'custom exact mode'
);
await evaluate(`
  [...document.querySelectorAll('button')]
    .find((button) => button.textContent.trim() === 'Resize 1 image')
    .click()
`);
await waitFor(
  `document.querySelector('[data-resize-result]')?.dataset.width === '1920'`,
  'custom exact result'
);
const exactResult = await inspectResult('[data-resize-result]');
assert.deepEqual(
  { width: exactResult.width, height: exactResult.height },
  { width: 1920, height: 1080 }
);
const resizerUrlStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(resizerUrlStats.active, 1);
assert.equal(resizerUrlStats.created - resizerUrlStats.revoked, 1);

const cropperVariants = [
  ['crop-to-square', 'square', 1],
  ['crop-to-16-9', 'widescreen', 16 / 9],
  ['crop-to-4-3', 'standard', 4 / 3],
  ['crop-to-3-2', 'photo', 3 / 2],
  ['free-crop', 'free', null],
];
const cropperResults = [];

for (const [slug, preset, ratio] of cropperVariants) {
  await navigate(`/tools/image-cropper/${slug}`);
  await uploadGenerated({ name: `${slug}.png`, width: 1200, height: 800, transparent: true });
  await waitFor(`Boolean(document.querySelector('[data-testid="crop-box"]'))`, `${slug} crop box`);
  assert.equal(
    await evaluate(`document.querySelector('[data-crop-aspect]').dataset.cropAspect`),
    preset
  );
  const initialRect = await evaluate(`(() => {
    const box = document.querySelector('[data-testid="crop-box"]');
    return {
      x: Number(box.dataset.cropX),
      y: Number(box.dataset.cropY),
      width: Number(box.dataset.cropWidth),
      height: Number(box.dataset.cropHeight),
    };
  })()`);
  assert.equal(initialRect.x >= 0 && initialRect.y >= 0, true);
  assert.equal(initialRect.x + initialRect.width <= 1200.0001, true);
  assert.equal(initialRect.y + initialRect.height <= 800.0001, true);
  if (ratio !== null) {
    assert.equal(Math.abs(initialRect.width / initialRect.height - ratio) < 1e-8, true);
  }

  if (slug === 'crop-to-square') {
    await evaluate(`
      const format = document.querySelector('[data-testid="crop-format"]');
      format.value = 'image/jpeg';
      format.dispatchEvent(new Event('change', { bubbles: true }));
    `);
  }
  await evaluate(`
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Crop Image')
      .click()
  `);
  await waitFor(`Boolean(document.querySelector('[data-crop-result]'))`, `${slug} crop result`);
  const result = await inspectResult('[data-crop-result]');
  assert.equal(result.width, result.declaredWidth);
  assert.equal(result.height, result.declaredHeight);
  if (ratio !== null) {
    assert.equal(Math.abs(result.width / result.height - ratio) < 0.002, true);
  }
  assert.equal(result.type, slug === 'crop-to-square' ? 'image/jpeg' : 'image/png');
  cropperResults.push({ slug, width: result.width, height: result.height });
}

await navigate('/tools/image-cropper/crop-to-16-9');
await uploadGenerated({ name: 'drag.png', width: 1200, height: 800 });
await waitFor(`Boolean(document.querySelector('[data-crop-handle="se"]'))`, 'desktop crop handles');
const keyboardStart = await evaluate(`(() => {
  const box = document.querySelector('[data-testid="crop-box"]');
  return { y: Number(box.dataset.cropY), width: Number(box.dataset.cropWidth) };
})()`);
await evaluate(`
  (() => {
    const box = document.querySelector('[data-testid="crop-box"]');
    box.focus();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }));
  })()
`);
await waitFor(
  `Number(document.querySelector('[data-testid="crop-box"]').dataset.cropY) > ${keyboardStart.y} && Number(document.querySelector('[data-testid="crop-box"]').dataset.cropWidth) < ${keyboardStart.width}`,
  'keyboard move and resize'
);
const keyboardRect = await evaluate(`(() => {
  const box = document.querySelector('[data-testid="crop-box"]');
  return {
    y: Number(box.dataset.cropY),
    width: Number(box.dataset.cropWidth),
    active: document.activeElement === box,
    description: box.getAttribute('aria-describedby'),
  };
})()`);
assert.equal(keyboardRect.active, true);
assert.equal(keyboardRect.description, 'crop-keyboard-instructions');

const beforeDrag = keyboardRect.width;
await evaluate(`
  (() => {
    const handle = document.querySelector('[data-crop-handle="se"]');
    const rect = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 11, pointerType: 'mouse',
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 11, pointerType: 'mouse',
      clientX: rect.left - 120, clientY: rect.top - 80,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: 11, pointerType: 'mouse',
      clientX: rect.left - 120, clientY: rect.top - 80,
    }));
  })()
`);
await waitFor(
  `Number(document.querySelector('[data-testid="crop-box"]').dataset.cropWidth) < ${beforeDrag}`,
  'mouse corner resize'
);
const afterMouseDrag = await evaluate(
  `Number(document.querySelector('[data-testid="crop-box"]').dataset.cropWidth)`
);

await evaluate(`
  (() => {
    const handle = document.querySelector('[data-crop-handle="e"]');
    const rect = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 22, pointerType: 'touch',
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 22, pointerType: 'touch',
      clientX: rect.left + 10000, clientY: rect.top,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: 22, pointerType: 'touch',
      clientX: rect.left + 10000, clientY: rect.top,
    }));
  })()
`);
await waitFor(
  `Number(document.querySelector('[data-testid="crop-box"]').dataset.cropWidth) > ${afterMouseDrag}`,
  'touch edge resize'
);
const draggedRect = await evaluate(`(() => {
  const box = document.querySelector('[data-testid="crop-box"]');
  return {
    x: Number(box.dataset.cropX),
    y: Number(box.dataset.cropY),
    width: Number(box.dataset.cropWidth),
    height: Number(box.dataset.cropHeight),
  };
})()`);
assert.equal(draggedRect.x >= -1e-8 && draggedRect.y >= -1e-8, true);
assert.equal(draggedRect.x + draggedRect.width <= 1200.0001, true);
assert.equal(draggedRect.y + draggedRect.height <= 800.0001, true);
assert.equal(Math.abs(draggedRect.width / draggedRect.height - 16 / 9) < 1e-8, true);

await send('Emulation.setDeviceMetricsOverride', {
  width: 375,
  height: 812,
  deviceScaleFactor: 2,
  mobile: true,
});
await navigate('/tools/image-cropper/crop-to-square');
await uploadGenerated({ name: 'portrait.png', width: 600, height: 1000, transparent: true });
await waitFor(`Boolean(document.querySelector('[data-crop-handle="nw"]'))`, 'mobile crop handles');
assert.equal(
  await evaluate(`(() => {
    const cropper = document.querySelector('[data-crop-aspect]');
    return cropper.scrollWidth <= cropper.clientWidth + 1;
  })()`),
  true,
  'Cropper controls must not overflow their own mobile container'
);
await evaluate(`
  (() => {
    const handle = document.querySelector('[data-crop-handle="nw"]');
    const rect = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 33, pointerType: 'touch',
      clientX: rect.left + 2, clientY: rect.top + 2,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, pointerId: 33, pointerType: 'touch',
      clientX: rect.left + 45, clientY: rect.top + 45,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, pointerId: 33, pointerType: 'touch',
      clientX: rect.left + 45, clientY: rect.top + 45,
    }));
  })()
`);
await waitFor(
  `Number(document.querySelector('[data-testid="crop-box"]').dataset.cropWidth) < 600`,
  'mobile touch corner resize'
);
const mobileRect = await evaluate(`(() => {
  const box = document.querySelector('[data-testid="crop-box"]');
  return {
    x: Number(box.dataset.cropX),
    y: Number(box.dataset.cropY),
    width: Number(box.dataset.cropWidth),
    height: Number(box.dataset.cropHeight),
  };
})()`);
assert.equal(Math.abs(mobileRect.width / mobileRect.height - 1) < 1e-8, true);
assert.equal(mobileRect.x >= 0 && mobileRect.y >= 0, true);
assert.equal(mobileRect.x + mobileRect.width <= 600.0001, true);
assert.equal(mobileRect.y + mobileRect.height <= 1000.0001, true);
await send('Emulation.clearDeviceMetricsOverride');

const cropperUrlStats = await evaluate(`window.__objectUrlStats()`);
assert.equal(cropperUrlStats.active, 1);
const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);

await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'RESIZER_CROPPER_BROWSER_OK',
    resizerVariants: resizerResults,
    customContain: { width: boundedResult.width, height: boundedResult.height },
    customExact: { width: exactResult.width, height: exactResult.height },
    cropperVariants: cropperResults,
    keyboardRect,
    draggedRect,
    mobileRect,
    resizerUrlStats,
    cropperUrlStats,
    browserErrors: actionableBrowserErrors.length,
  })
);
