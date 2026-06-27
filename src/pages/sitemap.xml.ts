import type { APIRoute } from 'astro';

const SITE = 'https://toolkitfree.net';

const pages = [
  // Main pages
  { url: '/', lastmod: '2026-05-20' },
  { url: '/about', lastmod: '2026-05-22' },
  { url: '/terms', lastmod: '2026-05-22' },
  { url: '/privacy-policy', lastmod: '2026-05-20' },
  { url: '/contact', lastmod: '2026-05-22' },

  // Tool pages
  { url: '/tools/image-converter', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer', lastmod: '2026-05-20' },
  { url: '/tools/background-remover', lastmod: '2026-05-20' },
  { url: '/tools/qr-generator', lastmod: '2026-05-23' },
  { url: '/tools/image-cropper', lastmod: '2026-05-23' },
  { url: '/tools/image-to-pdf', lastmod: '2026-05-23' },
  { url: '/tools/favicon-generator', lastmod: '2026-05-23' },

  // Converter variants
  { url: '/tools/image-converter/jpg-to-png', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/png-to-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/webp-to-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/jpg-to-webp', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/png-to-webp', lastmod: '2026-05-20' },
  { url: '/tools/image-converter/webp-to-png', lastmod: '2026-05-20' },

  // Compressor variants
  { url: '/tools/image-compressor/compress-png', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-jpg', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-for-email', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-for-web', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-for-whatsapp', lastmod: '2026-05-20' },
  { url: '/tools/image-compressor/compress-to-100kb', lastmod: '2026-06-27' },

  // Resizer variants
  { url: '/tools/image-resizer/resize-for-instagram', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-facebook', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-twitter', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-youtube', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-linkedin', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-for-tiktok', lastmod: '2026-05-20' },
  { url: '/tools/image-resizer/resize-to-1920x1080', lastmod: '2026-05-20' },

  // Cropper variants
  { url: '/tools/image-cropper/crop-to-square', lastmod: '2026-05-23' },
  { url: '/tools/image-cropper/crop-to-16-9', lastmod: '2026-05-23' },
  { url: '/tools/image-cropper/crop-to-4-3', lastmod: '2026-05-23' },
  { url: '/tools/image-cropper/crop-to-3-2', lastmod: '2026-05-23' },
  { url: '/tools/image-cropper/free-crop', lastmod: '2026-05-23' },

  // PDF variants
  { url: '/tools/image-to-pdf/jpg-to-pdf', lastmod: '2026-05-23' },
  { url: '/tools/image-to-pdf/png-to-pdf', lastmod: '2026-05-23' },
  { url: '/tools/image-to-pdf/image-to-a4-pdf', lastmod: '2026-05-23' },
  { url: '/tools/image-to-pdf/multiple-images-to-pdf', lastmod: '2026-05-23' },
  { url: '/tools/image-to-pdf/image-to-pdf-no-margin', lastmod: '2026-05-23' },
  { url: '/tools/image-to-pdf/photo-to-pdf', lastmod: '2026-05-23' },

  // Favicon variants
  { url: '/tools/favicon-generator/png-to-favicon', lastmod: '2026-05-23' },
  { url: '/tools/favicon-generator/jpg-to-favicon', lastmod: '2026-05-23' },
  { url: '/tools/favicon-generator/logo-to-favicon', lastmod: '2026-05-23' },
  { url: '/tools/favicon-generator/favicon-for-wordpress', lastmod: '2026-05-23' },

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
