import type { APIRoute } from 'astro';
import { getIndexableToolPaths, SITE_URL } from '../data/tool-registry';

const staticPages = [
  { path: '/', lastModified: '2026-07-04' },
  { path: '/about', lastModified: '2026-05-22' },
  { path: '/terms', lastModified: '2026-05-22' },
  { path: '/privacy-policy', lastModified: '2026-05-20' },
  { path: '/contact', lastModified: '2026-05-22' },
  { path: '/guides/image-format-comparison', lastModified: '2026-05-20' },
  { path: '/guides/reduce-image-size', lastModified: '2026-05-20' },
  { path: '/guides/social-media-image-sizes', lastModified: '2026-05-20' },
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
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastModified}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
