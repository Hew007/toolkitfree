export const allVariants = [
  { slug: 'jpg-to-pdf', label: 'JPG to PDF' },
  { slug: 'png-to-pdf', label: 'PNG to PDF' },
  { slug: 'image-to-a4-pdf', label: 'Image to A4 PDF' },
  { slug: 'multiple-images-to-pdf', label: 'Multiple Images to PDF' },
  { slug: 'image-to-pdf-no-margin', label: 'Image to PDF without Margin' },
  { slug: 'photo-to-pdf', label: 'Photo to PDF' },
];

export const variantData: Record<string, { title: string; description: string; faq: { question: string; answer: string }[] }> = {
  'jpg-to-pdf': {
    title: 'JPG to PDF — Convert Images Online Free',
    description: 'Convert JPG images to PDF format instantly. Supports multiple JPGs, A4/Letter page sizes, adjustable margins. Free, no upload needed.',
    faq: [
      { question: 'How to convert JPG to PDF?', answer: 'Upload your JPG file(s), choose page size and orientation, and click "Convert to PDF." Your PDF is ready to download in seconds.' },
      { question: 'Can I convert multiple JPGs to one PDF?', answer: 'Yes! Upload multiple JPG files and they will be combined into a single multi-page PDF, with each JPG on its own page.' },
      { question: 'Will the image quality be preserved?', answer: 'Yes. The conversion uses high-quality JPEG encoding at 92% quality. Your images will look great in the PDF.' },
      { question: 'Is JPG to PDF free?', answer: 'Yes, completely free. No sign-up, no watermarks, no file size limits. All processing happens in your browser.' },
    ],
  },
  'png-to-pdf': {
    title: 'PNG to PDF — Convert Images Online Free',
    description: 'Convert PNG images to PDF format. Transparent areas are filled with white. Supports multiple files. Free, no upload needed.',
    faq: [
      { question: 'How to convert PNG to PDF?', answer: 'Upload your PNG file(s), set your preferred page size and orientation, and click "Convert to PDF." Download your PDF instantly.' },
      { question: 'What happens to transparent PNGs?', answer: 'PDF does not support transparency. Transparent areas in your PNG will be filled with white in the PDF output.' },
      { question: 'Can I batch convert PNGs to PDF?', answer: 'Yes. Upload multiple PNG files at once. Each PNG will become a page in the PDF, in the order you uploaded them.' },
      { question: 'Why convert PNG to PDF?', answer: 'PDF is ideal for sharing, printing, and archiving. It preserves layout and works consistently across all devices and platforms.' },
    ],
  },
  'image-to-a4-pdf': {
    title: 'Image to A4 PDF — Free Online Converter',
    description: 'Convert images to A4-sized PDF pages. Perfect for printing documents and photos. Adjustable margins. Free, no upload needed.',
    faq: [
      { question: 'What is A4 size?', answer: 'A4 is the standard international paper size: 210×297mm (8.27×11.69 inches). It is the default size for most printers worldwide.' },
      { question: 'How to convert an image to A4 PDF?', answer: 'Upload your image, select "A4" as the page size, adjust orientation and margins if needed, and click Convert. Your A4 PDF is ready.' },
      { question: 'Can I fit multiple images on one A4 page?', answer: 'Currently each image gets its own A4 page. For multiple images per page, you can use our Image Resizer to create a collage first.' },
      { question: 'Will the image fill the entire A4 page?', answer: 'The image is scaled to fit the page while maintaining its aspect ratio. You can adjust margins to control how much of the page the image fills.' },
    ],
  },
  'multiple-images-to-pdf': {
    title: 'Multiple Images to PDF — Combine Photos Online Free',
    description: 'Combine multiple images into one PDF file. Each image becomes a page. Supports JPG, PNG, WebP. Free, no upload needed.',
    faq: [
      { question: 'How to combine multiple images into one PDF?', answer: 'Upload all your images at once. They will be arranged in the order you uploaded them, with each image on its own page. Click "Convert to PDF" and download.' },
      { question: 'How many images can I combine?', answer: 'There is no hard limit. You can combine as many images as your browser can handle. For very large batches (100+), processing may take longer.' },
      { question: 'Can I reorder the images?', answer: 'Currently images are arranged in upload order. Remove and re-upload images in your preferred order if needed.' },
      { question: 'What image formats are supported?', answer: 'Any image format your browser supports: JPG, PNG, WebP, GIF, BMP, and more. All formats are converted to JPEG pages in the PDF.' },
    ],
  },
  'image-to-pdf-no-margin': {
    title: 'Image to PDF without Margin — Full-Page Online',
    description: 'Convert images to PDF with no margins. Images fill the entire page edge to edge. Free, no upload needed.',
    faq: [
      { question: 'How to convert images to PDF without margins?', answer: 'Upload your image, select "Fit to Image" page size, or set margin to 0mm with A4/Letter size. The image will fill the page edge to edge.' },
      { question: 'When should I use no-margin PDF?', answer: 'No-margin PDFs are ideal for photo prints, full-page graphics, flyers, and when you want the image to bleed to the edge of the page.' },
      { question: 'Will the image be cropped?', answer: 'The image is scaled to fit the page while maintaining aspect ratio. With no margins, it fills the maximum area possible without distortion.' },
    ],
  },
  'photo-to-pdf': {
    title: 'Photo to PDF — Convert Pictures Online Free',
    description: 'Convert photos to PDF format for sharing and printing. Supports iPhone and Android photos. Batch conversion. Free, no upload needed.',
    faq: [
      { question: 'How to convert a photo to PDF?', answer: 'Upload your photo(s) from your phone or computer, choose page settings, and click Convert. Your PDF is ready to download and share.' },
      { question: 'Can I convert iPhone photos to PDF?', answer: 'Yes. Upload photos directly from your iPhone. HEIC, JPG, and PNG formats are all supported.' },
      { question: 'Why convert photos to PDF?', answer: 'PDF is universally compatible, easy to share via email, great for printing, and perfect for archiving. Unlike photos, PDFs preserve layout on any device.' },
      { question: 'Can I combine photos from my phone into one PDF?', answer: 'Yes. Select multiple photos when uploading. They will be combined into a single PDF with one photo per page.' },
    ],
  },
};
