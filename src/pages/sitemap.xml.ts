import type { APIRoute } from 'astro';

const SITE = 'https://toolkitfree.net';

const pages = [
  // Main pages
  { url: '/', lastmod: '2026-05-20' },
  { url: '/privacy-policy', lastmod: '2026-05-20' },

  // Tool pages
  { url: '/tools/image-converter', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer', lastmod: '2026-05-20' },
  { url: '/tools/background-remover', lastmod: '2026-05-20' },

  // Converter variants
  { url: '/tools/image-converter/jpg-to-png', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/png-to-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/webp-to-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/jpg-to-webp', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/png-to-webp', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/webp-to-png', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/heic-to-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/gif-to-png', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/bmp-to-png', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/tiff-to-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/svg-to-png', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/png-to-gif', lastmod: '2026-05-20' },

  // Compressor variants
  { url: '/tools/image-compressor/compress-png', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-for-email', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-for-web', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-for-whatsapp', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-to-100kb', lastmod: '2026-05-20' },

  // Resizer variants
  { url: '/tools/image-resizer/resize-for-instagram', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-facebook', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-twitter', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-youtube', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-linkedin', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-tiktok', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-to-1920x1080', lastmod: '2026-05-20' },

  // Guides
  { url: '/guides/image-format-comparison', lastmod: '2026-05-20' },
  { url: '/guides/reduce-image-size', lastmod: '2026-05-20' },
  { url: '/guides/social-media-image-sizes', lastmod: '2026-05-20' },
];

export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${SITE}${p.url}</loc>
    <lastmod>${p.lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
