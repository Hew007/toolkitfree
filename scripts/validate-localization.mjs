import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getLocale, localizePath, stripLocale } from '../src/i18n/locale.ts';
import { localizeErrorMessage } from '../src/i18n/errors.ts';
import { toolRegistry } from '../src/data/tool-registry.ts';

const routes = [
  '/',
  '/about/',
  '/guides/',
  ...toolRegistry.flatMap((tool) => [
    tool.href,
    ...tool.variants.map((variant) => `${tool.href}/${variant.slug}`),
  ]),
];
for (const route of routes) {
  const chinese = localizePath(route, 'zh');
  assert.equal(getLocale(chinese), 'zh');
  assert.equal(localizePath(chinese, 'en'), route);
  assert.equal(localizePath(chinese, 'zh'), chinese);
  assert.equal(stripLocale(chinese), route);
}
assert.equal(getLocale('/zhang/'), 'en');
assert.equal(stripLocale('/zhang/'), '/zhang/');
for (const external of [
  'https://example.com/',
  '//example.com/path',
  'blob:test',
  '#result',
  'mailto:a@example.com',
]) {
  assert.equal(localizePath(external, 'zh'), external);
}
assert.equal(
  localizeErrorMessage('This file is empty. Choose a non-empty image.', 'zh'),
  '文件为空，请选择包含内容的图片。'
);
assert.equal(
  localizeErrorMessage('This file is empty. Choose a non-empty image.', 'en'),
  'This file is empty. Choose a non-empty image.'
);

// Transpile only the React locale boundary so SSR can be checked without a browser or build.
const source = fs.readFileSync(new URL('../src/i18n/react.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
});
const module = { exports: {} };
new Function('module', 'exports', 'require', outputText)(
  module,
  module.exports,
  createRequire(import.meta.url)
);
const { useI18n, withLocale } = module.exports;
function Label({ filename }) {
  const { t } = useI18n();
  return createElement('p', null, t('Download', '下载'), ': ', filename);
}
const Tool = withLocale(Label);
const filename = 'Download-测试<&>.png';
const html = renderToStaticMarkup(
  createElement(
    'main',
    null,
    createElement(Tool, { locale: 'zh', filename }),
    createElement(Tool, { filename })
  )
);
assert.equal(
  html,
  '<main><p>下载: Download-测试&lt;&amp;&gt;.png</p><p>Download: Download-测试&lt;&amp;&gt;.png</p></main>'
);
console.log(
  JSON.stringify({
    status: 'LOCALIZATION_UNIT_OK',
    routes: routes.length,
    ssr: 'isolated locales and user text preserved',
  })
);
