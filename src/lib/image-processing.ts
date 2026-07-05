export const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
export type ImageOutputMimeType = SupportedImageMimeType;

export type ImageProcessingErrorCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'DECODE_FAILED'
  | 'INVALID_DIMENSIONS'
  | 'PIXEL_LIMIT_EXCEEDED'
  | 'CANVAS_CONTEXT_UNAVAILABLE'
  | 'EXPORT_FAILED'
  | 'OUTPUT_TYPE_MISMATCH'
  | 'INVALID_FILE_SIZE'
  | 'DOWNLOAD_FAILED';

export class ImageProcessingError extends Error {
  readonly code: ImageProcessingErrorCode;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ImageProcessingErrorCode,
    message: string,
    options: { cause?: unknown; details?: Record<string, unknown> } = {}
  ) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
    this.cause = options.cause;
    this.details = options.details;
  }
}

export interface ImageFileLike {
  name: string;
  size: number;
  type: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
  pixels: number;
}

export interface ValidateImageFileOptions {
  allowedTypes?: readonly string[];
  maxBytes?: number;
}

export interface ValidateDimensionsOptions {
  maxPixels?: number;
}

export const DEFAULT_MAX_IMAGE_PIXELS = 100_000_000;

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new ImageProcessingError(
      'INVALID_FILE_SIZE',
      'File size must be a non-negative finite number.'
    );
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateImageFile(
  file: ImageFileLike,
  options: ValidateImageFileOptions = {}
): void {
  if (file.size <= 0) {
    throw new ImageProcessingError('EMPTY_FILE', `${file.name || 'The file'} is empty.`);
  }

  const allowedTypes = options.allowedTypes ?? SUPPORTED_IMAGE_MIME_TYPES;
  if (!allowedTypes.includes(file.type)) {
    throw new ImageProcessingError(
      'UNSUPPORTED_FILE_TYPE',
      `${file.name || 'The file'} is not a supported image type.`,
      { details: { actualType: file.type || 'unknown', allowedTypes } }
    );
  }

  if (options.maxBytes !== undefined && file.size > options.maxBytes) {
    throw new ImageProcessingError(
      'INVALID_FILE_SIZE',
      `${file.name || 'The file'} exceeds the allowed size.`,
      { details: { actualBytes: file.size, maxBytes: options.maxBytes } }
    );
  }
}

export function validateImageDimensions(
  width: number,
  height: number,
  options: ValidateDimensionsOptions = {}
): ImageDimensions {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new ImageProcessingError(
      'INVALID_DIMENSIONS',
      'The decoded image has invalid dimensions.',
      { details: { width, height } }
    );
  }

  const pixels = width * height;
  const maxPixels = options.maxPixels ?? DEFAULT_MAX_IMAGE_PIXELS;
  if (!Number.isSafeInteger(pixels) || pixels > maxPixels) {
    throw new ImageProcessingError(
      'PIXEL_LIMIT_EXCEEDED',
      `The image exceeds the ${maxPixels.toLocaleString()} pixel safety limit.`,
      { details: { width, height, pixels, maxPixels } }
    );
  }

  return { width, height, pixels };
}

interface ObjectUrlApi {
  createObjectURL(value: Blob | MediaSource): string;
  revokeObjectURL(url: string): void;
}

export interface ObjectUrlHandle {
  readonly url: string;
  revoke(): void;
}

export function createObjectUrlHandle(
  value: Blob | MediaSource,
  urlApi: ObjectUrlApi = URL
): ObjectUrlHandle {
  const url = urlApi.createObjectURL(value);
  let revoked = false;

  return {
    url,
    revoke() {
      if (revoked) return;
      revoked = true;
      urlApi.revokeObjectURL(url);
    },
  };
}

export class ObjectUrlRegistry {
  private readonly handles = new Map<string, ObjectUrlHandle>();
  private readonly urlApi: ObjectUrlApi;

  constructor(urlApi: ObjectUrlApi = URL) {
    this.urlApi = urlApi;
  }

  replace(key: string, value: Blob | MediaSource): string {
    this.revoke(key);
    const handle = createObjectUrlHandle(value, this.urlApi);
    this.handles.set(key, handle);
    return handle.url;
  }

  revoke(key: string): void {
    const handle = this.handles.get(key);
    if (!handle) return;
    handle.revoke();
    this.handles.delete(key);
  }

  revokePrefix(prefix: string): void {
    for (const key of [...this.handles.keys()]) {
      if (key.startsWith(prefix)) this.revoke(key);
    }
  }

  revokeAll(): void {
    for (const key of [...this.handles.keys()]) this.revoke(key);
  }

  get size(): number {
    return this.handles.size;
  }
}

interface DecodableImage {
  onload: null | (() => void);
  onerror: null | ((event?: unknown) => void);
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface LoadImageOptions extends ValidateImageFileOptions, ValidateDimensionsOptions {
  imageFactory?: () => DecodableImage;
  urlApi?: ObjectUrlApi;
}

export async function loadImage(
  file: Blob & ImageFileLike,
  options: LoadImageOptions = {}
): Promise<HTMLImageElement> {
  validateImageFile(file, options);

  const image = options.imageFactory?.() ?? new Image();
  const handle = createObjectUrlHandle(file, options.urlApi);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = (cause: unknown) =>
        reject(
          new ImageProcessingError(
            'DECODE_FAILED',
            `${file.name || 'The image'} could not be decoded.`,
            { cause }
          )
        );
      image.src = handle.url;
    });

    validateImageDimensions(image.naturalWidth, image.naturalHeight, options);
    return image as HTMLImageElement;
  } finally {
    handle.revoke();
  }
}

interface CanvasExportLike {
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

export async function exportCanvas(
  canvas: CanvasExportLike,
  type: ImageOutputMimeType,
  quality?: number
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

  if (!blob) {
    throw new ImageProcessingError('EXPORT_FAILED', 'The browser could not export this image.');
  }
  if (blob.type !== type) {
    throw new ImageProcessingError(
      'OUTPUT_TYPE_MISMATCH',
      `The browser returned ${blob.type || 'an unknown format'} instead of ${type}.`,
      { details: { requestedType: type, actualType: blob.type || 'unknown' } }
    );
  }

  return blob;
}

export function getCanvas2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new ImageProcessingError(
      'CANVAS_CONTEXT_UNAVAILABLE',
      'The browser could not create a 2D canvas context.'
    );
  }
  return context;
}

export function normalizeDownloadFilename(filename: string): string {
  const normalized = filename
    // Control characters and filesystem-reserved punctuation are unsafe in downloads.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.-]+/, '')
    .trim();
  return normalized || 'download';
}

interface DownloadDocument {
  body: {
    appendChild(node: HTMLAnchorElement): void;
    removeChild(node: HTMLAnchorElement): void;
  };
  createElement(tagName: 'a'): HTMLAnchorElement;
}

export function downloadUrl(
  url: string,
  filename: string,
  targetDocument: DownloadDocument = document
): void {
  if (!url) {
    throw new ImageProcessingError('DOWNLOAD_FAILED', 'The download URL is missing.');
  }

  const anchor = targetDocument.createElement('a');
  anchor.href = url;
  anchor.download = normalizeDownloadFilename(filename);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  try {
    targetDocument.body.appendChild(anchor);
    anchor.click();
  } catch (cause) {
    throw new ImageProcessingError('DOWNLOAD_FAILED', 'The download could not be started.', {
      cause,
    });
  } finally {
    try {
      targetDocument.body.removeChild(anchor);
    } catch {
      // The anchor may not have been attached if appendChild failed.
    }
  }
}

const USER_ERROR_MESSAGES: Record<ImageProcessingErrorCode, string> = {
  EMPTY_FILE: 'This file is empty. Choose a non-empty image.',
  UNSUPPORTED_FILE_TYPE: 'Choose a JPG, PNG, or WebP image.',
  DECODE_FAILED: 'This image could not be opened. It may be damaged or unsupported.',
  INVALID_DIMENSIONS: 'This image has invalid dimensions.',
  PIXEL_LIMIT_EXCEEDED: 'This image is too large for safe browser processing.',
  CANVAS_CONTEXT_UNAVAILABLE: 'Your browser could not start image processing.',
  EXPORT_FAILED: 'Your browser could not create the output image.',
  OUTPUT_TYPE_MISMATCH: 'Your browser does not support the requested output format.',
  INVALID_FILE_SIZE: 'This file size is invalid or exceeds the allowed limit.',
  DOWNLOAD_FAILED: 'The download could not be started.',
};

export function getImageProcessingErrorMessage(error: unknown): string {
  if (error instanceof ImageProcessingError) return USER_ERROR_MESSAGES[error.code];
  return 'Image processing failed. Please try another file.';
}
