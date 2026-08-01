import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { guideRegistry } from '../src/data/guide-registry.ts';
import { toolRegistry } from '../src/data/tool-registry.ts';

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function latestSourceDate(sourcePaths) {
  const existingPaths = sourcePaths.filter((sourcePath) =>
    fs.existsSync(path.join(root, sourcePath))
  );
  const dirty = existingPaths.some((sourcePath) =>
    git(['status', '--porcelain', '--', sourcePath])
  );
  if (dirty) return today;

  return existingPaths
    .map((sourcePath) => git(['log', '-1', '--format=%cs', '--', sourcePath]))
    .filter(Boolean)
    .sort()
    .at(-1);
}

const entries = [
  ...toolRegistry.map((tool) => ({
    label: tool.name,
    declared: tool.lastModified,
    sources: [`src/pages${tool.href}.astro`, `src/pages${tool.href}/[variant].astro`],
  })),
  ...guideRegistry.map((guide) => ({
    label: guide.title,
    declared: guide.lastModified,
    sources: [`src/pages${guide.href}.astro`],
  })),
];

const stale = entries.flatMap((entry) => {
  const required = latestSourceDate(entry.sources);
  return required && entry.declared < required ? [{ ...entry, required }] : [];
});

if (stale.length > 0) {
  for (const entry of stale) {
    console.error(
      `${entry.label}: lastModified ${entry.declared} is older than source date ${entry.required}`
    );
  }
  throw new Error('Content freshness validation failed. Update the corresponding registry date.');
}

console.log(
  JSON.stringify({
    status: 'CONTENT_FRESHNESS_OK',
    entries: entries.length,
  })
);
