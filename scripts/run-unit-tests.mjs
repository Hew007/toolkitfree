import { spawn } from 'node:child_process';

const tests = [
  'validate-image-processing.mjs',
  'validate-image-enhancer.mjs',
  'validate-image-converter.mjs',
  'validate-image-compressor.mjs',
  'validate-resizer-cropper.mjs',
  'validate-secondary-tools.mjs',
  'validate-batch-download.mjs',
  'validate-performance-guards.mjs',
  'validate-id-photo.mjs',
];

for (const test of tests) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`scripts/${test}`], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${test} failed with exit code ${code}`));
    });
  });
}

console.log(
  JSON.stringify({
    status: 'UNIT_TEST_SUITE_OK',
    scripts: tests.length,
  })
);
