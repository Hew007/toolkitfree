import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getIndexableToolPaths,
  SITE_LOCALE,
  SITE_URL,
  toolCategories,
  toolRegistry,
} from '../src/data/tool-registry.ts';

const root = process.cwd();
const dist = path.join(root, 'dist');
const staticPaths = [
  '/',
  '/about',
  '/terms',
  '/privacy-policy',
  '/contact',
  '/guides/image-format-comparison',
  '/guides/reduce-image-size',
  '/guides/social-media-image-sizes',
];

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function normalizeRoute(value) {
  const route = value.replace(/\/+$/, '');
  return route || '/';
}

function collectHtml(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectHtml(target);
    return entry.name.endsWith('.html') ? [target] : [];
  });
}

function routeFromFile(file) {
  const relative = path.relative(dist, file).replaceAll('\\', '/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'/index.html'.length)}`;
  return `/${relative.slice(0, -'.html'.length)}`;
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractToolIds(fragment) {
  return [...fragment.matchAll(/data-tool-id="([^"]+)"/g)].map((match) => match[1]);
}

unique(
  toolRegistry.map((tool) => tool.id),
  'Tool ids'
);
unique(
  toolRegistry.map((tool) => tool.href),
  'Tool hrefs'
);
assert.equal(
  toolRegistry.every((tool) => tool.status === 'public'),
  true
);

const categoryIds = new Set(toolCategories.map((category) => category.id));
const registryIds = new Set(toolRegistry.map((tool) => tool.id));
for (const tool of toolRegistry) {
  assert.equal(categoryIds.has(tool.category), true, `${tool.id} category`);
  assert.equal(tool.related.includes(tool.id), false, `${tool.id} cannot relate to itself`);
  assert.equal(
    tool.related.every((id) => registryIds.has(id)),
    true,
    `${tool.id} related ids`
  );
  unique(
    tool.variants.map((variant) => variant.slug),
    `${tool.id} variant slugs`
  );
}

const indexableToolPaths = getIndexableToolPaths().map(({ path: route }) => route);
unique(indexableToolPaths, 'Indexable tool paths');

for (const file of ['public/llms.txt', 'public/llms-full.txt']) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const tool of toolRegistry) {
    assert.equal(content.includes(`${SITE_URL}${tool.href}`), true, `${file} includes ${tool.id}`);
  }
}

assert.equal(fs.existsSync(dist), true, 'Run the production build before SEO validation');
const htmlFiles = collectHtml(dist);
const pages = htmlFiles
  .map((file) => ({ file, route: routeFromFile(file), html: fs.readFileSync(file, 'utf8') }))
  .filter(({ route }) => route !== '/404');

const actualIndexableRoutes = pages
  .filter(({ html }) => !/<meta name="robots" content="noindex, follow"\s*\/?>/.test(html))
  .map(({ route }) => route)
  .sort();
const expectedIndexableRoutes = [...staticPaths, ...indexableToolPaths].sort();
assert.deepEqual(actualIndexableRoutes, expectedIndexableRoutes, 'Indexable HTML routes');

const sitemap = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => normalizeRoute(new URL(match[1]).pathname))
  .sort();
unique(sitemapRoutes, 'Sitemap routes');
assert.deepEqual(sitemapRoutes, expectedIndexableRoutes, 'Sitemap and indexable HTML');

let jsonLdBlocks = 0;
let webApplications = 0;
let faqPages = 0;
for (const { route, html } of pages) {
  const canonicalMatches = [...html.matchAll(/<link rel="canonical" href="([^"]+)"\s*\/?>/g)];
  assert.equal(canonicalMatches.length, 1, `${route} canonical count`);
  const canonical = new URL(canonicalMatches[0][1]);
  assert.equal(canonical.origin, SITE_URL, `${route} canonical origin`);
  assert.equal(normalizeRoute(canonical.pathname), route, `${route} canonical path`);
  assert.equal(/hreflang=/i.test(html), false, `${route} must not publish unavailable locales`);
  assert.equal(html.includes(`<html lang="${SITE_LOCALE}">`), true, `${route} language`);

  const schemas = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((match) => JSON.parse(match[1]));
  jsonLdBlocks += schemas.length;
  const flattened = schemas.flatMap((schema) => (Array.isArray(schema) ? schema : [schema]));
  for (const webApp of flattened.filter((schema) => schema?.['@type'] === 'WebApplication')) {
    webApplications += 1;
    assert.equal(
      typeof webApp.name === 'string' && webApp.name.length > 0,
      true,
      `${route} WebApplication name`
    );
    assert.equal(
      typeof webApp.description === 'string' && webApp.description.length > 0,
      true,
      `${route} WebApplication description`
    );
    const schemaUrl = new URL(webApp.url);
    assert.equal(schemaUrl.origin, SITE_URL, `${route} WebApplication URL origin`);
    assert.equal(normalizeRoute(schemaUrl.pathname), route, `${route} WebApplication URL path`);
  }
  const faq = flattened.find((schema) => schema?.['@type'] === 'FAQPage');
  const visibleFaq = [...html.matchAll(/<summary class="faq-question">([\s\S]*?)<\/summary>/g)].map(
    (match) => decodeHtml(match[1])
  );
  if (faq) {
    faqPages += 1;
    assert.deepEqual(
      faq.mainEntity.map((entry) => entry.name),
      visibleFaq,
      `${route} visible FAQ and JSON-LD`
    );
  } else {
    assert.equal(visibleFaq.length, 0, `${route} visible FAQ requires JSON-LD`);
  }
}

const home = pages.find(({ route }) => route === '/')?.html;
assert.ok(home);
assert.deepEqual(
  extractToolIds(home.match(/<section class="tools-grid">([\s\S]*?)<\/section>/)?.[1] ?? ''),
  [...registryIds]
);

const layoutSample = pages.find(({ route }) => route === '/tools/image-converter')?.html;
assert.ok(layoutSample);
const nav = layoutSample.match(/<nav id="primary-navigation"[\s\S]*?<\/nav>/)?.[0] ?? '';
const footer =
  layoutSample.match(
    /<div class="footer-links" data-tool-directory="footer">[\s\S]*?<\/div>/
  )?.[0] ?? '';
assert.deepEqual(extractToolIds(nav), [...registryIds]);
assert.deepEqual(extractToolIds(footer), [...registryIds]);

console.log(
  JSON.stringify({
    status: 'SEO_REGISTRY_VALIDATION_OK',
    tools: toolRegistry.length,
    variants: toolRegistry.reduce((sum, tool) => sum + tool.variants.length, 0),
    indexableRoutes: expectedIndexableRoutes.length,
    htmlPages: pages.length,
    jsonLdBlocks,
    webApplications,
    faqPages,
    locale: SITE_LOCALE,
  })
);
