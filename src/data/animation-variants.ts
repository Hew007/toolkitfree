import type { ToolVariantSummary } from './content-types';
import type { AnimationOutputFormat } from '../lib/animation-converter';

export interface AnimationVariant extends ToolVariantSummary {
  output: AnimationOutputFormat;
  title: string;
  description: string;
  heading: string;
}

export const allVariants: AnimationVariant[] = [
  {
    slug: 'video-to-webp',
    label: 'Video to Animated WebP',
    output: 'webp',
    title: 'Video to Animated WebP Converter — Free & Local',
    heading: 'Convert Video to Animated WebP',
    description:
      'Turn a short MP4, WebM, or compatible MOV clip into animated WebP locally in your browser. Set duration, frame rate, size, loop count, and quality.',
    indexable: true,
  },
  {
    slug: 'video-to-apng',
    label: 'Video to APNG',
    output: 'apng',
    title: 'Video to APNG Converter — Free & Local',
    heading: 'Convert Video to APNG',
    description:
      'Create a full-color animated PNG from a short video in your browser. Trim the clip, choose a size and frame rate, and keep file processing on your device.',
    indexable: true,
  },
];
