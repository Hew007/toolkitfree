import { allVariants as compressorVariants } from './compressor-variants.ts';
import { allVariants as converterVariants } from './converter-variants.ts';
import { allVariants as cropperVariants } from './cropper-variants.ts';
import { allVariants as faviconVariants } from './favicon-variants.ts';
import { allVariants as pdfVariants } from './pdf-variants.ts';
import { allVariants as resizerVariants } from './resizer-variants.ts';
import type { ToolVariantSummary } from './content-types.ts';

export const SITE_URL = 'https://toolkitfree.net';
export const SITE_LOCALE = 'en';

export function toPublicPath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`Public paths must start with "/": ${path}`);
  }
  if (path === '/') return '/';
  return `${path.replace(/\/+$/, '')}/`;
}

export function toPublicUrl(path: string): string {
  return `${SITE_URL}${toPublicPath(path)}`;
}

export type ToolId =
  | 'image-converter'
  | 'image-compressor'
  | 'image-resizer'
  | 'image-enhancer'
  | 'image-collage'
  | 'id-photo-maker'
  | 'image-cropper'
  | 'background-remover'
  | 'image-to-pdf'
  | 'favicon-generator'
  | 'qr-generator';

export type ToolCategory = 'image-tools' | 'create-export';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  navLabel: string;
  href: `/tools/${string}`;
  description: string;
  shortDescription: string;
  category: ToolCategory;
  status: 'public';
  lastModified: string;
  related: readonly ToolId[];
  variants: readonly ToolVariantSummary[];
}

export const toolCategories: ReadonlyArray<{
  id: ToolCategory;
  label: string;
}> = [
  { id: 'image-tools', label: 'Image tools' },
  { id: 'create-export', label: 'Create & export' },
];

export const toolRegistry: readonly ToolDefinition[] = [
  {
    id: 'image-converter',
    name: 'Image Converter',
    navLabel: 'Converter',
    href: '/tools/image-converter',
    description:
      'Convert JPG, PNG, and WebP images in your browser, with clearly labeled browser-dependent inputs.',
    shortDescription: 'Convert between JPG, PNG, and WebP.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'image-compressor',
      'image-resizer',
      'image-enhancer',
      'image-cropper',
      'background-remover',
      'qr-generator',
    ],
    variants: converterVariants,
  },
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    navLabel: 'Compressor',
    href: '/tools/image-compressor',
    description:
      'Re-encode or resize images and compare the actual result; smaller output is not guaranteed.',
    shortDescription: 'Reduce quality or dimensions and inspect the result.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'image-converter',
      'image-resizer',
      'image-enhancer',
      'image-cropper',
      'background-remover',
      'qr-generator',
    ],
    variants: compressorVariants,
  },
  {
    id: 'image-resizer',
    name: 'Image Resizer',
    navLabel: 'Resizer',
    href: '/tools/image-resizer',
    description:
      'Resize images to custom dimensions or verified platform presets while controlling aspect ratio.',
    shortDescription: 'Resize images to custom or platform dimensions.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'image-cropper',
      'image-enhancer',
      'image-compressor',
      'image-converter',
      'background-remover',
      'qr-generator',
    ],
    variants: resizerVariants,
  },
  {
    id: 'image-enhancer',
    name: 'Image Enhancer',
    navLabel: 'Enhancer',
    href: '/tools/image-enhancer',
    description:
      'Adjust brightness, contrast, saturation, sharpness, blur, and grayscale locally with a live preview.',
    shortDescription: 'Adjust and preview image appearance locally.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-06',
    related: [
      'image-converter',
      'image-compressor',
      'image-resizer',
      'image-cropper',
      'background-remover',
    ],
    variants: [],
  },
  {
    id: 'image-collage',
    name: 'Image Collage Maker',
    navLabel: 'Collage Maker',
    href: '/tools/image-collage',
    description:
      'Combine JPG, PNG, or WebP images into a grid, side-by-side stitch, or vertical collage locally in your browser.',
    shortDescription: 'Combine images into a grid or stitched collage.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-10',
    related: [
      'image-cropper',
      'image-resizer',
      'image-enhancer',
      'image-compressor',
      'image-converter',
      'image-to-pdf',
    ],
    variants: [],
  },
  {
    id: 'id-photo-maker',
    name: 'ID Photo Size & Print Tool',
    navLabel: 'ID Photo',
    href: '/tools/id-photo-maker',
    description:
      'Manually position an original photo, export a selected ID photo size, and make a local print sheet without claiming government approval.',
    shortDescription: 'Prepare a custom-size ID photo and print sheet locally.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-13',
    related: [
      'image-cropper',
      'image-resizer',
      'image-to-pdf',
      'image-converter',
      'image-compressor',
    ],
    variants: [],
  },
  {
    id: 'image-cropper',
    name: 'Image Cropper',
    navLabel: 'Cropper',
    href: '/tools/image-cropper',
    description: 'Crop one JPG, PNG, or WebP with visual, touch, and keyboard controls.',
    shortDescription: 'Crop images with bounded visual controls.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-10',
    related: [
      'image-resizer',
      'image-enhancer',
      'image-converter',
      'image-compressor',
      'image-to-pdf',
      'background-remover',
      'id-photo-maker',
    ],
    variants: cropperVariants,
  },
  {
    id: 'background-remover',
    name: 'Background Remover',
    navLabel: 'Background Remover',
    href: '/tools/background-remover',
    description:
      'Remove one image background locally after downloading the browser AI model and runtime.',
    shortDescription: 'Remove image backgrounds with a local browser model.',
    category: 'image-tools',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'image-cropper',
      'image-resizer',
      'image-enhancer',
      'image-compressor',
      'image-converter',
      'qr-generator',
    ],
    variants: [],
  },
  {
    id: 'image-to-pdf',
    name: 'Image to PDF',
    navLabel: 'Image to PDF',
    href: '/tools/image-to-pdf',
    description:
      'Combine ordered JPG, PNG, or WebP images into a PDF with page size, orientation, and margin controls.',
    shortDescription: 'Combine images into a configurable PDF.',
    category: 'create-export',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'image-converter',
      'image-compressor',
      'image-cropper',
      'image-resizer',
      'favicon-generator',
    ],
    variants: pdfVariants,
  },
  {
    id: 'favicon-generator',
    name: 'Favicon Generator',
    navLabel: 'Favicon Generator',
    href: '/tools/favicon-generator',
    description: 'Generate five PNG favicon sizes and a site.webmanifest from one image.',
    shortDescription: 'Create standard PNG favicon sizes and a manifest.',
    category: 'create-export',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'image-resizer',
      'image-cropper',
      'image-converter',
      'image-compressor',
      'image-to-pdf',
    ],
    variants: faviconVariants,
  },
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    navLabel: 'QR Generator',
    href: '/tools/qr-generator',
    description:
      'Create PNG or SVG QR codes for text, URLs, WiFi, and vCards with contrast-aware downloads.',
    shortDescription: 'Create customizable PNG or SVG QR codes.',
    category: 'create-export',
    status: 'public',
    lastModified: '2026-07-04',
    related: [
      'favicon-generator',
      'image-to-pdf',
      'image-converter',
      'image-resizer',
      'background-remover',
    ],
    variants: [],
  },
] as const;

const toolById = new Map(toolRegistry.map((tool) => [tool.id, tool]));

export function getTool(id: ToolId): ToolDefinition {
  const tool = toolById.get(id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
}

export function getRelatedTools(id: ToolId): ToolDefinition[] {
  return getTool(id).related.map(getTool);
}

export function getOtherTools(id: ToolId): ToolDefinition[] {
  return toolRegistry.filter((tool) => tool.id !== id);
}

export const navigationGroups = toolCategories.map((category) => ({
  label: category.label,
  links: toolRegistry
    .filter((tool) => tool.category === category.id)
    .map((tool) => ({ id: tool.id, href: tool.href, label: tool.navLabel })),
}));

export function getIndexableToolPaths(): Array<{
  path: string;
  lastModified: string;
}> {
  return toolRegistry.flatMap((tool) => [
    { path: tool.href, lastModified: tool.lastModified },
    ...tool.variants
      .filter((variant) => variant.indexable !== false)
      .map((variant) => ({
        path: `${tool.href}/${variant.slug}`,
        lastModified: tool.lastModified,
      })),
  ]);
}
