import type { APIRoute } from 'astro';

const SITE = 'https://shareeverything.com';

const pages = [
  { url: '/', changefreq: 'weekly', priority: '1.0' },
  { url: '/tools/image-converter', changefreq: 'weekly', priority: '0.9' },
  { url: '/tools/image-compressor', changefreq: 'weekly', priority: '0.9' },
  { url: '/tools/image-resizer', changefreq: 'weekly', priority: '0.9' },
  { url: '/tools/background-remover', changefreq: 'weekly', priority: '0.9' },
  // Converter variants - high SEO value pages
  { url: '/tools/image-converter/jpg-to-png', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/png-to-jpg', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/webp-to-jpg', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/jpg-to-webp', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/png-to-webp', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/webp-to-png', changefreq: 'monthly', priority: '0.8' },
];

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${SITE}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
