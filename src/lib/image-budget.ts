export type ImageBudgetProfile =
  | 'converter'
  | 'compressor'
  | 'resizer'
  | 'cropper'
  | 'pdf'
  | 'favicon'
  | 'background';

export type ImageBudgetDevice = 'desktop' | 'mobile';
export type ImageBudgetLevel = 'safe' | 'warning' | 'blocked';

export interface ImageMetadata {
  name: string;
  size: number;
  type: string;
  width: number | null;
  height: number | null;
  pixels: number | null;
}

export interface ImageBudgetTotals {
  files: number;
  encodedBytes: number;
  knownPixels: number;
  unknownDimensions: number;
  estimatedWorkingBytes: number;
}

export interface ImageBudgetIssue {
  code: 'FILE_COUNT' | 'ENCODED_BYTES' | 'PIXELS' | 'WORKING_MEMORY' | 'SINGLE_IMAGE_PIXELS';
  level: Exclude<ImageBudgetLevel, 'safe'>;
  message: string;
}

export interface ImageBudgetAssessment {
  level: ImageBudgetLevel;
  profile: ImageBudgetProfile;
  device: ImageBudgetDevice;
  totals: ImageBudgetTotals;
  issues: ImageBudgetIssue[];
}

interface BudgetLimits {
  warningFiles: number;
  blockedFiles: number;
  warningEncodedBytes: number;
  blockedEncodedBytes: number;
  warningPixels: number;
  blockedPixels: number;
  warningWorkingBytes: number;
  blockedWorkingBytes: number;
}

const MEBIBYTE = 1024 * 1024;
const MAX_SINGLE_IMAGE_PIXELS = 100_000_000;
const HEADER_BYTES = 64 * 1024;

const LIMITS: Record<ImageBudgetDevice, BudgetLimits> = {
  desktop: {
    warningFiles: 20,
    blockedFiles: 50,
    warningEncodedBytes: 100 * MEBIBYTE,
    blockedEncodedBytes: 250 * MEBIBYTE,
    warningPixels: 80_000_000,
    blockedPixels: 200_000_000,
    warningWorkingBytes: 512 * MEBIBYTE,
    blockedWorkingBytes: 1024 * MEBIBYTE,
  },
  mobile: {
    warningFiles: 10,
    blockedFiles: 25,
    warningEncodedBytes: 40 * MEBIBYTE,
    blockedEncodedBytes: 100 * MEBIBYTE,
    warningPixels: 32_000_000,
    blockedPixels: 80_000_000,
    warningWorkingBytes: 192 * MEBIBYTE,
    blockedWorkingBytes: 384 * MEBIBYTE,
  },
};

const RGBA_SURFACES: Record<ImageBudgetProfile, number> = {
  converter: 2,
  compressor: 3,
  resizer: 2,
  cropper: 2,
  pdf: 3.5,
  favicon: 2,
  background: 4,
};

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function dimensions(width: number, height: number): { width: number; height: number } | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    return null;
  }
  return { width, height };
}

function parsePng(view: DataView, bytes: Uint8Array) {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    readAscii(bytes, 1, 3) === 'PNG' &&
    readAscii(bytes, 12, 4) === 'IHDR'
  ) {
    return dimensions(view.getUint32(16), view.getUint32(20));
  }
  return null;
}

function parseGif(view: DataView, bytes: Uint8Array) {
  if (bytes.length >= 10 && ['GIF87a', 'GIF89a'].includes(readAscii(bytes, 0, 6))) {
    return dimensions(view.getUint16(6, true), view.getUint16(8, true));
  }
  return null;
}

function parseBmp(view: DataView, bytes: Uint8Array) {
  if (bytes.length >= 26 && readAscii(bytes, 0, 2) === 'BM') {
    return dimensions(Math.abs(view.getInt32(18, true)), Math.abs(view.getInt32(22, true)));
  }
  return null;
}

function parseJpeg(view: DataView, bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 2 > bytes.length) break;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (startOfFrame.has(marker) && length >= 7) {
      return dimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
    }
    offset += length;
  }
  return null;
}

function uint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseWebp(view: DataView, bytes: Uint8Array) {
  if (
    bytes.length < 30 ||
    readAscii(bytes, 0, 4) !== 'RIFF' ||
    readAscii(bytes, 8, 4) !== 'WEBP'
  ) {
    return null;
  }
  const chunk = readAscii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return dimensions(uint24(bytes, 24) + 1, uint24(bytes, 27) + 1);
  }
  if (chunk === 'VP8 ' && readAscii(bytes, 23, 3) === String.fromCharCode(0x9d, 0x01, 0x2a)) {
    return dimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const packed = view.getUint32(21, true);
    return dimensions((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1);
  }
  return null;
}

function parseSvg(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes);
  if (!/<svg[\s>]/i.test(text)) return null;
  const svgTag = text.match(/<svg\b[^>]*>/i)?.[0] ?? '';
  const numberAttribute = (name: string) => {
    const value = svgTag.match(new RegExp(`\\b${name}\\s*=\\s*["']\\s*([\\d.]+)`, 'i'))?.[1];
    return value ? Math.round(Number(value)) : null;
  };
  const width = numberAttribute('width');
  const height = numberAttribute('height');
  if (width && height) return dimensions(width, height);
  const viewBox = svgTag.match(/\bviewBox\s*=\s*["'][^"']*?([\d.]+)[,\s]+([\d.]+)\s*["']/i);
  return viewBox ? dimensions(Math.round(Number(viewBox[1])), Math.round(Number(viewBox[2]))) : null;
}

export async function inspectImageMetadata(file: File): Promise<ImageMetadata> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parsed =
    parsePng(view, bytes) ??
    parseJpeg(view, bytes) ??
    parseWebp(view, bytes) ??
    parseGif(view, bytes) ??
    parseBmp(view, bytes) ??
    parseSvg(bytes);
  const pixels = parsed ? parsed.width * parsed.height : null;
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    width: parsed?.width ?? null,
    height: parsed?.height ?? null,
    pixels: Number.isSafeInteger(pixels) ? pixels : null,
  };
}

function formatMebibytes(bytes: number): string {
  return `${Math.round(bytes / MEBIBYTE)} MB`;
}

function issueLevel(value: number, warning: number, blocked: number) {
  if (value > blocked) return 'blocked' as const;
  if (value > warning) return 'warning' as const;
  return null;
}

export function assessImageBudget(
  metadata: readonly ImageMetadata[],
  profile: ImageBudgetProfile,
  device: ImageBudgetDevice
): ImageBudgetAssessment {
  const limits = LIMITS[device];
  const totals: ImageBudgetTotals = {
    files: metadata.length,
    encodedBytes: metadata.reduce((sum, file) => sum + file.size, 0),
    knownPixels: metadata.reduce((sum, file) => sum + (file.pixels ?? 0), 0),
    unknownDimensions: metadata.filter((file) => file.pixels === null).length,
    estimatedWorkingBytes: Math.round(
      metadata.reduce((sum, file) => sum + (file.pixels ?? 0), 0) *
      4 *
      RGBA_SURFACES[profile]
    ),
  };
  const issues: ImageBudgetIssue[] = [];

  const addThresholdIssue = (
    code: ImageBudgetIssue['code'],
    value: number,
    warning: number,
    blocked: number,
    message: (level: 'warning' | 'blocked') => string
  ) => {
    const level = issueLevel(value, warning, blocked);
    if (level) issues.push({ code, level, message: message(level) });
  };

  addThresholdIssue(
    'FILE_COUNT',
    totals.files,
    limits.warningFiles,
    limits.blockedFiles,
    () => `${totals.files} images are selected; use a smaller batch to reduce memory pressure.`
  );
  addThresholdIssue(
    'ENCODED_BYTES',
    totals.encodedBytes,
    limits.warningEncodedBytes,
    limits.blockedEncodedBytes,
    () => `The selected files total ${formatMebibytes(totals.encodedBytes)} before decoding.`
  );
  addThresholdIssue(
    'PIXELS',
    totals.knownPixels,
    limits.warningPixels,
    limits.blockedPixels,
    () => `The selected images contain about ${Math.round(totals.knownPixels / 1_000_000)} million pixels.`
  );
  addThresholdIssue(
    'WORKING_MEMORY',
    totals.estimatedWorkingBytes,
    limits.warningWorkingBytes,
    limits.blockedWorkingBytes,
    () => `This operation may need about ${formatMebibytes(totals.estimatedWorkingBytes)} of working memory.`
  );

  const oversized = metadata.find((file) => (file.pixels ?? 0) > MAX_SINGLE_IMAGE_PIXELS);
  if (oversized) {
    issues.push({
      code: 'SINGLE_IMAGE_PIXELS',
      level: 'blocked',
      message: `${oversized.name} exceeds the 100 million pixel safety limit.`,
    });
  }

  const level = issues.some((issue) => issue.level === 'blocked')
    ? 'blocked'
    : issues.some((issue) => issue.level === 'warning')
      ? 'warning'
      : 'safe';
  return { level, profile, device, totals, issues };
}

export async function reviewImageBudget(
  files: readonly File[],
  profile: ImageBudgetProfile,
  device: ImageBudgetDevice = detectImageBudgetDevice()
): Promise<ImageBudgetAssessment> {
  const metadata = await Promise.all(files.map(inspectImageMetadata));
  return assessImageBudget(metadata, profile, device);
}

export function detectImageBudgetDevice(): ImageBudgetDevice {
  if (typeof window === 'undefined') return 'desktop';
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.innerWidth < 768 || (memory !== undefined && memory <= 4)
    ? 'mobile'
    : 'desktop';
}
