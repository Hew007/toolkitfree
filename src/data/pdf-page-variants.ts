import type { ToolVariantSummary } from './content-types';

export interface PdfPageVariant extends ToolVariantSummary {
  title: string;
  heading: string;
  description: string;
  defaultMode: 'combined' | 'individual';
  /**
   * How this variant's output is named on the tool's own chip row. The chips and
   * the variant routes answer the same question — one file or one per page — so
   * they are kept in this one table instead of being written out twice.
   */
  modeLabel: string;
  modeHint: string;
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
    modeLabel: 'One combined PDF',
    modeHint: 'The selected pages, in order, in a single new file.',
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
    modeLabel: 'Separate page files',
    modeHint: 'One PDF per selected page, delivered in a ZIP.',
    indexable: true,
  },
];
