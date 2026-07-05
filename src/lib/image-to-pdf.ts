export type PdfPageSize = 'a4' | 'letter' | 'fit';
export type PdfOrientation = 'portrait' | 'landscape';
export type PdfInputKind = 'images' | 'jpeg' | 'png';

export interface PdfPreset {
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  margin: number;
  inputKind: PdfInputKind;
}

export const PDF_PAGE_SIZES = {
  a4: { width: 210, height: 297, label: 'A4 (210x297mm)' },
  letter: { width: 215.9, height: 279.4, label: 'Letter (8.5x11")' },
} as const;

export const PDF_PRESETS = {
  default: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
  jpg: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'jpeg' },
  png: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'png' },
  a4: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
  multiple: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
  no_margin: { pageSize: 'fit', orientation: 'portrait', margin: 0, inputKind: 'images' },
  photo: { pageSize: 'a4', orientation: 'portrait', margin: 10, inputKind: 'images' },
} as const satisfies Record<string, PdfPreset>;

export type PdfPresetKey = keyof typeof PDF_PRESETS;

export const PDF_VARIANT_PRESETS = {
  'jpg-to-pdf': 'jpg',
  'png-to-pdf': 'png',
  'image-to-a4-pdf': 'a4',
  'multiple-images-to-pdf': 'multiple',
  'image-to-pdf-no-margin': 'no_margin',
  'photo-to-pdf': 'photo',
} as const satisfies Record<string, PdfPresetKey>;

export type PdfVariantSlug = keyof typeof PDF_VARIANT_PRESETS;

export const PDF_INPUT_TYPES: Record<PdfInputKind, readonly string[]> = {
  images: ['image/jpeg', 'image/png', 'image/webp'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
};

export interface PdfPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculatePdfPlacement(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  margin: number
): PdfPlacement {
  if (
    ![pageWidth, pageHeight, imageWidth, imageHeight].every(
      (value) => Number.isFinite(value) && value > 0
    )
  ) {
    throw new Error('Page and image dimensions must be greater than zero.');
  }
  if (!Number.isFinite(margin) || margin < 0) {
    throw new Error('Margin must be zero or greater.');
  }

  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('Margin leaves no drawable page area.');
  }

  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    x: margin + (availableWidth - width) / 2,
    y: margin + (availableHeight - height) / 2,
    width,
    height,
  };
}

export function pixelsToMillimeters(pixels: number): number {
  if (!Number.isFinite(pixels) || pixels <= 0) {
    throw new Error('Pixel dimension must be greater than zero.');
  }
  return pixels * (25.4 / 96);
}
