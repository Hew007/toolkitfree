import fs from 'node:fs';
import { SITE_URL, toolRegistry } from '../src/data/tool-registry.ts';

function replaceSection(content, heading, nextHeading, section) {
  const start = content.indexOf(`${heading}\n`);
  const end = content.indexOf(`${nextHeading}\n`, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not replace ${heading} before ${nextHeading}`);
  }
  return `${content.slice(0, start)}${section.trim()}\n\n${content.slice(end)}`;
}

const compactList = toolRegistry
  .map((tool) => `- [${tool.name}](${SITE_URL}${tool.href}): ${tool.description}`)
  .join('\n');

const llmsPath = 'public/llms.txt';
const llms = fs.readFileSync(llmsPath, 'utf8');
fs.writeFileSync(
  llmsPath,
  replaceSection(
    llms,
    '## Main tools',
    '## Supported converter pages',
    `## Main tools

<!-- Generated from src/data/tool-registry.ts by scripts/sync-llms-registry.mjs. -->
${compactList}`
  )
);

const fullPath = 'public/llms-full.txt';
let full = fs.readFileSync(fullPath, 'utf8');
const registrySection = `## Tool registry

<!-- Generated from src/data/tool-registry.ts by scripts/sync-llms-registry.mjs. -->
${compactList}`;

if (full.includes('## Tool registry\n')) {
  full = replaceSection(full, '## Tool registry', '## Image Converter', registrySection);
} else {
  full = full.replace('## Image Converter\n', `${registrySection}\n\n## Image Converter\n`);
}
fs.writeFileSync(fullPath, full);
