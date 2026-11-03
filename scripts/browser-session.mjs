import { filterActionableBrowserErrors } from './browser-test-errors.mjs';

/**
 * One Chrome DevTools Protocol session for a browser suite.
 *
 * Every suite used to carry its own copy of this: target creation, the socket,
 * request routing, error capture, `evaluate`, `waitFor` and `navigate`. Thirteen
 * copies drifted into five versions of `evaluate` and eight of `navigate`, and the
 * same bug had to be found and fixed in each file separately — two suites set
 * files before React had hydrated the page, and one of them failed three runs in
 * eight because of it. The behavior that genuinely differs between suites (how
 * long to wait, how often to poll, what counts as an early failure) is passed in
 * as options rather than copied.
 */

const HYDRATED = `document.readyState === 'complete' && !document.querySelector('astro-island[ssr]')`;

function exceptionMessage(details) {
  const exception = details.exception;
  const value =
    exception && Object.hasOwn(exception, 'value')
      ? JSON.stringify(exception.value)
      : (exception?.unserializableValue ??
        (exception?.type === 'undefined' ? 'undefined' : undefined));
  return exception?.description || value || details.text || 'Unknown browser exception';
}

/**
 * @param {object} [options]
 * @param {string} [options.defaultEndpoint] DevTools endpoint when `CHROME_DEBUG_URL` is unset.
 * @param {number} [options.waitTimeoutMs] Default `waitFor` timeout.
 * @param {number} [options.pollMs] How often `waitFor` re-checks its condition.
 * @param {number} [options.connectTimeoutMs] Maximum target creation or socket connection time.
 * @param {number} [options.commandTimeoutMs] Maximum time for a protocol response. Long
 *   promise-valued evaluations need a larger budget than a normal polling interval.
 * @param {(label: string) => string | null} [options.failWhen] An expression that
 *   returns non-empty error text when the tool has visibly failed, so `waitFor`
 *   stops at the failure instead of running out the clock on it.
 * @param {(label: string) => string | null} [options.diagnoseTimeout] An expression
 *   whose value is appended to a timeout message.
 */
export async function openBrowserSession({
  defaultEndpoint = 'http://127.0.0.1:9222',
  waitTimeoutMs = 30_000,
  pollMs = 100,
  connectTimeoutMs = 30_000,
  commandTimeoutMs = Math.max(waitTimeoutMs, 300_000),
  failWhen,
  diagnoseTimeout,
} = {}) {
  const endpoint = process.env.CHROME_DEBUG_URL || defaultEndpoint;
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
  for (const [name, value] of Object.entries({ connectTimeoutMs, commandTimeoutMs })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  }

  const targetController = new AbortController();
  const targetTimer = setTimeout(() => {
    targetController.abort(new Error(`Timed out creating CDP target after ${connectTimeoutMs}ms`));
  }, connectTimeoutMs);
  let target;
  try {
    const response = await fetch(`${endpoint}/json/new?${encodeURIComponent('about:blank')}`, {
      method: 'PUT',
      signal: targetController.signal,
    });
    if (!response.ok) throw new Error(`Could not create Chrome target: ${response.status}`);
    target = await response.json();
  } finally {
    clearTimeout(targetTimer);
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  let connectionFailure;
  let closePromise;
  /** Uncaught page exceptions and console errors, in the order they happened. */
  const browserErrors = [];

  function rejectPending(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(`${request.method}: ${error.message}`));
    }
    pending.clear();
  }

  function connectionFailed(error) {
    connectionFailure ??= error;
    rejectPending(connectionFailure);
  }

  socket.addEventListener('close', (event) => {
    connectionFailed(
      new Error(
        `CDP connection closed (code ${event.code}${event.reason ? `: ${event.reason}` : ''})`
      )
    );
  });
  socket.addEventListener('error', (event) => {
    connectionFailed(
      new Error(`CDP socket error: ${event.error?.message || event.message || 'connection failed'}`)
    );
  });

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener('open', opened);
      socket.removeEventListener('error', failed);
      socket.removeEventListener('close', failed);
    };
    const opened = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      socket.close();
      reject(connectionFailure || new Error('CDP connection failed'));
    };
    const timer = setTimeout(() => {
      connectionFailed(new Error(`Timed out connecting to CDP after ${connectTimeoutMs}ms`));
      cleanup();
      socket.close();
      reject(connectionFailure);
    }, connectTimeoutMs);
    socket.addEventListener('open', opened, { once: true });
    socket.addEventListener('error', failed, { once: true });
    socket.addEventListener('close', failed, { once: true });
  });

  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      connectionFailed(new Error('Invalid JSON received from CDP'));
      socket.close();
      return;
    }
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      browserErrors.push(exceptionMessage(message.params.exceptionDetails));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      browserErrors.push(message.params.entry.text);
    }
    for (const handler of listeners.get(message.method) ?? []) handler(message.params);
  });

  function send(method, params = {}, { timeoutMs = commandTimeoutMs } = {}) {
    if (connectionFailure || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(
        new Error(`${method}: ${connectionFailure?.message || 'CDP connection is not open'}`)
      );
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return Promise.reject(new Error(`${method}: timeoutMs must be positive`));
    }
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      // Keep this timer referenced: a lost response must fail the script instead
      // of leaving a top-level await unsettled with no active handles (exit code 13).
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method}: Timed out waiting for CDP response after ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, { method, resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(new Error(`${method}: ${error.message}`));
      }
    });
  }

  /** Subscribe to a protocol event, such as `Network.requestWillBeSent`. */
  function on(method, handler) {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(handler);
  }

  async function evaluate(expression, { timeoutMs = commandTimeoutMs } = {}) {
    const response = await send(
      'Runtime.evaluate',
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
      { timeoutMs }
    );
    if (response.exceptionDetails) {
      // `description` carries the thrown error's own message and stack; `text`
      // alone is often just "Uncaught", which says nothing about what failed.
      throw new Error(exceptionMessage(response.exceptionDetails));
    }
    return response.result.value;
  }

  async function waitFor(expression, label, timeoutMs = waitTimeoutMs) {
    const started = Date.now();
    const deadline = started + timeoutMs;
    const failure = failWhen?.(label) ?? null;
    const inspect = (condition) =>
      evaluate(condition, {
        timeoutMs: Math.min(commandTimeoutMs, Math.max(1, deadline - Date.now())),
      });
    while (Date.now() - started < timeoutMs) {
      if (await inspect(`Boolean(${expression})`)) return;
      if (failure) {
        const text = await inspect(failure);
        if (text) throw new Error(`${label} failed: ${text}`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    const diagnosis = diagnoseTimeout?.(label) ?? null;
    if (diagnosis) {
      throw new Error(
        `Timed out waiting for ${label}: ${JSON.stringify(await evaluate(diagnosis, { timeoutMs: Math.min(commandTimeoutMs, 5_000) }))}`
      );
    }
    throw new Error(`Timed out waiting for ${label}`);
  }

  /**
   * Load a page and wait until it is ready to be driven: a new document, fully
   * loaded, with every island hydrated.
   *
   * The islands are server-rendered, so a file input exists before React has
   * hydrated it, and a file set then is lost. Two suites waited only for the
   * input and failed intermittently because of it; waiting for the `ssr` marker
   * to clear is what fixes that.
   *
   * The token on the outgoing document is a cheap guard, not a fix for an
   * observed failure. The page being left also has no `ssr` islands, so the
   * hydration check alone would pass on it if `Page.navigate` returned before the
   * new document took over. In Chrome it does not — 20 of 20 navigations had
   * already committed when it returned — but the protocol does not promise that,
   * and the suites also run on Edge.
   *
   * @param {string} routeOrUrl A path on the site, or a full URL.
   * @param {object} [options]
   * @param {string} [options.ready] An extra expression that must also hold, such
   *   as a particular control having rendered.
   * @param {string} [options.label] Used in the timeout message.
   */
  async function navigate(routeOrUrl, { ready, label } = {}) {
    const url = /^https?:\/\//.test(routeOrUrl) ? routeOrUrl : `${baseUrl}${routeOrUrl}`;
    const token = JSON.stringify(`${Date.now()}-${Math.random()}`);
    await evaluate(`window.__browserSessionPage = ${token}`);
    await send('Page.navigate', { url });
    await waitFor(
      `window.__browserSessionPage !== ${token} && ${HYDRATED}${ready ? ` && (${ready})` : ''}`,
      `${label ?? routeOrUrl} hydration`
    );
  }

  /** Choose files on a real `<input type="file">`, the way a visitor does. */
  async function setInputFiles(selector, files) {
    const documentNode = await send('DOM.getDocument');
    const inputNode = await send('DOM.querySelector', {
      nodeId: documentNode.root.nodeId,
      selector,
    });
    if (!inputNode.nodeId) throw new Error(`No element matches ${selector}`);
    await send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files });
  }

  /**
   * Count object URLs from page load on, exposed as `window.__objectUrlStats()`
   * returning `{ created, revoked, active }`. Call before the first `navigate`.
   */
  async function trackObjectUrls() {
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
  }

  /** Errors worth failing a suite for, with known third-party noise removed. */
  function actionableErrors() {
    return filterActionableBrowserErrors(browserErrors);
  }

  function close() {
    // The target may close its socket before acknowledging this command. Either
    // outcome is normal during teardown, and all pending timers must be cleared.
    closePromise ??= (async () => {
      try {
        if (!connectionFailure && socket.readyState === WebSocket.OPEN) {
          await send('Target.closeTarget', { targetId: target.id }, { timeoutMs: 1_000 });
        }
      } catch {
        /* Closing an already detached target is harmless. */
      } finally {
        connectionFailed(new Error('CDP session closed by caller'));
        socket.close();
      }
    })();
    return closePromise;
  }

  return {
    baseUrl,
    target,
    browserErrors,
    send,
    on,
    evaluate,
    waitFor,
    navigate,
    setInputFiles,
    trackObjectUrls,
    actionableErrors,
    close,
  };
}
