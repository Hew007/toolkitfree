import type { APIRoute } from 'astro';

// TODO: Replace with your actual domain after registration
const SITE = 'https://toolkitfree.net';

const pages = [
  // Main pages
  { url: '/', changefreq: 'weekly', priority: '1.0' },
  { url: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },

  // Tool pages
  { url: '/tools/image-converter', changefreq: 'weekly', priority: '0.9' },
  { url: '/tools/image-compressor', changefreq: 'weekly', priority: '0.9' },
  { url: '/tools/image-resizer', changefreq: 'weekly', priority: '0.9' },
  { url: '/tools/background-remover', changefreq: 'weekly', priority: '0.9' },

  // Converter variants
  { url: '/tools/image-converter/jpg-to-png', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/png-to-jpg', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/webp-to-jpg', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/jpg-to-webp', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/png-to-webp', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-converter/webp-to-png', changefreq: 'monthly', priority: '0.8' },

  // Compressor variants
  { url: '/tools/image-compressor/compress-png', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-compressor/compress-jpg', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-compressor/compress-for-email', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-compressor/compress-for-web', changefreq: 'monthly', priority: '0.8' },

  // Resizer variants
  { url: '/tools/image-resizer/resize-for-instagram', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-resizer/resize-for-facebook', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-resizer/resize-for-twitter', changefreq: 'monthly', priority: '0.8' },
  { url: '/tools/image-resizer/resize-for-youtube', changefreq: 'monthly', priority: '0.8' },
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
