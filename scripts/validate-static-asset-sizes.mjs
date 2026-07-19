import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const maxBytes = 24 * 1024 * 1024;
const oversized = [];

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

console.log(JSON.stringify({ status: 'STATIC_ASSET_SIZE_OK', maxBytes }));
