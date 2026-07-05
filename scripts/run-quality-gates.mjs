import { spawn } from 'node:child_process';

const prettierTargets = ['src/**/*.{ts,tsx,astro}', 'scripts/*.mjs', '*.{json,mjs,js}'];

const steps = [
  {
    name: 'LLM registry',
    args: ['scripts/sync-llms-registry.mjs', '--check'],
  },
  {
    name: 'TypeScript',
    args: ['node_modules/typescript/bin/tsc', '--noEmit'],
  },
  {
    name: 'ESLint',
    args: ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings=0'],
  },
  {
    name: 'Prettier',
    args: ['node_modules/prettier/bin/prettier.cjs', '--check', ...prettierTargets],
  },
  {
    name: 'Unit and algorithm tests',
    args: ['scripts/run-unit-tests.mjs'],
  },
  {
    name: 'Production build',
    args: ['node_modules/astro/astro.js', 'build'],
  },
  {
    name: 'SEO registry',
    args: ['scripts/validate-seo-registry.mjs'],
  },
  {
    name: 'Site integrity',
    args: ['scripts/validate-site-integrity.mjs'],
  },
];

for (const step of steps) {
  console.log(`\n[quality] ${step.name}`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, step.args, {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${step.name} failed with exit code ${code}`));
    });
  });
}

console.log(
  JSON.stringify({
    status: 'QUALITY_GATES_OK',
    steps: steps.length,
  })
);
