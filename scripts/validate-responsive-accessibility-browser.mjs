import assert from 'node:assert/strict';
import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

const endpoint = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9228';
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
const routes = [
  '/',
  '/about',
  '/contact',
  '/privacy-policy',
  '/guides/image-format-comparison',
  '/tools/image-converter',
  '/tools/image-compressor',
  '/tools/image-resizer',
  '/tools/image-cropper',
  '/tools/image-to-pdf',
  '/tools/favicon-generator',
  '/tools/background-remover',
  '/tools/qr-generator',
];
const widths = [320, 375, 768, 1024, 1440];

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

async function waitFor(expression, label, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(route) {
  await send('Page.navigate', { url: `${baseUrl}${route}` });
  await waitFor(
    `document.readyState === 'complete' && !document.querySelector('astro-island[ssr]')`,
    `${route} hydration`
  );
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('DOM.enable');

const results = [];
for (const width of widths) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });

  for (const route of routes) {
    await navigate(route);
    const audit = await evaluate(`(() => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          rect.width > 0 && rect.height > 0;
      };
      const hasLabel = (element) => {
        if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')) return true;
        if (element.id && document.querySelector('label[for="' + element.id + '"]')) return true;
        return Boolean(element.closest('label'));
      };
      const unnamed = [...document.querySelectorAll('button,input,select,textarea')]
        .filter(visible)
        .filter((element) => element.tagName === 'BUTTON'
          ? !(element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.trim())
          : !hasLabel(element))
        .map((element) => ({
          tag: element.tagName,
          id: element.id,
          type: element.getAttribute('type'),
        }));
      return {
        innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        visibleAds: [...document.querySelectorAll('.ad-placeholder')].filter(visible).length,
        unnamed,
        h1Count: document.querySelectorAll('h1').length,
        hasMain: Boolean(document.querySelector('main#main-content')),
        hasSkipLink: Boolean(document.querySelector('a.skip-link[href="#main-content"]')),
      };
    })()`);
    results.push({ width, route, ...audit });
  }
}

const failures = results.filter(
  (result) =>
    result.documentWidth > result.innerWidth ||
    result.visibleAds !== 0 ||
    result.unnamed.length > 0 ||
    result.h1Count !== 1 ||
    !result.hasMain ||
    !result.hasSkipLink
);
assert.deepEqual(failures, []);

await send('Emulation.setDeviceMetricsOverride', {
  width: 375,
  height: 812,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigate('/tools/image-converter');
const navigation = await evaluate(`(() => {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const nav = document.querySelector('.site-nav');
  toggle.focus();
  const hasFocusVisibleRule = [...document.styleSheets].some((sheet) =>
    [...sheet.cssRules].some((rule) => rule.selectorText?.includes(':focus-visible'))
  );
  toggle.click();
  const focusedOnSummary = document.activeElement?.tagName === 'SUMMARY';
  document.querySelector('.nav-menu-group summary').click();
  const groupOpened = document.querySelector('.nav-menu-group').open;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const escapeClosed = toggle.getAttribute('aria-expanded') === 'false' &&
    getComputedStyle(nav).display === 'none' &&
    document.activeElement === toggle;
  toggle.click();
  document.querySelector('main h1').click();
  const outsideClosed = toggle.getAttribute('aria-expanded') === 'false' &&
    getComputedStyle(nav).display === 'none';
  return { hasFocusVisibleRule, focusedOnSummary, groupOpened, escapeClosed, outsideClosed };
})()`);
assert.equal(navigation.hasFocusVisibleRule, true);
assert.equal(navigation.focusedOnSummary, true);
assert.equal(navigation.groupOpened, true);
assert.equal(navigation.escapeClosed, true);
assert.equal(navigation.outsideClosed, true);

await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await navigate('/tools/qr-generator');
assert.deepEqual(
  await evaluate(`(() => ({
    toggle: getComputedStyle(document.querySelector('.mobile-nav-toggle')).display,
    nav: getComputedStyle(document.querySelector('.site-nav')).display,
    groups: document.querySelectorAll('.nav-menu-group').length,
    active: document.querySelector('.site-nav [aria-current="page"]')?.getAttribute('href'),
  }))()`),
  {
    toggle: 'none',
    nav: 'flex',
    groups: 2,
    active: '/tools/qr-generator',
  }
);

const desktopEscape = await evaluate(`(() => {
  const group = document.querySelector('.nav-menu-group');
  const summary = group.querySelector('summary');
  summary.click();
  const opened = group.open;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { opened, closed: !group.open, focusReturned: document.activeElement === summary };
})()`);
assert.deepEqual(desktopEscape, { opened: true, closed: true, focusReturned: true });

const actionableBrowserErrors = filterActionableBrowserErrors(browserErrors);
assert.deepEqual(actionableBrowserErrors, []);
await send('Target.closeTarget', { targetId: target.id });
socket.close();

console.log(
  JSON.stringify({
    status: 'RESPONSIVE_ACCESSIBILITY_BROWSER_OK',
    checks: results.length,
    routes: routes.length,
    widths,
    navigation,
    desktopEscape,
    browserErrors: actionableBrowserErrors.length,
  })
);
