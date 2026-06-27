import type { ImageOutputMimeType } from './image-processing';

export type ConverterInputLabel = 'JPG' | 'PNG' | 'WebP' | 'GIF' | 'BMP' | 'SVG';
export type ConverterOutputLabel = 'JPG' | 'PNG' | 'WebP';

export interface ConverterInputConfig {
  accept: string;
  allowedTypes: readonly string[];
  hint: string;
}

export const OUTPUT_FORMAT_LABELS: Record<ImageOutputMimeType, ConverterOutputLabel> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
};

export const OUTPUT_FORMAT_EXTENSIONS: Record<ImageOutputMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const OUTPUT_LABEL_TO_MIME: Record<ConverterOutputLabel, ImageOutputMimeType> = {
  JPG: 'image/jpeg',
  PNG: 'image/png',
  WebP: 'image/webp',
};

const DEFAULT_INPUT_CONFIG: ConverterInputConfig = {
  accept: 'image/jpeg,image/png,image/webp',
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  hint: 'JPG, PNG, or WebP',
};

const INPUT_CONFIGS: Record<ConverterInputLabel, ConverterInputConfig> = {
  JPG: {
    accept: 'image/jpeg',
    allowedTypes: ['image/jpeg'],
    hint: 'JPG or JPEG',
  },
  PNG: {
    accept: 'image/png',
    allowedTypes: ['image/png'],
    hint: 'PNG',
  },
  WebP: {
    accept: 'image/webp',
    allowedTypes: ['image/webp'],
    hint: 'WebP',
  },
  GIF: {
    accept: 'image/gif',
    allowedTypes: ['image/gif'],
    hint: 'GIF (one static frame; browser-dependent)',
  },
  BMP: {
    accept: 'image/bmp,image/x-ms-bmp',
    allowedTypes: ['image/bmp', 'image/x-ms-bmp'],
    hint: 'BMP (browser-dependent)',
  },
  SVG: {
    accept: 'image/svg+xml',
    allowedTypes: ['image/svg+xml'],
    hint: 'SVG (browser-dependent)',
  },
};

export function getConverterInputConfig(label?: string): ConverterInputConfig {
  if (!label) return DEFAULT_INPUT_CONFIG;
  const config = INPUT_CONFIGS[label as ConverterInputLabel];
  if (!config) throw new Error(`Unsupported converter input label: ${label}`);
  return config;
}

export function getConverterOutputMime(label?: string): ImageOutputMimeType {
  if (!label) return 'image/png';
  const mime = OUTPUT_LABEL_TO_MIME[label as ConverterOutputLabel];
  if (!mime) throw new Error(`Unsupported converter output label: ${label}`);
  return mime;
}

export function createUniqueOutputNames(
  sourceNames: readonly string[],
  outputType: ImageOutputMimeType
): string[] {
  const extension = OUTPUT_FORMAT_EXTENSIONS[outputType];
  const used = new Set<string>();

  return sourceNames.map((sourceName) => {
    const rawBase = sourceName.replace(/\.[^.]+$/, '') || 'image';
    let suffix = 1;
    let candidate = `${rawBase}${extension}`;

    while (used.has(candidate.toLocaleLowerCase('en-US'))) {
      suffix += 1;
      candidate = `${rawBase}-${suffix}${extension}`;
    }

    used.add(candidate.toLocaleLowerCase('en-US'));
    return candidate;
  });
}
