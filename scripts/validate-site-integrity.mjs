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
assert.equal(htmlFiles.length, 60, 'Static HTML page count');

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

console.log(
  JSON.stringify({
    status: 'SITE_INTEGRITY_VALIDATION_OK',
    htmlPages: htmlFiles.length,
    internalLinks,
    brokenLinks: brokenLinks.length,
    redirectingLinks: redirectingLinks.length,
  })
);
