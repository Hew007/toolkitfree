import fs from 'node:fs';
import { getGuidePublicUrl, guideRegistry } from '../src/data/guide-registry.ts';
import { toPublicUrl, toolRegistry } from '../src/data/tool-registry.ts';

const checkOnly = process.argv.includes('--check');

/**
 * Index of a heading that starts its own line. Anchoring to the line start keeps
 * `## Image Converter` from matching inside the `### Image Converter` subheading
 * that the generated variant list emits.
 */
function headingIndex(content, heading, from = 0) {
  if (from === 0 && content.startsWith(`${heading}\n`)) return 0;
  const found = content.indexOf(`\n${heading}\n`, from);
  return found < 0 ? -1 : found + 1;
}

function replaceSection(content, heading, nextHeading, section) {
  const start = headingIndex(content, heading);
  const end = start < 0 ? -1 : headingIndex(content, nextHeading, start + 1);
  if (start < 0 || end < 0) {
    throw new Error(`Could not replace ${heading} before ${nextHeading}`);
  }
  return `${content.slice(0, start)}${section.trim()}\n\n${content.slice(end)}`;
}

function replaceTailSection(content, heading, section) {
  const start = headingIndex(content, heading);
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

// Every indexable variant page, grouped by tool. Non-indexable variants are left
// out on purpose: a noindex page must not be advertised to answer engines.
const variantGroups = toolRegistry
  .map((tool) => ({
    tool,
    variants: tool.variants.filter((variant) => variant.indexable !== false),
  }))
  .filter((group) => group.variants.length > 0);

const variantList = variantGroups
  .map(
    (group) =>
      `### ${group.tool.name}\n${group.variants
        .map(
          (variant) => `- [${variant.label}](${toPublicUrl(`${group.tool.href}/${variant.slug}`)})`
        )
        .join('\n')}`
  )
  .join('\n\n');

const variantSection = `## Variant pages

<!-- Generated from src/data/tool-registry.ts by scripts/sync-llms-registry.mjs. -->
${variantList}`;

const llmsPath = 'public/llms.txt';
const llms = readText(llmsPath);
updateFile(
  llmsPath,
  replaceTailSection(
    replaceSection(
      llms,
      '## Main tools',
      '## Guides and policies',
      `## Main tools

<!-- Generated from src/data/tool-registry.ts by scripts/sync-llms-registry.mjs. -->
${compactList}

${variantSection}`
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
    `${registrySection}\n\n${variantSection}\n\n${guideSection}`
  );
} else {
  full = full.replace(
    '## Image Converter\n',
    `${registrySection}\n\n${variantSection}\n\n${guideSection}\n\n## Image Converter\n`
  );
}
updateFile(fullPath, full);

console.log(
  JSON.stringify({
    status: checkOnly ? 'LLMS_REGISTRY_CHECK_OK' : 'LLMS_REGISTRY_SYNC_OK',
    tools: toolRegistry.length,
    indexableVariants: variantGroups.reduce((sum, group) => sum + group.variants.length, 0),
    guides: guideRegistry.length,
  })
);
