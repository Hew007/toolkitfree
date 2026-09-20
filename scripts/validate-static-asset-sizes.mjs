import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const maxBytes = 24 * 1024 * 1024;
const oversized = [];

// Every WebAssembly binary this site runs is deliberately self-hosted under
// /generated/, fetched on demand and split into cacheable chunks. A .wasm that
// lands in Vite's own output directory instead is one a dependency named in its
// source and Vite emitted on our behalf — shipped on every release whether or not
// anything asks for it. That is how a 23.9 MB WebGPU ONNX Runtime build rode
// along unused for months; see the plugin in astro.config.mjs.
const bundledDirectory = path.join(root, '_astro');
const bundledWasm = fs.existsSync(bundledDirectory)
  ? fs
      .readdirSync(bundledDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.wasm'))
      .map((entry) => ({
        file: path.join('_astro', entry.name),
        size: fs.statSync(path.join(bundledDirectory, entry.name)).size,
      }))
  : [];

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(filePath);
    else {
      const size = fs.statSync(filePath).size;
      if (size > maxBytes) oversized.push({ file: path.relative(root, filePath), size });
    }
  }
}

if (!fs.existsSync(root)) throw new Error('dist does not exist. Run npm run build first.');
visit(root);

if (oversized.length > 0) {
  throw new Error(`Static assets exceed the 24 MiB release guard: ${JSON.stringify(oversized)}`);
}

if (bundledWasm.length > 0) {
  throw new Error(
    `Vite emitted WebAssembly into dist/_astro. Serve it from /generated/ on demand, or stop the emit: ${JSON.stringify(bundledWasm)}`
  );
}

console.log(JSON.stringify({ status: 'STATIC_ASSET_SIZE_OK', maxBytes, bundledWasm: 0 }));
