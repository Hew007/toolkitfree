import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(target) : [target];
  });
}

function routeFile(route) {
  const pathname = route.split(/[?#]/, 1)[0];
  if (pathname === '/') return path.join(dist, 'index.html');
  if (path.extname(pathname)) return path.join(dist, pathname.slice(1));
  return path.join(dist, pathname.slice(1), 'index.html');
}

assert.equal(fs.existsSync(dist), true, 'Run the production build before site validation');
const files = collectFiles(dist);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
assert.equal(htmlFiles.length, 72, 'Static HTML page count');

const brokenLinks = [];
const redirectingLinks = [];
let internalLinks = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    internalLinks += 1;
    const pathname = href.split(/[?#]/, 1)[0];
    if (pathname !== '/' && !path.extname(pathname) && !pathname.endsWith('/')) {
      redirectingLinks.push({
        from: path.relative(dist, file).replaceAll('\\', '/'),
        href,
      });
    }
    const target = routeFile(href);
    if (!fs.existsSync(target)) {
      brokenLinks.push({
        from: path.relative(dist, file).replaceAll('\\', '/'),
        href,
      });
    }
  }
}
assert.deepEqual(brokenLinks, [], 'Internal links must resolve to build output');
assert.deepEqual(redirectingLinks, [], 'Internal page links must use trailing slashes');

const robots = fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8');
assert.match(robots, /Sitemap:\s*https:\/\/toolkitfree\.net\/sitemap\.xml/i);
assert.equal(fs.existsSync(path.join(dist, 'sitemap.xml')), true);
assert.equal(fs.existsSync(path.join(dist, '_headers')), true);
assert.equal(fs.existsSync(path.join(dist, 'llms.txt')), true);
assert.equal(fs.existsSync(path.join(dist, 'llms-full.txt')), true);

/**
 * Parses a Cloudflare `_headers` file into `{ pattern, headers }` rules. Only the
 * syntax this site uses is supported: `#` comments, unindented URL patterns with
 * `*` splats, and indented `Name: value` lines.
 */
function parseHeadersFile(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const source = line
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('*', '.*');
      rules.push({ pattern: line.trim(), matcher: new RegExp(`^${source}$`), headers: [] });
      continue;
    }
    const separator = line.indexOf(':');
    assert.ok(rules.length && separator > 0, `Malformed _headers line: ${line}`);
    rules
      .at(-1)
      .headers.push([
        line.slice(0, separator).trim().toLowerCase(),
        line.slice(separator + 1).trim(),
      ]);
  }
  return rules;
}

/** Every value each header would carry for `pathname`, across all matching rules. */
function headersFor(rules, pathname) {
  const values = {};
  for (const rule of rules.filter(({ matcher }) => matcher.test(pathname))) {
    for (const [name, value] of rule.headers) (values[name] ??= []).push(value);
  }
  return values;
}

// Background Remover is cross-origin isolated for multi-threaded inference, which
// only works if the page gets each policy exactly once (twice joins into an invalid
// value and silently disables isolation) AND the worker script carries COEP too
// (without it Chromium refuses to start the worker, and the tool fails outright).
// Both mistakes have shipped; see the comment in public/_headers.
const headerRules = parseHeadersFile(fs.readFileSync(path.join(dist, '_headers'), 'utf8'));
for (const pathname of ['/tools/background-remover/', '/tools/background-remover/index.html']) {
  const values = headersFor(headerRules, pathname);
  assert.deepEqual(values['cross-origin-opener-policy'], ['same-origin'], `COOP for ${pathname}`);
  assert.deepEqual(
    values['cross-origin-embedder-policy'],
    ['require-corp'],
    `COEP for ${pathname}`
  );
}
const astroFiles = fs.readdirSync(path.join(dist, '_astro'));
const backgroundWorkers = astroFiles.filter((name) =>
  /^background-removal\.worker-.+\.js$/.test(name)
);
assert.equal(backgroundWorkers.length, 1, 'Exactly one Background Remover worker chunk');
assert.deepEqual(
  headersFor(headerRules, `/_astro/${backgroundWorkers[0]}`)['cross-origin-embedder-policy'],
  ['require-corp'],
  'The Background Remover worker script must carry COEP exactly once, or the isolated page cannot start it'
);
for (const name of astroFiles.filter(
  (file) => /worker/.test(file) && !backgroundWorkers.includes(file)
)) {
  assert.equal(
    headersFor(headerRules, `/_astro/${name}`)['cross-origin-embedder-policy'],
    undefined,
    `Only the Background Remover worker is isolated, not ${name}`
  );
}

console.log(
  JSON.stringify({
    status: 'SITE_INTEGRITY_VALIDATION_OK',
    htmlPages: htmlFiles.length,
    internalLinks,
    brokenLinks: brokenLinks.length,
    redirectingLinks: redirectingLinks.length,
  })
);
