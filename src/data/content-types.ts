export interface FaqItem {
  question: string;
  answer: string;
}

export interface ToolVariantSummary {
  slug: string;
  label: string;
  indexable?: boolean;
}

export interface ToolVariantPageData {
  title: string;
  description: string;
  faq: FaqItem[];
}
