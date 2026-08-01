import fs from 'node:fs';
import { getGuidePublicUrl, guideRegistry } from '../src/data/guide-registry.ts';
import { toPublicUrl, toolRegistry } from '../src/data/tool-registry.ts';

const checkOnly = process.argv.includes('--check');

function replaceSection(content, heading, nextHeading, section) {
  const start = content.indexOf(`${heading}\n`);
  const end = content.indexOf(`${nextHeading}\n`, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not replace ${heading} before ${nextHeading}`);
  }
  return `${content.slice(0, start)}${section.trim()}\n\n${content.slice(end)}`;
}

function replaceTailSection(content, heading, section) {
  const start = content.indexOf(`${heading}\n`);
  if (start < 0) throw new Error(`Could not replace ${heading}`);
  return `${content.slice(0, start)}${section.trim()}\n`;
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
}

function updateFile(file, content) {
  if (checkOnly) {
    if (readText(file) !== content) {
      throw new Error(`${file} is out of sync with the tool registry.`);
    }
    return;
  }
  fs.writeFileSync(file, content);
}

const compactList = toolRegistry
  .map((tool) => `- [${tool.name}](${toPublicUrl(tool.href)}): ${tool.description}`)
  .join('\n');
const compactGuides = guideRegistry
  .map((guide) => `- [${guide.title}](${getGuidePublicUrl(guide)}): ${guide.description}`)
  .join('\n');

const llmsPath = 'public/llms.txt';
const llms = readText(llmsPath);
updateFile(
  llmsPath,
  replaceTailSection(
    replaceSection(
      llms,
      '## Main tools',
      '## Supported converter pages',
      `## Main tools

<!-- Generated from src/data/tool-registry.ts by scripts/sync-llms-registry.mjs. -->
${compactList}`
    ),
    '## Guides and policies',
    `## Guides and policies

<!-- Generated guide links from src/data/guide-registry.ts. -->
${compactGuides}
- [Privacy Policy](https://toolkitfree.net/privacy-policy/)
- [About](https://toolkitfree.net/about/)`
  )
);

const fullPath = 'public/llms-full.txt';
let full = readText(fullPath);
const registrySection = `## Tool registry

<!-- Generated from src/data/tool-registry.ts by scripts/sync-llms-registry.mjs. -->
${compactList}`;
const guideSection = `## Guide registry

<!-- Generated from src/data/guide-registry.ts by scripts/sync-llms-registry.mjs. -->
${compactGuides}`;

if (full.includes('## Tool registry\n')) {
  full = replaceSection(
    full,
    '## Tool registry',
    '## Image Converter',
    `${registrySection}\n\n${guideSection}`
  );
} else {
  full = full.replace(
    '## Image Converter\n',
    `${registrySection}\n\n${guideSection}\n\n## Image Converter\n`
  );
}
updateFile(fullPath, full);

console.log(
  JSON.stringify({
    status: checkOnly ? 'LLMS_REGISTRY_CHECK_OK' : 'LLMS_REGISTRY_SYNC_OK',
    tools: toolRegistry.length,
    guides: guideRegistry.length,
  })
);
