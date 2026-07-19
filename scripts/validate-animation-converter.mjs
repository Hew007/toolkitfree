import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ANIMATION_PRESETS,
  DEFAULT_ANIMATION_SETTINGS,
  buildAnimationFfmpegArgs,
  createAnimationOutputName,
  detectAnimationInputFormat,
  getAnimationBudget,
  hasPngAnimationChunk,
  hasWebpAnimationChunk,
  validateAnimationFileSize,
  validateAnimationWorkload,
} from '../src/lib/animation-converter.ts';

assert.equal(detectAnimationInputFormat({ name: 'clip.mp4', type: 'video/mp4' }), 'video');
assert.equal(detectAnimationInputFormat({ name: 'motion.apng', type: 'image/png' }), 'apng');
assert.equal(detectAnimationInputFormat({ name: 'motion.webp', type: 'image/webp' }), 'webp');
assert.equal(createAnimationOutputName('family.clip.mov', 'apng'), 'family.clip.apng');

const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 8, 97, 99, 84, 76, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0,
]);
assert.equal(hasPngAnimationChunk(png), true);
assert.equal(hasPngAnimationChunk(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), false);
assert.equal(hasWebpAnimationChunk(new TextEncoder().encode('RIFF0000WEBPVP8XANIM')), true);
assert.equal(hasWebpAnimationChunk(new TextEncoder().encode('RIFF0000WEBPVP8 ')), false);

const desktop = getAnimationBudget(false);
const mobile = getAnimationBudget(true);
assert.equal(desktop.maxVideoBytes, 50 * 1024 * 1024);
assert.equal(mobile.maxVideoBytes, 25 * 1024 * 1024);
assert.equal(ANIMATION_PRESETS.balanced.fps, 12);

assert.throws(
  () => validateAnimationFileSize({ size: desktop.maxVideoBytes + 1 }, 'video', desktop),
  /50 MiB/
);
assert.doesNotThrow(() =>
  validateAnimationWorkload(
    { width: 1280, height: 720, durationSeconds: 10 },
    'video',
    { ...DEFAULT_ANIMATION_SETTINGS, durationSeconds: 6 },
    desktop
  )
);
assert.throws(
  () =>
    validateAnimationWorkload(
      { width: 1280, height: 720, durationSeconds: 30 },
      'video',
      { ...DEFAULT_ANIMATION_SETTINGS, outputFormat: 'apng', durationSeconds: 20, fps: 15 },
      desktop
    ),
  /200 frames/
);

const gifArgs = buildAnimationFfmpegArgs(
  'input.mp4',
  'output.gif',
  'video',
  DEFAULT_ANIMATION_SETTINGS
);
assert.ok(gifArgs.some((value) => value.includes('palettegen')));
assert.ok(gifArgs.includes('-an'));

const webpArgs = buildAnimationFfmpegArgs('input.gif', 'output.webp', 'gif', {
  ...DEFAULT_ANIMATION_SETTINGS,
  outputFormat: 'webp',
});
assert.ok(webpArgs.includes('libwebp_anim'));
assert.ok(webpArgs.includes('webp'));

const apngArgs = buildAnimationFfmpegArgs('input.gif', 'output.apng', 'gif', {
  ...DEFAULT_ANIMATION_SETTINGS,
  outputFormat: 'apng',
});
assert.ok(apngArgs.includes('apng'));
assert.ok(apngArgs.includes('-plays'));

const manifestPath = path.resolve('public/generated/ffmpeg/0.12.10/manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.totalSize, 32_232_419);
  assert.ok(manifest.parts.length >= 2);
  assert.ok(manifest.parts.every((part) => part.size <= 20 * 1024 * 1024));
}

console.log(JSON.stringify({ status: 'ANIMATION_CONVERTER_VALIDATION_OK' }));
