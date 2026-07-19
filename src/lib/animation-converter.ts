export type AnimationInputFormat = 'video' | 'gif' | 'webp' | 'apng';
export type AnimationOutputFormat = 'gif' | 'webp' | 'apng';
export type AnimationPreset = 'small' | 'balanced' | 'high';

export interface AnimationConversionSettings {
  outputFormat: AnimationOutputFormat;
  preset: AnimationPreset;
  maxSide: number;
  fps: number;
  quality: number;
  startSeconds: number;
  durationSeconds: number;
  loopCount: number;
}

export interface AnimationResourceBudget {
  maxVideoBytes: number;
  maxAnimationBytes: number;
  maxSourceSeconds: number;
  maxSourceWidth: number;
  maxSourceHeight: number;
  maxClipSeconds: number;
  maxFrames: number;
  maxApngFrames: number;
  maxWebpInputFrames: number;
  maxPixelFrames: number;
  maxOutputBytes: number;
}

export interface AnimationRuntimeCapabilities {
  animatedWebpInput: boolean;
  reason?: string;
}

export interface AnimationMetadata {
  width: number;
  height: number;
  durationSeconds: number;
  frameCount?: number;
}

export const ANIMATION_PRESETS: Record<
  AnimationPreset,
  Pick<AnimationConversionSettings, 'maxSide' | 'fps' | 'quality'>
> = {
  small: { maxSide: 480, fps: 8, quality: 65 },
  balanced: { maxSide: 640, fps: 12, quality: 78 },
  high: { maxSide: 960, fps: 15, quality: 88 },
};

export const DEFAULT_ANIMATION_SETTINGS: AnimationConversionSettings = {
  outputFormat: 'gif',
  preset: 'balanced',
  ...ANIMATION_PRESETS.balanced,
  startSeconds: 0,
  durationSeconds: 6,
  loopCount: 0,
};

export function getAnimationBudget(mobile: boolean): AnimationResourceBudget {
  return mobile
    ? {
        maxVideoBytes: 25 * 1024 * 1024,
        maxAnimationBytes: 15 * 1024 * 1024,
        maxSourceSeconds: 300,
        maxSourceWidth: 3840,
        maxSourceHeight: 2160,
        maxClipSeconds: 20,
        maxFrames: 150,
        maxApngFrames: 100,
        maxWebpInputFrames: 80,
        maxPixelFrames: 60_000_000,
        maxOutputBytes: 80 * 1024 * 1024,
      }
    : {
        maxVideoBytes: 50 * 1024 * 1024,
        maxAnimationBytes: 30 * 1024 * 1024,
        maxSourceSeconds: 300,
        maxSourceWidth: 3840,
        maxSourceHeight: 2160,
        maxClipSeconds: 20,
        maxFrames: 300,
        maxApngFrames: 200,
        maxWebpInputFrames: 150,
        maxPixelFrames: 150_000_000,
        maxOutputBytes: 80 * 1024 * 1024,
      };
}

export function detectAnimationInputFormat(
  file: Pick<File, 'name' | 'type'>
): AnimationInputFormat {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  if (file.type === 'image/gif' || extension === 'gif') return 'gif';
  if (file.type === 'image/webp' || extension === 'webp') return 'webp';
  if (file.type === 'image/apng' || extension === 'apng' || extension === 'png') return 'apng';
  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extension)) {
    return 'video';
  }
  throw new Error('Choose an MP4, WebM, MOV, GIF, animated WebP, or APNG file.');
}

export function hasPngAnimationChunk(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  for (let index = 8; index + 12 <= bytes.length;) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + index, 4).getUint32(0);
    const type = String.fromCharCode(...bytes.subarray(index + 4, index + 8));
    if (type === 'acTL') return true;
    if (type === 'IDAT' || length > bytes.length - index - 12) return false;
    index += length + 12;
  }
  return false;
}

export function hasWebpAnimationChunk(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const ascii = new TextDecoder('latin1').decode(bytes);
  return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP' && ascii.includes('ANIM');
}

export function validateAnimationFileSize(
  file: Pick<File, 'size'>,
  format: AnimationInputFormat,
  budget: AnimationResourceBudget
): void {
  const maxBytes = format === 'video' ? budget.maxVideoBytes : budget.maxAnimationBytes;
  if (file.size > maxBytes) {
    throw new Error(`This file exceeds the ${Math.round(maxBytes / 1024 / 1024)} MiB limit.`);
  }
}

export function validateAnimationWorkload(
  metadata: AnimationMetadata,
  inputFormat: AnimationInputFormat,
  settings: AnimationConversionSettings,
  budget: AnimationResourceBudget
): void {
  if (metadata.durationSeconds > budget.maxSourceSeconds && inputFormat === 'video') {
    throw new Error('The source video is longer than 5 minutes.');
  }
  if (
    Math.max(metadata.width, metadata.height) > budget.maxSourceWidth ||
    Math.min(metadata.width, metadata.height) > budget.maxSourceHeight
  ) {
    throw new Error('The source dimensions exceed 3840 × 2160.');
  }
  if (settings.durationSeconds <= 0 || settings.durationSeconds > budget.maxClipSeconds) {
    throw new Error(`Choose a clip between 0 and ${budget.maxClipSeconds} seconds.`);
  }
  const frames = Math.ceil(settings.durationSeconds * settings.fps);
  const frameLimit = settings.outputFormat === 'apng' ? budget.maxApngFrames : budget.maxFrames;
  if (frames > frameLimit)
    throw new Error(`These settings would create more than ${frameLimit} frames.`);
  if (
    inputFormat === 'webp' &&
    metadata.frameCount &&
    metadata.frameCount > budget.maxWebpInputFrames
  ) {
    throw new Error(
      `This animated WebP exceeds the ${budget.maxWebpInputFrames}-frame input limit.`
    );
  }
  const scale = Math.min(1, settings.maxSide / Math.max(metadata.width, metadata.height));
  const pixels = Math.round(metadata.width * scale) * Math.round(metadata.height * scale) * frames;
  if (pixels > budget.maxPixelFrames) {
    throw new Error(
      'This size, frame rate, and duration combination exceeds the browser memory budget.'
    );
  }
}

export function createAnimationOutputName(name: string, format: AnimationOutputFormat): string {
  const base = name.replace(/\.[^.]+$/, '') || 'animation';
  return `${base}.${format === 'apng' ? 'apng' : format}`;
}

export function buildAnimationFfmpegArgs(
  inputName: string,
  outputName: string,
  inputFormat: AnimationInputFormat,
  settings: AnimationConversionSettings,
  concatInput = false
): string[] {
  const args: string[] = [];
  if (settings.startSeconds > 0) {
    args.push('-ss', settings.startSeconds.toFixed(3));
  }
  if (concatInput) args.push('-f', 'concat', '-safe', '0');
  args.push('-i', inputName);
  if (inputFormat === 'video' || settings.durationSeconds > 0) {
    args.push('-t', settings.durationSeconds.toFixed(3));
  }

  const scale = `scale=${settings.maxSide}:${settings.maxSide}:force_original_aspect_ratio=decrease:force_divisible_by=2`;
  const baseFilter = `fps=${settings.fps},${scale}`;
  const loop = String(Math.max(0, Math.floor(settings.loopCount)));

  if (settings.outputFormat === 'gif') {
    args.push(
      '-filter_complex',
      `[0:v]${baseFilter},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a`,
      '-loop',
      loop,
      '-an',
      outputName
    );
  } else if (settings.outputFormat === 'webp') {
    args.push(
      '-vf',
      `${baseFilter},format=yuva420p`,
      '-c:v',
      'libwebp_anim',
      '-quality',
      String(settings.quality),
      '-compression_level',
      '4',
      '-loop',
      loop,
      '-an',
      '-f',
      'webp',
      outputName
    );
  } else {
    args.push(
      '-vf',
      `${baseFilter},format=rgba`,
      '-c:v',
      'apng',
      '-plays',
      loop,
      '-an',
      '-f',
      'apng',
      outputName
    );
  }
  return args;
}
