export type PdfPageRotation = 0 | 90 | 180 | 270;

export interface PdfPagePlan {
  sourceIndex: number;
  rotation: PdfPageRotation;
}

export interface PdfToolBudget {
  maxBytes: number;
  maxPages: number;
}

export const PDF_TOOL_BUDGETS = {
  desktop: { maxBytes: 100 * 1024 * 1024, maxPages: 300 },
  mobile: { maxBytes: 50 * 1024 * 1024, maxPages: 150 },
} as const satisfies Record<'desktop' | 'mobile', PdfToolBudget>;

export function getPdfToolBudget(isMobile: boolean): PdfToolBudget {
  return isMobile ? PDF_TOOL_BUDGETS.mobile : PDF_TOOL_BUDGETS.desktop;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.byteLength, 1024);
  for (let index = 0; index <= limit - 5; index += 1) {
    if (
      bytes[index] === 0x25 &&
      bytes[index + 1] === 0x50 &&
      bytes[index + 2] === 0x44 &&
      bytes[index + 3] === 0x46 &&
      bytes[index + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

export function validatePdfFile(file: File, budget: PdfToolBudget): void {
  const extensionMatches = file.name.toLowerCase().endsWith('.pdf');
  const typeMatches = file.type === 'application/pdf' || file.type === '';
  if (!extensionMatches || !typeMatches) throw new Error('Choose a valid PDF file.');
  if (file.size === 0) throw new Error('The selected PDF is empty.');
  if (file.size > budget.maxBytes) {
    throw new Error(
      `This PDF exceeds the ${Math.round(budget.maxBytes / 1024 / 1024)} MiB limit for this device.`
    );
  }
}

export function normalizePdfRotation(value: number): PdfPageRotation {
  const normalized = ((value % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

export function rotatePdfPage(value: PdfPageRotation, delta: -90 | 90): PdfPageRotation {
  return normalizePdfRotation(value + delta);
}

export function movePdfPage<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function parsePdfPageRange(value: string, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('This PDF has no pages.');
  const trimmed = value.trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, index) => index);

  const result: number[] = [];
  const seen = new Set<number>();
  for (const token of trimmed.split(',').map((part) => part.trim())) {
    if (!token) throw new Error('Enter page numbers such as 1-3, 5, 8-10.');
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`“${token}” is not a valid page or page range.`);
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`Page range “${token}” must stay between 1 and ${pageCount}.`);
    }
    if (end < start) throw new Error(`Page range “${token}” must run from lower to higher.`);
    for (let page = start; page <= end; page += 1) {
      const index = page - 1;
      if (!seen.has(index)) {
        seen.add(index);
        result.push(index);
      }
    }
  }
  return result;
}

export function createPdfOutputName(sourceName: string, mode: 'combined' | 'individual'): string {
  const stem = sourceName.replace(/\.pdf$/i, '').trim() || 'document';
  return mode === 'combined' ? `${stem}-extracted.pdf` : `${stem}-split-pages.zip`;
}
