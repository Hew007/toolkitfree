import type { APIRoute } from 'astro';
import { guideSitemapEntries } from '../data/guide-registry';
import { getIndexableToolPaths, toPublicUrl } from '../data/tool-registry';

// These dates are hand-maintained and must match the "Last updated" line the page
// itself shows. They drifted once — the sitemap said May while both policy pages
// said August — so `validate-seo-registry.mjs` now compares them.
const staticPages = [
  { path: '/', lastModified: '2026-07-04' },
  { path: '/about', lastModified: '2026-05-22' },
  { path: '/terms', lastModified: '2026-08-01' },
  { path: '/privacy-policy', lastModified: '2026-08-01' },
  { path: '/contact', lastModified: '2026-05-22' },
  { path: '/guides', lastModified: '2026-08-01' },
  ...guideSitemapEntries,
];

export const GET: APIRoute = () => {
  const pages = [...staticPages, ...getIndexableToolPaths()];
  const urls = pages.map(({ path }) => path);
  if (new Set(urls).size !== urls.length) {
    throw new Error('Duplicate URL detected while generating sitemap.');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    ({ path, lastModified }) => `  <url>
    <loc>${toPublicUrl(path)}</loc>
    <lastmod>${lastModified}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
