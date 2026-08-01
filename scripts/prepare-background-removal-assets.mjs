import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const version = '1.7.0';
const root = process.cwd();
const baseUrl = `https://staticimgly.com/@imgly/background-removal-data/${version}/dist/`;
const outputDirectory = path.join(root, 'public', 'generated', 'background-removal', version);
const requiredResources = [
  '/models/isnet_quint8',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
];

async function fetchWithRetry(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(
    `Could not download ${url}: ${lastError instanceof Error ? lastError.message : lastError}`
  );
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

const manifestPath = path.join(outputDirectory, 'resources.json');
let resources;
if (fs.existsSync(manifestPath)) {
  const cachedResources = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (requiredResources.every((key) => cachedResources[key])) resources = cachedResources;
}
if (!resources) {
  const metadataBuffer = await fetchWithRetry(`${baseUrl}resources.json`);
  const allResources = JSON.parse(metadataBuffer.toString('utf8'));
  resources = Object.fromEntries(
    requiredResources.map((key) => {
      const resource = allResources[key];
      if (!resource) throw new Error(`IMG.LY metadata is missing required resource ${key}.`);
      return [
        key,
        {
          ...resource,
          chunks: resource.chunks.map((chunk) => ({ ...chunk, name: `${chunk.name}.bin` })),
        },
      ];
    })
  );
}
const chunks = [
  ...new Map(
    Object.values(resources).flatMap((resource) =>
      resource.chunks.map((chunk) => [chunk.name, chunk])
    )
  ).values(),
];

fs.mkdirSync(outputDirectory, { recursive: true });

let downloaded = 0;
for (const chunk of chunks) {
  const destination = path.join(outputDirectory, chunk.name);
  const sourceName = chunk.name.replace(/\.bin$/, '');
  const legacyDestination = path.join(outputDirectory, sourceName);
  const expectedSize = chunk.offsets[1] - chunk.offsets[0];
  if (fs.existsSync(destination)) {
    const existing = fs.readFileSync(destination);
    if (existing.length === expectedSize && sha256(existing) === chunk.hash) continue;
  }
  if (fs.existsSync(legacyDestination)) {
    const existing = fs.readFileSync(legacyDestination);
    if (existing.length === expectedSize && sha256(existing) === chunk.hash) {
      fs.renameSync(legacyDestination, destination);
      continue;
    }
  }
  const value = await fetchWithRetry(`${baseUrl}${sourceName}`);
  if (value.length !== expectedSize || sha256(value) !== chunk.hash) {
    throw new Error(`Integrity check failed for background-removal asset ${chunk.name}.`);
  }
  fs.writeFileSync(destination, value);
  downloaded += 1;
}

fs.writeFileSync(manifestPath, `${JSON.stringify(resources)}\n`);

console.log(
  JSON.stringify({
    status: 'BACKGROUND_REMOVAL_ASSETS_READY',
    version,
    resources: requiredResources.length,
    chunks: chunks.length,
    downloaded,
    bytes: chunks.reduce((total, chunk) => total + chunk.offsets[1] - chunk.offsets[0], 0),
  })
);
