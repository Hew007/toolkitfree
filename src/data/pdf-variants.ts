import type { ToolVariantPageData, ToolVariantSummary } from './content-types';

export const allVariants: ToolVariantSummary[] = [
  { slug: 'jpg-to-pdf', label: 'JPG to PDF' },
  { slug: 'png-to-pdf', label: 'PNG to PDF' },
  { slug: 'image-to-a4-pdf', label: 'Image to A4 PDF' },
  { slug: 'multiple-images-to-pdf', label: 'Multiple Images to PDF' },
  { slug: 'image-to-pdf-no-margin', label: 'Image to PDF without Margin' },
  { slug: 'photo-to-pdf', label: 'Photo to PDF' },
];

export const variantData: Record<string, ToolVariantPageData> = {
  'jpg-to-pdf': {
    title: 'JPG to PDF — Convert Images Online Free',
    description:
      'Convert multiple JPG images to PDF in your browser with A4 or Letter page sizes and adjustable margins.',
    faq: [
      {
        question: 'How to convert JPG to PDF?',
        answer:
          'Upload your JPG file(s), choose page size and orientation, and click "Create PDF." Your PDF is ready to download in seconds.',
      },
      {
        question: 'Can I convert multiple JPGs to one PDF?',
        answer:
          'Yes! Upload multiple JPG files and they will be combined into a single multi-page PDF, with each JPG on its own page.',
      },
      {
        question: 'Will the image quality be preserved?',
        answer:
          'Yes. The conversion uses high-quality JPEG encoding at 92% quality. Your images will look great in the PDF.',
      },
      {
        question: 'Is JPG to PDF free?',
        answer:
          'Yes, it is free with no sign-up or watermark. Browser memory and PDF generation limits still apply.',
      },
    ],
  },
  'png-to-pdf': {
    title: 'PNG to PDF — Convert Images Online Free',
    description:
      'Convert multiple PNG images to PDF in your browser. Transparent areas are filled with white.',
    faq: [
      {
        question: 'How to convert PNG to PDF?',
        answer:
          'Choose your PNG file(s), set the page size and orientation, and click "Create PDF." Download the result when browser processing finishes.',
      },
      {
        question: 'What happens to transparent PNGs?',
        answer:
          'PDF does not support transparency. Transparent areas in your PNG will be filled with white in the PDF output.',
      },
      {
        question: 'Can I batch convert PNGs to PDF?',
        answer:
          'Yes. Upload multiple PNG files at once. Each PNG will become a page in the PDF, in the order you uploaded them.',
      },
      {
        question: 'Why convert PNG to PDF?',
        answer:
          'PDF is ideal for sharing, printing, and archiving. It preserves layout and works consistently across all devices and platforms.',
      },
    ],
  },
  'image-to-a4-pdf': {
    title: 'Image to A4 PDF — Free Online Converter',
    description:
      'Convert images to A4-sized PDF pages in your browser with adjustable margins for printing documents and photos.',
    faq: [
      {
        question: 'What is A4 size?',
        answer:
          'A4 is the standard international paper size: 210×297mm (8.27×11.69 inches). It is the default size for most printers worldwide.',
      },
      {
        question: 'How to convert an image to A4 PDF?',
        answer:
          'Upload your image, select "A4" as the page size, adjust orientation and margins if needed, and click Convert. Your A4 PDF is ready.',
      },
      {
        question: 'Can I fit multiple images on one A4 page?',
        answer:
          'Yes. Each image starts on its own A4 page, but you can drag one onto another page and both are arranged on it automatically. You can then move and resize each image independently.',
      },
      {
        question: 'Will the image fill the entire A4 page?',
        answer:
          'By default the image is scaled to fit the page while maintaining its aspect ratio. Use the Fill page button to cover the whole page instead, drag a corner handle to size it yourself, or adjust the margin.',
      },
    ],
  },
  'multiple-images-to-pdf': {
    title: 'Multiple Images to PDF — Combine Photos Online Free',
    description:
      'Combine multiple JPG, PNG, or WebP images into one PDF in your browser, with each image on a page.',
    faq: [
      {
        question: 'How to combine multiple images into one PDF?',
        answer:
          'Upload all your images at once. They are arranged in the order you uploaded them, with each image on its own page, and every page is previewed immediately. Click "Create PDF" and download.',
      },
      {
        question: 'How many images can I combine?',
        answer:
          'There is no server quota. The practical limit depends on browser memory, image dimensions, and device performance; large batches can fail.',
      },
      {
        question: 'Can I reorder the images?',
        answer:
          'Yes. Drag an image onto another page to move it there, or focus it and press Alt with PageUp or PageDown. Within a page, Ctrl with the arrow keys changes the order. The page order shown in the preview is the order used in the PDF.',
      },
      {
        question: 'What image formats are supported?',
        answer:
          'JPG, PNG, and WebP are supported. Files that cannot be decoded are reported individually while valid images can still be converted.',
      },
    ],
  },
  'image-to-pdf-no-margin': {
    title: 'Image to PDF without Margin — Full-Page Online',
    description:
      'Convert images to a borderless PDF layout in your browser, filling each page edge to edge.',
    faq: [
      {
        question: 'How to convert images to PDF without margins?',
        answer:
          'Upload your image, select "Fit to Image" page size, or set margin to 0mm with A4/Letter size. The image will fill the page edge to edge.',
      },
      {
        question: 'When should I use no-margin PDF?',
        answer:
          'No-margin PDFs are ideal for photo prints, full-page graphics, flyers, and when you want the image to bleed to the edge of the page.',
      },
      {
        question: 'Will the image be cropped?',
        answer:
          'The image is scaled to fit the page while maintaining aspect ratio. With no margins, it fills the maximum area possible without distortion.',
      },
    ],
  },
  'photo-to-pdf': {
    title: 'Photo to PDF — Convert Pictures Online Free',
    description:
      'Convert supported iPhone and Android photo files to PDF in your browser for sharing and printing.',
    faq: [
      {
        question: 'How to convert a photo to PDF?',
        answer:
          'Upload your photo(s) from your phone or computer, choose page settings, and click Convert. Your PDF is ready to download and share.',
      },
      {
        question: 'Can I convert iPhone photos to PDF?',
        answer:
          'JPG, PNG, and WebP photos are supported. HEIC is not supported by the current browser-only decoder.',
      },
      {
        question: 'Why convert photos to PDF?',
        answer:
          'PDF is widely supported for sharing and printing and preserves a fixed page layout. Rendering can still vary by PDF viewer and printer settings.',
      },
      {
        question: 'Can I combine photos from my phone into one PDF?',
        answer:
          'Yes. Select multiple photos when uploading. They will be combined into a single PDF with one photo per page.',
      },
    ],
  },
};
