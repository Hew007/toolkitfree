// Browser regression scripts upload real image files. The fixtures are generated instead of
// committed so a fresh checkout can run the suite without binary assets in the repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { findBrowser } from './find-browser.mjs';

export const fixturesDir = path.join(process.cwd(), 'test-fixtures');

const debugPort = Number(process.env.FIXTURE_DEBUG_PORT || 9331);
const debugUrl = `http://127.0.0.1:${debugPort}`;
const profileDir = path.join(os.tmpdir(), `toolkitfree-fixtures-${process.pid}`);

// Canvas cannot encode GIF, so the palette image is written directly. The encoder uses the
// "uncompressed LZW" form: 9-bit codes with a clear code every 254 pixels, which keeps the code
// width fixed and avoids a dictionary.
function encodeGif(width, height, indices, palette) {
  const bytes = [];
  const pushAscii = (text) => {
    for (const character of text) bytes.push(character.charCodeAt(0));
  };
  const pushU16 = (value) => bytes.push(value & 0xff, (value >> 8) & 0xff);

  pushAscii('GIF89a');
  pushU16(width);
  pushU16(height);
  bytes.push(0xf7); // global color table, 8-bit resolution, 256 entries
  bytes.push(0x00); // background color index
  bytes.push(0x00); // default pixel aspect ratio
  for (let index = 0; index < 256; index += 1) {
    const [red, green, blue] = palette[index] || [0, 0, 0];
    bytes.push(red, green, blue);
  }

  bytes.push(0x2c); // image separator
  pushU16(0);
  pushU16(0);
  pushU16(width);
  pushU16(height);
  bytes.push(0x00); // no local color table, not interlaced
  bytes.push(0x08); // LZW minimum code size

  const clearCode = 256;
  const endCode = 257;
  const codes = [clearCode];
  let sinceClear = 0;
  for (const value of indices) {
    if (sinceClear === 254) {
      codes.push(clearCode);
      sinceClear = 0;
    }
    codes.push(value);
    sinceClear += 1;
  }
  codes.push(endCode);

  const packed = [];
  let bitBuffer = 0;
  let bitCount = 0;
  for (const code of codes) {
    bitBuffer |= code << bitCount;
    bitCount += 9;
    while (bitCount >= 8) {
      packed.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  }
  if (bitCount > 0) packed.push(bitBuffer & 0xff);

  for (let offset = 0; offset < packed.length; offset += 255) {
    const chunk = packed.slice(offset, offset + 255);
    bytes.push(chunk.length, ...chunk);
  }
  bytes.push(0x00); // block terminator
  bytes.push(0x3b); // trailer
  return Buffer.from(bytes);
}

function buildGif() {
  const width = 48;
  const height = 32;
  const palette = [
    [255, 255, 255],
    [37, 99, 235],
    [22, 163, 74],
    [220, 38, 38],
  ];
  const indices = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      indices.push((Math.floor(x / 12) + Math.floor(y / 8)) % 4);
    }
  }
  return encodeGif(width, height, indices, palette);
}

const svgFixture = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">
  <rect width="240" height="180" fill="#f8fafc" />
  <circle cx="80" cy="90" r="55" fill="#2563eb" />
  <rect x="130" y="45" width="80" height="90" fill="#16a34a" />
</svg>
`;

async function waitFor(url, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The browser may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}: ${url}`);
}

async function stopBrowser(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

// Windows keeps the profile locked briefly after the browser exits; the fixtures are already
// written by then, so a stubborn profile must not fail the run.
async function removeProfileDir() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, attempt * 200));
    }
  }
}

// Drawn inside the browser so Canvas can encode PNG, JPEG, and WebP without an image library.
const drawScript = `
  (async () => {
    const random = (() => {
      let seed = 20260804;
      return () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
    })();

    const encode = (canvas, type, quality) =>
      new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas could not encode ' + type));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          },
          type,
          quality
        );
      });

    const create = (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };

    const transparent = create(200, 150);
    const transparentContext = transparent.getContext('2d');
    transparentContext.fillStyle = '#2563eb';
    transparentContext.beginPath();
    transparentContext.arc(100, 75, 55, 0, Math.PI * 2);
    transparentContext.fill();
    transparentContext.fillStyle = '#f97316';
    transparentContext.fillRect(70, 45, 60, 60);

    const opaque = create(256, 256);
    const opaqueContext = opaque.getContext('2d');
    opaqueContext.fillStyle = '#0f172a';
    opaqueContext.fillRect(0, 0, 256, 256);
    opaqueContext.fillStyle = '#38bdf8';
    opaqueContext.beginPath();
    opaqueContext.arc(128, 128, 90, 0, Math.PI * 2);
    opaqueContext.fill();
    opaqueContext.fillStyle = '#facc15';
    opaqueContext.fillRect(96, 96, 64, 64);

    const photo = create(800, 600);
    const photoContext = photo.getContext('2d');
    const gradient = photoContext.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#1d4ed8');
    gradient.addColorStop(0.5, '#f59e0b');
    gradient.addColorStop(1, '#065f46');
    photoContext.fillStyle = gradient;
    photoContext.fillRect(0, 0, 800, 600);
    for (let index = 0; index < 900; index += 1) {
      photoContext.fillStyle =
        'rgba(' +
        Math.floor(random() * 256) +
        ',' +
        Math.floor(random() * 256) +
        ',' +
        Math.floor(random() * 256) +
        ',0.55)';
      photoContext.beginPath();
      photoContext.arc(random() * 800, random() * 600, 2 + random() * 14, 0, Math.PI * 2);
      photoContext.fill();
    }

    const webp = create(240, 180);
    const webpContext = webp.getContext('2d');
    webpContext.fillStyle = '#fef3c7';
    webpContext.fillRect(0, 0, 240, 180);
    webpContext.fillStyle = '#b91c1c';
    webpContext.fillRect(20, 20, 90, 140);
    webpContext.fillStyle = '#1e40af';
    webpContext.beginPath();
    webpContext.arc(170, 90, 50, 0, Math.PI * 2);
    webpContext.fill();

    return {
      'transparent.png': await encode(transparent, 'image/png'),
      'opaque.png': await encode(opaque, 'image/png'),
      'photo.jpg': await encode(photo, 'image/jpeg', 0.92),
      'sample.webp': await encode(webp, 'image/webp', 0.9),
    };
  })()
`;

function decodeScript(files) {
  const entries = files.map(([name, base64]) => `['${name}', '${base64}']`).join(',');
  return `
    (async () => {
      const results = {};
      for (const [name, base64] of [${entries}]) {
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) buffer[index] = binary.charCodeAt(index);
        const bitmap = await createImageBitmap(new Blob([buffer]));
        results[name] = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
      }
      return results;
    })()
  `;
}

export async function prepareTestFixtures() {
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = spawn(
    findBrowser(process.env.BROWSER_NAME),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let socket;
  try {
    await waitFor(`${debugUrl}/json/version`, 'fixture browser debug endpoint');
    const target = await fetch(`${debugUrl}/json/new?${encodeURIComponent('about:blank')}`, {
      method: 'PUT',
    }).then((response) => {
      if (!response.ok) throw new Error(`Could not create browser target: ${response.status}`);
      return response.json();
    });

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    let nextId = 0;
    const pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });

    const evaluate = async (expression) => {
      const id = ++nextId;
      const result = await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, awaitPromise: true, returnByValue: true },
          })
        );
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || 'Fixture script failed');
      }
      return result.result.value;
    };

    const encoded = await evaluate(drawScript);
    for (const [name, base64] of Object.entries(encoded)) {
      fs.writeFileSync(path.join(fixturesDir, name), Buffer.from(base64, 'base64'));
    }

    const gif = buildGif();
    fs.writeFileSync(path.join(fixturesDir, 'sample.gif'), gif);
    fs.writeFileSync(path.join(fixturesDir, 'vector.svg'), svgFixture);
    fs.writeFileSync(
      path.join(fixturesDir, 'invalid.txt'),
      'This file is intentionally not an image.\n'
    );
    fs.writeFileSync(path.join(fixturesDir, 'empty.bin'), Buffer.alloc(0));

    // A silently corrupt fixture would surface as a confusing tool failure, so every raster
    // fixture is decoded by the same engine the regression uses.
    const decoded = await evaluate(
      decodeScript([...Object.entries(encoded), ['sample.gif', gif.toString('base64')]])
    );
    const expected = {
      'transparent.png': [200, 150],
      'opaque.png': [256, 256],
      'photo.jpg': [800, 600],
      'sample.webp': [240, 180],
      'sample.gif': [48, 32],
    };
    for (const [name, [width, height]] of Object.entries(expected)) {
      const actual = decoded[name];
      if (!actual || actual.width !== width || actual.height !== height) {
        throw new Error(
          `${name} decoded as ${actual ? `${actual.width}x${actual.height}` : 'unreadable'}, expected ${width}x${height}`
        );
      }
    }

    return {
      status: 'TEST_FIXTURES_READY',
      directory: path.relative(process.cwd(), fixturesDir),
      files: Object.keys(expected).length + 3,
    };
  } finally {
    socket?.close();
    await stopBrowser(browser);
    await removeProfileDir();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await prepareTestFixtures()));
}
