import assert from 'node:assert/strict';
import { openBrowserSession } from './browser-session.mjs';

// Exercise transport lifecycle failures without starting a browser or server.
// Synchronous replies also verify that requests are registered before writing.
const native = {
  fetch: globalThis.fetch,
  WebSocket: globalThis.WebSocket,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};
const timers = new Set();
globalThis.setTimeout = (callback, delay, ...args) => {
  const timer = native.setTimeout(() => {
    timers.delete(timer);
    callback(...args);
  }, delay);
  timers.add(timer);
  return timer;
};
globalThis.clearTimeout = (timer) => {
  timers.delete(timer);
  native.clearTimeout(timer);
};

class TestSocket extends EventTarget {
  static OPEN = 1;
  static next = {};
  static latest;
  readyState = 0;

  constructor() {
    super();
    this.options = TestSocket.next;
    TestSocket.next = {};
    TestSocket.latest = this;
    queueMicrotask(() => {
      if (this.readyState !== 0) return;
      if (this.options.open === false) return;
      if (this.options.open === 'error') return this.fail('startup refused');
      if (this.options.open === 'close') return this.disconnect(1006, 'startup stopped');
      this.readyState = TestSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    });
  }

  send(text) {
    if (this.readyState !== TestSocket.OPEN) throw new Error('socket is not open');
    const message = JSON.parse(text);
    if (this.options.send) this.options.send(message, this);
    else
      this.reply(
        message.id,
        message.method === 'Runtime.evaluate' ? { result: { value: 42 } } : {}
      );
  }

  reply(id, result) {
    this.dispatchEvent(
      Object.assign(new Event('message'), { data: JSON.stringify({ id, result }) })
    );
  }

  fail(message) {
    this.dispatchEvent(Object.assign(new Event('error'), { error: new Error(message) }));
  }

  disconnect(code = 1000, reason = 'test disconnect') {
    this.readyState = 3;
    this.dispatchEvent(Object.assign(new Event('close'), { code, reason }));
  }

  close() {
    if (this.readyState !== 3) this.disconnect();
  }
}

globalThis.WebSocket = TestSocket;
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ id: 'test-target', webSocketDebuggerUrl: 'ws://test.local/target' }),
});

const results = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deadline = native.setTimeout(() => {
  throw new Error('Browser-session validation stalled');
}, 5_000);
async function check(name, run) {
  await run();
  assert.equal(timers.size, 0, `${name} must not leave connection/request timers behind`);
  results.push(name);
}
const closeReply = (message, socket) => {
  if (message.method === 'Target.closeTarget') socket.reply(message.id, {});
};

try {
  await check('response correlation and synchronous response', async () => {
    const session = await openBrowserSession();
    assert.equal(await session.evaluate('any expression'), 42);
    await session.close();
    await session.close();
  });

  await check('protocol failure includes the method', async () => {
    TestSocket.next = {
      send(message, socket) {
        if (message.method === 'Target.closeTarget') return closeReply(message, socket);
        socket.dispatchEvent(
          Object.assign(new Event('message'), {
            data: JSON.stringify({ id: message.id, error: { message: 'unknown method' } }),
          })
        );
      },
    };
    const session = await openBrowserSession();
    await assert.rejects(session.send('Invalid.method'), /Invalid\.method: unknown method/);
    await session.close();
  });

  await check('uncaught browser exceptions retain their message and stack', async () => {
    const session = await openBrowserSession();
    const description = 'TypeError: file.name is undefined\n    at logoReader (acceptance.js:12:5)';
    TestSocket.latest.dispatchEvent(
      Object.assign(new Event('message'), {
        data: JSON.stringify({
          method: 'Runtime.exceptionThrown',
          params: { exceptionDetails: { text: 'Uncaught', exception: { description } } },
        }),
      })
    );
    assert.deepEqual(session.browserErrors, [description]);
    assert.deepEqual(
      session.actionableErrors(),
      [description],
      'diagnostics must not filter product exceptions'
    );
    await session.close();
  });

  await check('primitive exceptions and missing descriptions remain readable', async () => {
    const session = await openBrowserSession();
    const cases = [
      [{ type: 'boolean', value: false }, 'false'],
      [{ type: 'number', value: 0 }, '0'],
      [{ type: 'object', subtype: 'null', value: null }, 'null'],
      [{ type: 'string', value: '' }, '""'],
      [{ type: 'undefined' }, 'undefined'],
      [{ type: 'number', unserializableValue: 'NaN' }, 'NaN'],
      [undefined, 'Uncaught fallback'],
    ];
    for (const [exception] of cases) {
      TestSocket.latest.dispatchEvent(
        Object.assign(new Event('message'), {
          data: JSON.stringify({
            method: 'Runtime.exceptionThrown',
            params: { exceptionDetails: { text: 'Uncaught fallback', exception } },
          }),
        })
      );
    }
    assert.deepEqual(
      session.browserErrors,
      cases.map(([, expected]) => expected)
    );
    assert.deepEqual(session.actionableErrors(), session.browserErrors);
    await session.close();
  });

  await check('evaluate exceptions use the same primitive diagnostics', async () => {
    TestSocket.next = {
      send(message, socket) {
        if (message.method === 'Target.closeTarget') return closeReply(message, socket);
        socket.reply(message.id, {
          exceptionDetails: { text: 'Uncaught', exception: { type: 'boolean', value: false } },
        });
      },
    };
    const session = await openBrowserSession();
    await assert.rejects(session.evaluate('throw false'), { message: 'false' });
    await session.close();
  });

  await check('disconnect rejects every pending request and future sends', async () => {
    TestSocket.next = { send: closeReply };
    const session = await openBrowserSession();
    const first = assert.rejects(
      session.send('Page.enable'),
      /Page\.enable: CDP connection closed.*1006.*renderer stopped/
    );
    const second = assert.rejects(
      session.send('Runtime.evaluate'),
      /Runtime\.evaluate: CDP connection closed/
    );
    TestSocket.latest.disconnect(1006, 'renderer stopped');
    await Promise.all([first, second]);
    await assert.rejects(session.send('DOM.enable'), /DOM\.enable: CDP connection closed/);
    await session.close();
  });

  await check('socket errors reject pending requests', async () => {
    TestSocket.next = { send: closeReply };
    const session = await openBrowserSession();
    const rejected = assert.rejects(
      session.send('Page.enable'),
      /Page\.enable: CDP socket error: transport lost/
    );
    TestSocket.latest.fail('transport lost');
    await rejected;
    await session.close();
  });

  await check('missing response has a configurable deadline', async () => {
    TestSocket.next = { send: closeReply };
    const session = await openBrowserSession({ commandTimeoutMs: 25 });
    await assert.rejects(
      session.send('Page.enable'),
      /Page\.enable: Timed out waiting for CDP response after 25ms/
    );
    await assert.rejects(session.send('DOM.enable', {}, { timeoutMs: 10 }), /after 10ms/);
    await session.close();
  });

  await check('waitFor bounds an unresponsive evaluate by its remaining budget', async () => {
    TestSocket.next = { send: closeReply };
    const session = await openBrowserSession({ commandTimeoutMs: 1000 });
    await assert.rejects(session.waitFor('true', 'stalled poll', 25), (error) => {
      assert.match(error.message, /Runtime\.evaluate: Timed out/);
      const budget = Number(error.message.match(/after (\d+)ms/)?.[1]);
      assert.ok(budget > 0 && budget <= 25, 'the polling budget must bound each protocol request');
      return true;
    });
    await session.close();
  });

  await check('long direct evaluate has a separate budget from polling', async () => {
    TestSocket.next = {
      send(message, socket) {
        if (message.method === 'Target.closeTarget') return closeReply(message, socket);
        setTimeout(() => socket.reply(message.id, { result: { value: 'finished' } }), 60);
      },
    };
    const session = await openBrowserSession({ waitTimeoutMs: 10 });
    assert.equal(await session.evaluate('slow browser promise'), 'finished');
    await session.close();
  });

  await check('late responses do not resurrect expired requests', async () => {
    TestSocket.next = {
      send(message, socket) {
        if (message.method === 'Target.closeTarget') return closeReply(message, socket);
        setTimeout(() => socket.reply(message.id, {}), 25);
      },
    };
    const session = await openBrowserSession({ commandTimeoutMs: 10 });
    await assert.rejects(session.send('Page.enable'), /Timed out/);
    await pause(30);
    await session.close();
  });

  await check('synchronous write failure clears its deadline', async () => {
    TestSocket.next = {
      send(message, socket) {
        if (message.method === 'Target.closeTarget') return closeReply(message, socket);
        throw new Error('write failed');
      },
    };
    const session = await openBrowserSession();
    await assert.rejects(session.send('Page.enable'), /Page\.enable: write failed/);
    await session.close();
  });

  await check('caller close rejects outstanding work', async () => {
    TestSocket.next = { send: closeReply };
    const session = await openBrowserSession();
    const rejected = assert.rejects(session.send('Runtime.evaluate'), /session closed by caller/);
    await session.close();
    await rejected;
  });

  await check('unresponsive target close is bounded and releases other work', async () => {
    TestSocket.next = { send() {} };
    const session = await openBrowserSession();
    const rejected = assert.rejects(session.send('Runtime.evaluate'), /session closed by caller/);
    await session.close();
    await rejected;
  });

  await check('malformed protocol data rejects pending work', async () => {
    TestSocket.next = { send: closeReply };
    const session = await openBrowserSession();
    const rejected = assert.rejects(
      session.send('Runtime.evaluate'),
      /Invalid JSON received from CDP/
    );
    TestSocket.latest.dispatchEvent(Object.assign(new Event('message'), { data: 'not JSON' }));
    await rejected;
    await session.close();
  });

  await check('connection error cleans up startup timer', async () => {
    TestSocket.next = { open: 'error' };
    await assert.rejects(openBrowserSession(), /CDP socket error: startup refused/);
    assert.equal(TestSocket.latest.readyState, 3);
  });

  await check('connection close before open rejects startup', async () => {
    TestSocket.next = { open: 'close' };
    await assert.rejects(openBrowserSession(), /CDP connection closed.*1006.*startup stopped/);
  });

  await check('connection without open has a deadline', async () => {
    TestSocket.next = { open: false };
    await assert.rejects(
      openBrowserSession({ connectTimeoutMs: 20 }),
      /Timed out connecting to CDP after 20ms/
    );
  });

  await check('target creation has a deadline and cleans up its timer', async () => {
    const normalFetch = globalThis.fetch;
    globalThis.fetch = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    try {
      await assert.rejects(
        openBrowserSession({ connectTimeoutMs: 20 }),
        /Timed out creating CDP target after 20ms/
      );
    } finally {
      globalThis.fetch = normalFetch;
    }
  });
} finally {
  native.clearTimeout(deadline);
  for (const timer of timers) native.clearTimeout(timer);
  Object.assign(globalThis, native);
}

console.log(
  JSON.stringify({ status: 'BROWSER_SESSION_LIFECYCLE_OK', checks: results.length, cases: results })
);
