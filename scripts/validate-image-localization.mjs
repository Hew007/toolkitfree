import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { imageChoices, imageText } from '../src/i18n/image-messages.ts';
import { IMAGE_ENHANCER_PRESETS } from '../src/lib/image-enhancer.ts';
import { RESIZE_PRESETS } from '../src/lib/image-resizer.ts';
import { CROP_ASPECT_PRESETS } from '../src/lib/image-cropper.ts';

const tools = [
  'ImageConverter',
  'ImageCompressor',
  'ImageResizer',
  'ImageEnhancer',
  'ImageCollage',
  'ImageSplitter',
  'ImageCropper',
];
const technicalCopy = new Set(['x', 'px', 'KB', 'PNG', 'JPG', 'WebP', 'px ·', '—']);
let staticMessages = 0;
for (const name of tools) {
  const filename = new URL(`../src/components/${name}.tsx`, import.meta.url);
  const tree = ts.createSourceFile(
    filename.pathname,
    fs.readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(tree) === 'imageText' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const original = node.arguments[0].text;
      assert.equal(imageText(original, 'en'), original, `${name}: English copy changed`);
      if (/[a-z]/i.test(original) && !technicalCopy.has(original.trim())) {
        assert.match(
          imageText(original, 'zh'),
          /[\u4e00-\u9fff]/,
          `${name}: missing Chinese copy for ${original}`
        );
        staticMessages++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
}

// Exercise values produced by real tool states, including the optional branches.
const dynamicMessages = [
  'JPG · quality 92%',
  'PNG · lossless',
  'Target 100 KB · max width 800 px',
  'JPG · 3 columns · original size',
  '2 × 2 · PNG · 10px border · 5px discarded',
  'Converted in your browser in 0.3s. Nothing was uploaded.',
  'Encoded in your browser in 1.2s. Nothing was uploaded.',
  'Resized in your browser in 1.0s. Nothing was uploaded.',
  'Rendered in your browser in 0.1s. Nothing was uploaded.',
  'Cropped in your browser in 2.3s. Nothing was uploaded.',
  'Back to the Photo boost preset',
  'Back to the 2 across grid',
  'Already within the 100 KB target; original kept.',
  'Target met: 99.1 KB is within 100 KB.',
  'Target not met after 5 attempts; closest result kept.',
  'Target not met after 5 attempts; original kept because no smaller result was found.',
  'Collage file ready in 0.34s. It is rebuilt whenever the layout, the order, or a setting changes.',
  'Collage file ready. It is rebuilt whenever the layout, the order, or a setting changes.',
  'Recommended: Side by side',
  'Vertical line 1 (px from left)',
  'Remove horizontal line 2',
  'Horizontal line 1 at 32 pixels. Use the arrow keys to move it.',
  'Cut 4 pieces in your browser in 850ms. The image was not uploaded for processing.',
  'Cut 1 piece in your browser in 1.2s. The image was not uploaded for processing.',
  'Placed 3 split lines: 1 vertical, 2 horizontal, discarding 10px at each, inside a 2px border. Check them and move any line that sits in the wrong place.',
  'Placed 1 split line: 1 vertical, 0 horizontal. Check them and move any line that sits in the wrong place.',
  'The remaining -5px cannot be divided into 4 pieces. Reduce the margin, the gap, or the number of pieces.',
  'A piece along the width would be empty. Move the split lines apart, or reduce the margin or the gap.',
  'A split cannot produce more than 144 pieces.',
  'Cut 2 must be a safe integer of at least 0.',
];
for (const original of dynamicMessages) {
  const translated = imageText(original, 'zh');
  assert.match(translated, /[\u4e00-\u9fff]/, `Missing dynamic translation: ${original}`);
  assert.doesNotMatch(
    translated,
    /quality|columns|original|border|discarded|Back to|Recommended|pieces|preset/
  );
  assert.equal(imageText(original, 'en'), original);
}
assert.equal(imageText('PNG · lossless', 'zh'), 'PNG · 无损');
assert.equal(imageText('JPG · quality 92%', 'zh'), 'JPG · 质量 92%');
assert.equal(
  imageText('Target met: 99.1 KB is within 100 KB.', 'zh'),
  '已达到目标：99.1 KB 不超过 100 KB。'
);

// File names are opaque data inside translated sentences, including whitespace.
const filenames = [
  '  双  空格\n照片.png  ',
  'Download',
  'Move earlier.jpg',
  '<img onerror=alert(1)>.png',
];
for (const name of filenames) {
  assert.equal(imageText(`Move ${name} earlier`, 'zh'), `将 ${name} 前移`);
  assert.equal(imageText(`Move ${name} later`, 'zh'), `将 ${name} 后移`);
  assert.equal(
    imageText(`Preview of ${name} at the selected dimensions`, 'zh'),
    `${name} 按所选尺寸的预览`
  );
  assert.equal(imageText(`Preview of ${name} with split lines`, 'zh'), `${name} 的分割线预览`);
  assert.equal(imageText(`${name} moved to position 2.`, 'zh'), `已将 ${name} 移至第 2 个位置。`);
}

// Preset identifiers and processing settings must never be translated or mutated.
const choices = IMAGE_ENHANCER_PRESETS.map((entry) => ({ ...entry, hint: entry.summary }));
const before = JSON.stringify(choices);
const translated = imageChoices(choices, 'zh');
assert.equal(JSON.stringify(choices), before);
for (let index = 0; index < choices.length; index++) {
  assert.equal(translated[index].id, choices[index].id);
  assert.deepEqual(translated[index].adjustments, choices[index].adjustments);
  assert.match(translated[index].label, /[\u4e00-\u9fff]/);
  assert.match(translated[index].hint, /[\u4e00-\u9fff]/);
}
for (const preset of Object.values(RESIZE_PRESETS))
  assert.match(imageText(preset.label, 'zh'), /[\u4e00-\u9fff]/);
assert.equal(imageText(CROP_ASPECT_PRESETS.free.label, 'zh'), '自由比例');
for (const preset of Object.values(CROP_ASPECT_PRESETS).filter((entry) => entry.ratio !== null))
  assert.equal(imageText(preset.label, 'zh'), preset.label);
assert.equal(imageText(undefined, 'zh'), undefined);
assert.equal(imageText(0, 'zh'), 0);
assert.equal(imageText(false, 'zh'), false);
console.log(
  JSON.stringify({
    status: 'IMAGE_LOCALIZATION_OK',
    tools: tools.length,
    staticMessages,
    dynamicMessages: dynamicMessages.length,
    filenameCases: filenames.length,
    presetCases:
      choices.length + Object.keys(RESIZE_PRESETS).length + Object.keys(CROP_ASPECT_PRESETS).length,
  })
);
