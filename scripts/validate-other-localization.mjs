import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = fs.mkdtempSync(path.join(root, '.tmp-other-localization-'));
assert.equal(path.dirname(temporary), path.resolve(root), 'Unexpected test directory.');
try {
  const names = [
    'BackgroundRemover',
    'AnimationConverter',
    'ImageToPdf',
    'PdfPageExtractor',
    'FaviconGenerator',
    'QrGenerator',
    'IdPhotoMaker',
  ];
  const entry = `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';\n${names.map((n) => `import ${n} from './src/components/${n}';`).join('\n')}\nimport {translateOther} from './src/i18n/other-messages';\nexport const snapshots = Object.fromEntries(Object.entries({${names.join(',')}}).map(([name,Component])=>[name,{en:renderToStaticMarkup(<Component locale="en"/>),zh:renderToStaticMarkup(<Component locale="zh"/>)}])); export {translateOther};`;
  await build({
    stdin: { contents: entry, resolveDir: root, loader: 'tsx' },
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    outfile: path.join(temporary, 'tools.mjs'),
    logLevel: 'error',
  });
  const { snapshots, translateOther: t } = await import(
    pathToFileURL(path.join(temporary, 'tools.mjs')).href
  );
  for (const [name, { en, zh }] of Object.entries(snapshots)) {
    assert.match(zh, /[\u4e00-\u9fff]/, name);
    assert.notEqual(zh, en, name);
    assert.doesNotMatch(en, /[\u4e00-\u9fff]/, name);
  }
  assert.match(snapshots.QrGenerator.zh, /二维码包含什么内容/);
  assert.match(snapshots.QrGenerator.zh, /颜色/);
  assert.doesNotMatch(snapshots.QrGenerator.zh, /What are you encoding|Enter content to generate/);
  const samples = [
    ['Remove page 2', '移除第 2 页'],
    ['Page range “7-2” must run from lower to higher.', '页码范围“7-2”必须从小到大。'],
    ['Move page 3 later', '后移第 3 页'],
    [
      'Rendered 3 icons in your browser in 0.42s. Nothing was uploaded.',
      '已在浏览器中生成 3 个图标，用时 0.42 秒。图片内容未上传。',
    ],
    [
      'Photo rendered in 20 ms and the print sheet in 0.5s, both in your browser. Nothing was uploaded.',
      '照片生成用时 20 ms，打印排版用时 0.5s，均在浏览器中完成。图片内容未上传。',
    ],
    [' White ', ' 白色 '],
    ['Back to the Browser tab only set', '恢复“仅浏览器标签页”尺寸组'],
    ['Remove White\n测试.png', '移除 White\n测试.png'],
    ['Remove $&.png\n', '移除 $&.png\n'],
    ['White\n测试.png preview', 'White\n测试.png 预览'],
    [
      'White\n测试.png on page 2. Arrows move, Alt plus arrows resize, brackets rotate.',
      'White\n测试.png，第 2 页。方向键移动，Alt 加方向键缩放，方括号键旋转。',
    ],
    [
      'The local conversion engine manifest failed after three download attempts.',
      '转换引擎资源清单在三次下载尝试后仍失败，请检查网络连接后重试。',
    ],
    [
      'The compressed conversion engine failed after three download attempts.',
      '压缩转换引擎在三次下载尝试后仍失败，请检查网络连接后重试。',
    ],
    [
      'The local conversion engine script failed after three download attempts.',
      '转换引擎脚本在三次下载尝试后仍失败，请检查网络连接后重试。',
    ],
    [
      'Could not encode a temporary frame.',
      '无法编码临时动画帧，请降低输出尺寸或选择其他文件后重试。',
    ],
    [
      'The background removal worker stopped unexpectedly.',
      '抠图后台任务意外停止，请检查设备可用内存或尝试较小的图片后重试。',
    ],
    [
      'The background removal worker could not start; its script failed to load.',
      '抠图后台任务无法启动，因为运行脚本加载失败。请检查网络连接后重新加载页面。',
    ],
    [
      'Background removal stopped because the model made no progress for too long (last step: compute:inference, silent for 90s, 4 threads).',
      '抠图模型长时间没有进展，任务已停止。最后步骤：compute:inference；已等待 90 秒；线程数：4。请检查网络连接和设备可用内存后重试。',
    ],
  ];
  for (const [en, zh] of samples) assert.equal(t(en), zh);
  const contents = `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {LocaleContext} from './src/i18n/react';import PdfPageEditor from './src/components/PdfPageEditor';import IdPhotoOptions from './src/components/IdPhotoOptions';import IdPhotoEditor from './src/components/IdPhotoEditor';const noop=()=>{};const item={id:1,name:'White',previewUrl:'blob:test',rotation:0,placement:{x:0,y:0,width:20,height:30},aspect:2/3};export const pdf=renderToStaticMarkup(<LocaleContext.Provider value="zh"><PdfPageEditor pages={[{geometry:{width:210,height:297},items:[item]}]} margin={0} selectedId={1} disabled={false} onSelect={noop} onPlacementChange={noop} onRotate={noop} onFit={noop} onRemove={noop} onMoveToPage={noop} onMoveToNewPage={noop} onMovePage={noop} onReorderWithinPage={noop}/></LocaleContext.Provider>);export const options=renderToStaticMarkup(<LocaleContext.Provider value="zh"><IdPhotoOptions settings={{presetId:'custom',width:35,height:45,unit:'mm',dpi:300,format:'image/jpeg',quality:90,paper:'a4',marginMm:5,gapMm:2,cutLines:true}} onChange={noop}/></LocaleContext.Provider>);export const editor=renderToStaticMarkup(<LocaleContext.Provider value="zh"><IdPhotoEditor imageUrl="blob:source" source={{width:100,height:100}} crop={{x:0,y:0,width:100,height:100}} ratio={1} headHeightRange={null} onCropChange={noop}/></LocaleContext.Provider>);`;
  await build({
    stdin: { contents, loader: 'tsx', resolveDir: root },
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    outfile: path.join(temporary, 'editors.mjs'),
    logLevel: 'error',
  });
  const { pdf, options, editor } = await import(
    pathToFileURL(path.join(temporary, 'editors.mjs')).href
  );
  assert.match(pdf, /aria-label="White，第 1 页/);
  assert.match(pdf, /向左旋转/);
  assert.match(pdf, /前移第 1 页/);
  assert.match(pdf, /↑/);
  assert.doesNotMatch(pdf, /&amp;uarr/);
  assert.match(options, /毫米/);
  assert.match(options, /打印排版/);
  assert.match(options, /照片间距/);
  assert.match(editor, /照片定位/);
  assert.match(editor, /缩小/);
  assert.match(editor, /放大/);

  console.log(
    JSON.stringify({
      status: 'OTHER_LOCALIZATION_UNIT_OK',
      tools: names.length,
      ssrAssertions: 24,
      editorAssertions: 11,
      dynamicMessageAssertions: samples.length,
    })
  );
} finally {
  // Only remove the fresh directory created by this invocation.
  fs.rmSync(temporary, { recursive: true, force: true });
}
