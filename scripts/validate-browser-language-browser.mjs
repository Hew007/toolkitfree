import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openBrowserSession } from './browser-session.mjs';
const session = await openBrowserSession();
const { send, evaluate, navigate } = session;
let script;
let checks = 0;
let configuration = 0;
async function configure(languages, { stored, blocked = false, reset = true } = {}) {
  if (reset) await navigate(`/about/?language-test=${++configuration}`);
  if (script) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script });
  const result = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    Object.defineProperty(navigator,'languages',{get:()=>${JSON.stringify(languages)}});
    Object.defineProperty(navigator,'language',{get:()=>${JSON.stringify(languages[0] || '')}});
    ${reset ? `localStorage.clear(); sessionStorage.clear(); ${stored ? `localStorage.setItem('toolkitfree-language',${JSON.stringify(stored)});` : ''}` : ''}
    ${blocked ? `Object.defineProperty(window,'localStorage',{get(){throw Error('disabled')}}); Object.defineProperty(window,'sessionStorage',{get(){throw Error('disabled')}});` : ''}
  `,
  });
  script = result.identifier;
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const languages of [
    ['zh-CN'],
    ['zh-TW'],
    ['zh-HK'],
    ['zh-Hant'],
    ['en'],
    ['fr'],
    ['en', 'zh'],
  ]) {
    console.log(JSON.stringify({ case: languages }));
    await configure(languages);
    await navigate('/?campaign=test#tools');
    assert.equal(await evaluate('location.pathname'), languages[0].startsWith('zh') ? '/zh/' : '/');
    assert.equal(await evaluate('location.search+location.hash'), '?campaign=test#tools');
    checks++;
  }
  await configure(['zh-CN'], { stored: 'en' });
  await navigate('/');
  assert.equal(await evaluate('location.pathname'), '/');
  checks++;
  await configure(['en'], { stored: 'zh' });
  await navigate('/');
  assert.equal(await evaluate('location.pathname'), '/zh/');
  checks++;
  await configure(['zh-CN']);
  await navigate('/tools/image-converter/');
  assert.equal(await evaluate('location.pathname'), '/tools/image-converter/');
  checks++;
  await configure(['en']);
  await navigate('/zh/');
  assert.equal(await evaluate('location.pathname'), '/zh/');
  checks++;
  await configure(['zh-CN'], { blocked: true });
  await navigate('/');
  assert.equal(await evaluate('location.pathname'), '/zh/');
  checks++;
  await configure(['zh-CN'], { reset: false, blocked: true });
  await evaluate(`document.querySelector('.language-switch').click()`);
  await session.waitFor(
    `location.pathname==='/' && document.readyState==='complete'`,
    'storage-disabled manual English'
  );
  checks++;
  await configure(['zh-CN']);
  await navigate('/zh/');
  await configure(['zh-CN'], { reset: false });
  await evaluate(`document.querySelector('.language-switch').click()`);
  await session.waitFor(
    `location.pathname==='/' && document.readyState==='complete'`,
    'manual English'
  );
  assert.equal(await evaluate(`localStorage.getItem('toolkitfree-language')`), 'en');
  await navigate('/?return=english');
  assert.equal(await evaluate('location.pathname'), '/');
  checks++;
  await configure(['en'], { reset: false });
  await evaluate(`document.querySelector('.language-switch').click()`);
  await session.waitFor(
    `location.pathname==='/zh/' && document.readyState==='complete'`,
    'manual Chinese'
  );
  assert.equal(await evaluate(`localStorage.getItem('toolkitfree-language')`), 'zh');
  await navigate('/');
  assert.equal(await evaluate('location.pathname'), '/zh/');
  checks++;
  const staticHome = fs.readFileSync('dist/index.html', 'utf8');
  assert.match(staticHome, /<html\b[^>]*lang="en"/);
  assert.match(staticHome, /<h1\b[^>]*>[\s\S]*?<\/h1>/);
  assert.match(staticHome, /href="\/zh\/"/);
  checks++;
  assert.deepEqual(session.actionableErrors(), []);
} catch (error) {
  console.error(
    await evaluate(
      `JSON.stringify({url:location.href,ready:document.readyState,islands:[...document.querySelectorAll('astro-island')].map(e=>({ssr:e.hasAttribute('ssr'),client:e.getAttribute('client')}))})`
    )
  );
  console.error(JSON.stringify(session.actionableErrors()));
  throw error;
} finally {
  await session.close();
}
console.log(JSON.stringify({ status: 'BROWSER_LANGUAGE_BROWSER_OK', checks }));
