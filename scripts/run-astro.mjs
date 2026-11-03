import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Vite and Astro must agree on one path identity when a Windows junction points
// at the checkout. Mixed alias/real paths can silently omit imported CSS.
const root = fs.realpathSync(process.cwd());
const child = spawn(
  process.execPath,
  [path.join(root, 'node_modules/astro/astro.js'), ...process.argv.slice(2)],
  { cwd: root, stdio: 'inherit' }
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
