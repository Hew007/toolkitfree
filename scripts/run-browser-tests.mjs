import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const browserArg = process.argv.find((arg) => arg.startsWith('--browser='));
const browserName = browserArg?.split('=')[1]?.toLowerCase() === 'edge' ? 'Edge' : 'Chrome';
const smokeOnly = process.argv.includes('--smoke');
const idPhotoOnly = process.argv.includes('--id-photo');
const animationOnly = process.argv.includes('--animation');
const pdfPagesOnly = process.argv.includes('--pdf-pages');
const previewPort = Number(process.env.E2E_PREVIEW_PORT || (browserName === 'Edge' ? 4332 : 4331));
const debugPort = Number(process.env.E2E_DEBUG_PORT || (browserName === 'Edge' ? 9232 : 9231));
const baseUrl = `http://127.0.0.1:${previewPort}`;
const debugUrl = `http://127.0.0.1:${debugPort}`;
const tempRoot = path.join(os.tmpdir(), `toolkitfree-e2e-${process.pid}`);

const fullTests = [
  'validate-converter-browser.mjs',
  'validate-compressor-browser.mjs',
  'validate-resizer-cropper-browser.mjs',
  'validate-secondary-tools-browser.mjs',
  'validate-batch-download-browser.mjs',
  'validate-responsive-accessibility-browser.mjs',
  'validate-performance-browser.mjs',
  'validate-collage-browser.mjs',
  'validate-id-photo-browser.mjs',
  'validate-animation-converter-browser.mjs',
  'validate-pdf-page-tools-browser.mjs',
];
const tests = pdfPagesOnly
  ? ['validate-pdf-page-tools-browser.mjs']
  : animationOnly
    ? ['validate-animation-converter-browser.mjs']
    : idPhotoOnly
      ? ['validate-id-photo-browser.mjs']
      : smokeOnly
        ? ['validate-converter-browser.mjs', 'validate-responsive-accessibility-browser.mjs']
        : fullTests;

function findBrowser() {
  const browserCandidates =
    browserName === 'Edge'
      ? [
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/usr/bin/microsoft-edge',
        ]
      : [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
        ];
  const candidates = [
    process.env.BROWSER_PATH,
    process.env.CHROME_PATH,
    ...browserCandidates,
  ].filter(Boolean);
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error(`${browserName} was not found. Set BROWSER_PATH to run browser tests.`);
  }
  return match;
}

function runNode(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function waitFor(url, label, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}: ${url}`);
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    child.kill('SIGTERM');
  }
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

async function removeTempRoot() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

if (process.env.SKIP_BUILD !== '1' && !process.argv.includes('--skip-build')) {
  await runNode(['scripts/prepare-ffmpeg-assets.mjs']);
  await runNode(['node_modules/astro/astro.js', 'build']);
}

fs.mkdirSync(tempRoot, { recursive: true });
const preview = spawn(
  process.execPath,
  ['node_modules/astro/astro.js', 'preview', '--host', '127.0.0.1', '--port', String(previewPort)],
  {
    cwd: root,
    stdio: 'ignore',
  }
);
const browser = spawn(
  findBrowser(),
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${path.join(tempRoot, browserName.toLowerCase())}`,
    'about:blank',
  ],
  {
    cwd: root,
    stdio: 'ignore',
  }
);

try {
  await waitFor(baseUrl, 'production preview');
  await waitFor(`${debugUrl}/json/version`, `${browserName} debug endpoint`);

  for (const test of tests) {
    console.log(`\n[e2e] ${test}`);
    await runNode([`scripts/${test}`], {
      ...process.env,
      BASE_URL: baseUrl,
      CHROME_DEBUG_URL: debugUrl,
      BROWSER_NAME: browserName,
      BROWSER_TEMP_DIR: path.join(tempRoot, path.basename(test, '.mjs')),
      BROWSER_DOWNLOAD_DIR: path.join(tempRoot, 'downloads'),
    });
  }
} finally {
  await Promise.all([stopProcessTree(browser), stopProcessTree(preview)]);
  await removeTempRoot();
}

console.log(
  JSON.stringify({
    status: 'BROWSER_TEST_SUITE_OK',
    scripts: tests.length,
    baseUrl,
    browser: browserName,
    mode: pdfPagesOnly
      ? 'pdf-pages'
      : animationOnly
        ? 'animation'
        : idPhotoOnly
          ? 'id-photo'
          : smokeOnly
            ? 'smoke'
            : 'full',
  })
);
