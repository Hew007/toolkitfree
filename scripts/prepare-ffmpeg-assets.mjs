import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = '0.12.10';
const chunkSize = 16 * 1024 * 1024;
const sourceDirectory = path.join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const outputDirectory = path.join(root, 'public', 'generated', 'ffmpeg', version);
const wasmSource = path.join(sourceDirectory, 'ffmpeg-core.wasm');
const coreSource = path.join(sourceDirectory, 'ffmpeg-core.js');

if (!fs.existsSync(wasmSource) || !fs.existsSync(coreSource)) {
  throw new Error('Missing @ffmpeg/core assets. Run npm install before preparing FFmpeg assets.');
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

const wasm = fs.readFileSync(wasmSource);
const wasmHash = createHash('sha256').update(wasm).digest('hex');
const parts = [];

for (let offset = 0, index = 0; offset < wasm.length; offset += chunkSize, index += 1) {
  const chunk = wasm.subarray(offset, Math.min(offset + chunkSize, wasm.length));
  const chunkHash = createHash('sha256').update(chunk).digest('hex');
  const file = `ffmpeg-core-${chunkHash.slice(0, 12)}.part${index}.bin`;
  fs.writeFileSync(path.join(outputDirectory, file), chunk);
  parts.push({ file, size: chunk.length, sha256: chunkHash });
}

fs.copyFileSync(coreSource, path.join(outputDirectory, 'ffmpeg-core.js'));
fs.writeFileSync(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(
    {
      version,
      totalSize: wasm.length,
      sha256: wasmHash,
      coreFile: 'ffmpeg-core.js',
      parts,
    },
    null,
    2
  )}\n`
);

console.log(
  JSON.stringify({
    status: 'FFMPEG_ASSETS_READY',
    version,
    bytes: wasm.length,
    parts: parts.length,
  })
);
