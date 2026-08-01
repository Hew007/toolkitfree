import { toPublicPath, toPublicUrl, type ToolId } from './tool-registry.ts';

export type GuideId = 'image-format-comparison' | 'reduce-image-size' | 'social-media-image-sizes';

export interface GuideDefinition {
  id: GuideId;
  title: string;
  href: `/guides/${string}`;
  description: string;
  lastModified: string;
  relatedTools: readonly ToolId[];
}

export const guideRegistry: readonly GuideDefinition[] = [
  {
    id: 'image-format-comparison',
    title: 'JPG vs PNG vs WebP',
    href: '/guides/image-format-comparison',
    description: 'Compare common image formats and choose the right balance of quality and size.',
    lastModified: '2026-08-01',
    relatedTools: ['image-converter', 'image-compressor'],
  },
  {
    id: 'reduce-image-size',
    title: 'How to Reduce Image File Size',
    href: '/guides/reduce-image-size',
    description:
      'Learn practical ways to reduce image size while controlling the quality tradeoff.',
    lastModified: '2026-08-01',
    relatedTools: ['image-converter', 'image-compressor', 'image-resizer'],
  },
  {
    id: 'social-media-image-sizes',
    title: 'Social Media Image Sizes',
    href: '/guides/social-media-image-sizes',
    description:
      'Find practical image dimensions for major social platforms and common placements.',
    lastModified: '2026-08-01',
    relatedTools: ['image-resizer', 'image-cropper'],
  },
];

export function getGuide(id: GuideId): GuideDefinition {
  const guide = guideRegistry.find((entry) => entry.id === id);
  if (!guide) throw new Error(`Unknown guide id: ${id}`);
  return guide;
}

export function getGuidesForTool(toolId: ToolId): readonly GuideDefinition[] {
  return guideRegistry.filter((guide) => guide.relatedTools.includes(toolId));
}

export const guideSitemapEntries = guideRegistry.map((guide) => ({
  path: guide.href,
  lastModified: guide.lastModified,
}));

export function getGuidePublicPath(guide: GuideDefinition): string {
  return toPublicPath(guide.href);
}

export function getGuidePublicUrl(guide: GuideDefinition): string {
  return toPublicUrl(guide.href);
}
