import assert from 'node:assert/strict';
import vm from 'node:vm';
import { installBrowserLanguage } from '../src/i18n/browser-language.ts';

let checks = 0;
function run({
  languages = [],
  language = '',
  stored,
  session,
  pathname = '/',
  referrer = '',
  blocked = false,
} = {}) {
  const replaced = [];
  const values = { localStorage: stored, sessionStorage: session };
  const window = Object.fromEntries(
    Object.keys(values).map((name) => [
      name,
      {
        getItem: () => {
          if (blocked) throw new Error('disabled');
          return values[name];
        },
        setItem: (_, value) => {
          if (blocked) throw new Error('disabled');
          values[name] = value;
        },
      },
    ])
  );
  const context = {
    window,
    document: { referrer, addEventListener() {} },
    navigator: { languages, language },
    URL,
    location: {
      pathname,
      origin: 'https://toolkitfree.net',
      search: '?a=1',
      hash: '#tools',
      replace: (value) => replaced.push(value),
    },
  };
  vm.runInNewContext(`(${installBrowserLanguage.toString()})()`, context);
  checks++;
  return replaced;
}
for (const language of ['zh', 'zh-CN', 'zh-TW', 'zh-HK', 'zh-Hant'])
  assert.deepEqual(run({ languages: [language] }), ['/zh/?a=1#tools']);
for (const language of ['en', 'fr', 'ja', ''])
  assert.deepEqual(run({ languages: [language, 'zh'] }), []);
assert.deepEqual(run({ language: 'zh-CN' }), ['/zh/?a=1#tools']);
assert.deepEqual(run({ languages: ['zh'], stored: 'en' }), []);
assert.deepEqual(run({ languages: ['en'], stored: 'zh' }), ['/zh/?a=1#tools']);
assert.deepEqual(run({ languages: ['zh'], session: 'en' }), []);
assert.deepEqual(run({ languages: ['zh'], pathname: '/tools/image-converter/' }), []);
assert.deepEqual(run({ languages: ['en'], pathname: '/zh/' }), []);
assert.deepEqual(run({ languages: ['zh'], blocked: true }), ['/zh/?a=1#tools']);
assert.deepEqual(
  run({ languages: ['zh'], blocked: true, referrer: 'https://toolkitfree.net/zh/' }),
  []
);
console.log(JSON.stringify({ status: 'BROWSER_LANGUAGE_UNIT_OK', checks }));
