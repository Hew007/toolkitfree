import type { ToolVariantSummary } from './content-types';

export interface PdfPageVariant extends ToolVariantSummary {
  title: string;
  heading: string;
  description: string;
  defaultMode: 'combined' | 'individual';
}

export const allVariants: PdfPageVariant[] = [
  {
    slug: 'extract-pages-from-pdf',
    label: 'Extract Pages from PDF',
    title: 'Extract Pages from PDF Online — Free & Local',
    heading: 'Extract Selected Pages from a PDF',
    description:
      'Select page numbers or ranges, reorder and rotate pages, then export them into one new PDF. Processing stays in your browser.',
    defaultMode: 'combined',
    indexable: true,
  },
  {
    slug: 'split-pdf-into-pages',
    label: 'Split PDF into Pages',
    title: 'Split PDF into Separate Pages — Free & Local',
    heading: 'Split a PDF into Individual Page Files',
    description:
      'Choose pages from a PDF and download each selected page as its own PDF inside one ZIP file. No document upload is required.',
    defaultMode: 'individual',
    indexable: true,
  },
];
