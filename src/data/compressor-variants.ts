import type { ToolVariantPageData, ToolVariantSummary } from './content-types';

interface CompressorVariant extends ToolVariantPageData {
  slug: string;
  format: 'PNG' | 'JPG' | 'Any';
}

const variants = [
  {
    slug: 'compress-png',
    format: 'PNG',
    title: 'Compress PNG Images Online Free',
    description:
      'Re-encode PNG images or reduce their dimensions in your browser. A smaller output is not guaranteed. Batch processing is supported.',
    faq: [
      {
        question: 'How to compress a PNG file?',
        answer:
          'Upload your PNG file and choose a smaller maximum width. PNG ignores the quality control because it uses lossless encoding; dimension reduction is the available size-control path.',
      },
      {
        question: 'Can I compress PNG without losing quality?',
        answer:
          'PNG output uses lossless encoding, but re-encoding can be the same size or larger. Reducing dimensions removes pixels, so it is not lossless. Convert to WebP when a smaller lossy output is acceptable.',
      },
      {
        question: 'How much can I reduce PNG file size?',
        answer:
          'Reducing dimensions can lower file size, but the result depends on image content, original encoding, output format, and quality. Compare the displayed output before downloading.',
      },
      {
        question: 'What is the best way to compress PNG for web?',
        answer:
          'For web use, resize the PNG to the largest dimensions the page actually displays. You can also compare PNG and WebP outputs; the smaller format varies with the image.',
      },
    ],
  },
  {
    slug: 'compress-jpg',
    format: 'JPG',
    title: 'Compress JPG Images Online Free',
    description:
      'Compress JPG images in your browser with adjustable quality from 10–100% and batch support.',
    faq: [
      {
        question: 'How to compress a JPG file?',
        answer:
          'Choose your JPG file, pick what it is for, then compare the three results and download the one you want. Fine-tune still exposes quality and maximum width.',
      },
      {
        question: 'What quality should I use for JPG compression?',
        answer:
          'Start near the default quality and compare the preview and output size. The useful setting varies by image content and purpose, and lower settings can introduce visible artifacts.',
      },
      {
        question: 'How much can I reduce JPG file size?',
        answer:
          'At 80% quality, JPG files typically reduce by 40-60%. Combined with dimension reduction, you can achieve 70-90% smaller files.',
      },
      {
        question: 'Does JPG compression reduce image quality?',
        answer:
          'Yes. JPG is lossy: lower quality can produce a smaller file and more visible artifacts. Inspect the preview because the result varies by image.',
      },
    ],
  },
  {
    slug: 'compress-for-email',
    format: 'Any',
    title: 'Compress Images for Email Attachment',
    description:
      'Compress images to fit email attachment limits. Most email providers limit attachments to 25MB. Free online image compressor.',
    faq: [
      {
        question: 'What size should images be for email?',
        answer:
          'Most email providers limit attachments to 25MB total. For a single image, aim for under 5MB. At 80% quality with 1920px max width, most photos will be 200KB-1MB.',
      },
      {
        question: 'How to make a photo smaller for email?',
        answer:
          'Choose your photo, try a lower quality or maximum width, and compare the displayed result with your target size. A specific output size is not guaranteed.',
      },
      {
        question: 'Can I compress multiple photos for email at once?',
        answer:
          'Yes, batch compression is supported. Upload all your photos at once and compress them together. Then download individually or all at once.',
      },
    ],
  },
  {
    slug: 'compress-for-web',
    format: 'Any',
    title: 'Compress Images for Web - Optimize Website Assets',
    description:
      'Compress and optimize images for websites. Faster page load times. Better SEO. Free online image optimizer.',
    faq: [
      {
        question: 'What is the ideal image size for websites?',
        answer:
          'For hero images: 1920px wide, under 200KB. For content images: 800-1200px wide, under 100KB. For thumbnails: 300-400px wide, under 30KB.',
      },
      {
        question: 'How does image compression affect SEO?',
        answer:
          'Google uses page speed as a ranking factor. Smaller images load faster, improving Core Web Vitals (LCP). This directly helps your search rankings.',
      },
      {
        question: 'Should I use JPG or WebP for my website?',
        answer:
          'WebP can be smaller for some images, while JPG may be useful for older software. Compare both outputs at acceptable visual quality before choosing.',
      },
    ],
  },
  {
    slug: 'compress-for-whatsapp',
    format: 'Any',
    title: 'Compress Images for WhatsApp - Control File Size',
    description:
      'Resize or re-encode images before sharing on WhatsApp so you can inspect the result first.',
    faq: [
      {
        question: 'Why do my photos lose quality on WhatsApp?',
        answer:
          'WhatsApp automatically compresses images to save bandwidth. Photos are resized to 1600px and compressed to JPEG at ~70% quality. By pre-compressing with our tool, you control the result.',
      },
      {
        question: 'What is the best size for WhatsApp photos?',
        answer:
          "Set max width to 1600px and quality to 80-85%. This matches WhatsApp's compression but gives you control. Most photos will be 100-300KB.",
      },
      {
        question: 'How do I send large photos on WhatsApp without compression?',
        answer:
          'Reduce quality or dimensions and check the displayed output size. The current tool does not guarantee a specific target size.',
      },
    ],
  },
  {
    slug: 'compress-to-100kb',
    format: 'Any',
    title: 'Compress Image to 100KB - Verified Target Size',
    description:
      'Compress images to 100KB or less using bounded quality and dimension search. Every result states whether the target was met.',
    faq: [
      {
        question: 'How to reduce photo size to 100KB?',
        answer:
          'Upload an image and keep Target Size set to 100KB. JPG and WebP use bounded quality search and then dimension reduction when necessary; PNG uses dimension reduction. The result explicitly states whether it reached 100KB.',
      },
      {
        question: 'Will 100KB look bad?',
        answer:
          'Visual quality at 100KB varies substantially with image content and dimensions. Inspect the downloaded image before submitting it.',
      },
      {
        question: 'What if my image is still over 100KB?',
        answer:
          'The result is marked Target not met and shows the closest smaller candidate, or keeps the original when no candidate is smaller. No over-target result is presented as successful.',
      },
      {
        question: 'Why do forms require images under 100KB?',
        answer:
          'Some forms impose small upload limits. The tool verifies the actual Blob size and labels a result Target met only when it is at or below the selected limit.',
      },
    ],
  },
] satisfies readonly CompressorVariant[];

export const allVariants: ToolVariantSummary[] = variants.map(({ slug, title }) => ({
  slug,
  label: title,
}));

export const variantData: Record<string, Omit<CompressorVariant, 'slug'>> = Object.fromEntries(
  variants.map(({ slug, ...data }) => [slug, data])
);
