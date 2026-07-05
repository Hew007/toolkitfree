export const RESIZE_PRESETS = {
  custom: { width: 800, height: 600, label: 'Custom' },
  instagram_post: { width: 1080, height: 1080, label: 'Instagram Post (1080x1080)' },
  instagram_story: { width: 1080, height: 1920, label: 'Instagram Story (1080x1920)' },
  facebook_cover: { width: 820, height: 312, label: 'Facebook Cover (820x312)' },
  twitter_header: { width: 1500, height: 500, label: 'Twitter/X Header (1500x500)' },
  youtube_thumbnail: { width: 1280, height: 720, label: 'YouTube Thumbnail (1280x720)' },
  linkedin_post: { width: 1200, height: 627, label: 'LinkedIn Post (1200x627)' },
  tiktok_cover: { width: 1080, height: 1920, label: 'TikTok Cover (1080x1920)' },
  full_hd: { width: 1920, height: 1080, label: 'Full HD (1920x1080)' },
  hd: { width: 1280, height: 720, label: 'HD (1280x720)' },
  thumbnail: { width: 300, height: 300, label: 'Thumbnail (300x300)' },
} as const;

export type ResizePresetKey = keyof typeof RESIZE_PRESETS;

export const RESIZER_VARIANT_PRESETS = {
  'resize-for-instagram': 'instagram_post',
  'resize-for-facebook': 'facebook_cover',
  'resize-for-twitter': 'twitter_header',
  'resize-for-youtube': 'youtube_thumbnail',
  'resize-for-linkedin': 'linkedin_post',
  'resize-for-tiktok': 'tiktok_cover',
  'resize-to-1920x1080': 'full_hd',
} as const satisfies Record<string, Exclude<ResizePresetKey, 'custom'>>;

export type ResizerVariantSlug = keyof typeof RESIZER_VARIANT_PRESETS;

export interface ResizeDimensions {
  width: number;
  height: number;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return Math.max(1, Math.round(value));
}

export function calculateResizeDimensions(
  source: ResizeDimensions,
  requested: ResizeDimensions,
  maintainAspectRatio: boolean
): ResizeDimensions {
  const sourceWidth = positiveInteger(source.width, 'Source width');
  const sourceHeight = positiveInteger(source.height, 'Source height');
  const requestedWidth = positiveInteger(requested.width, 'Requested width');
  const requestedHeight = positiveInteger(requested.height, 'Requested height');

  if (!maintainAspectRatio) {
    return { width: requestedWidth, height: requestedHeight };
  }

  const scale = Math.min(requestedWidth / sourceWidth, requestedHeight / sourceHeight);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
