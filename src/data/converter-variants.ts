export const allVariants = [
  { slug: 'jpg-to-png', from: 'JPG', to: 'PNG' },
  { slug: 'png-to-jpg', from: 'PNG', to: 'JPG' },
  { slug: 'webp-to-jpg', from: 'WebP', to: 'JPG' },
  { slug: 'jpg-to-webp', from: 'JPG', to: 'WebP' },
  { slug: 'png-to-webp', from: 'PNG', to: 'WebP' },
  { slug: 'webp-to-png', from: 'WebP', to: 'PNG' },
  { slug: 'heic-to-jpg', from: 'HEIC', to: 'JPG' },
  { slug: 'gif-to-png', from: 'GIF', to: 'PNG' },
  { slug: 'bmp-to-png', from: 'BMP', to: 'PNG' },
  { slug: 'tiff-to-jpg', from: 'TIFF', to: 'JPG' },
  { slug: 'svg-to-png', from: 'SVG', to: 'PNG' },
  { slug: 'png-to-gif', from: 'PNG', to: 'GIF' },
];

export const faqData: Record<string, { question: string; answer: string }[]> = {
  'jpg-to-png': [
    { question: 'How to convert JPG to PNG?', answer: 'Upload your JPG file, select PNG as the output format, and click Convert. The conversion is lossless — you get a full-quality PNG file instantly.' },
    { question: 'Is JPG to PNG conversion lossless?', answer: 'Yes. PNG is a lossless format, so converting from JPG to PNG preserves the full quality of your JPG image. However, any existing JPG compression artifacts will remain.' },
    { question: 'Can I convert multiple JPGs to PNG at once?', answer: 'Yes, you can upload and convert multiple JPG files simultaneously. All conversions happen in parallel for maximum speed.' },
    { question: 'What is the difference between JPG and PNG?', answer: 'JPG uses lossy compression and is best for photos. PNG uses lossless compression and supports transparency. PNG files are typically larger but higher quality.' },
    { question: 'Will the file size increase when converting JPG to PNG?', answer: 'Usually yes. PNG files are typically larger than JPG files because PNG uses lossless compression. If you need a smaller file, consider staying with JPG or converting to WebP.' },
  ],
  'png-to-jpg': [
    { question: 'How to convert PNG to JPG?', answer: 'Upload your PNG file, select JPG as the output format, adjust the quality slider if needed, and click Convert. Transparent areas will be filled with white.' },
    { question: 'Will I lose transparency when converting PNG to JPG?', answer: 'Yes. JPG does not support transparency. Any transparent areas in your PNG will be filled with white in the JPG output.' },
    { question: 'Why convert PNG to JPG?', answer: 'JPG files are typically much smaller than PNG files, especially for photographs. This makes them ideal for web use, email attachments, and saving storage space.' },
    { question: 'Can I control the JPG quality?', answer: 'Yes, you can adjust the quality slider from 10% to 100%. Higher quality means larger files. 85-92% is usually the sweet spot for photos.' },
  ],
  'webp-to-jpg': [
    { question: 'How to convert WebP to JPG?', answer: 'Upload your WebP file, select JPG as the output format, and click Convert. Your converted JPG is ready to download instantly.' },
    { question: 'Why convert WebP to JPG?', answer: 'Some older applications, websites, and devices don\'t support WebP. Converting to JPG ensures maximum compatibility across all platforms.' },
    { question: 'Is WebP to JPG conversion lossy?', answer: 'Converting from WebP to JPG involves re-encoding, which may introduce slight quality loss. At high quality settings (90%+), the difference is negligible.' },
  ],
  'jpg-to-webp': [
    { question: 'How to convert JPG to WebP?', answer: 'Upload your JPG file, select WebP as the output format, adjust quality if desired, and click Convert. WebP files are typically 25-34% smaller.' },
    { question: 'Why convert JPG to WebP?', answer: 'WebP offers better compression than JPG, producing 25-34% smaller files at equivalent quality. This means faster page loads and less bandwidth usage.' },
    { question: 'Does WebP work in all browsers?', answer: 'WebP is supported by all modern browsers including Chrome, Firefox, Safari, and Edge. It may not work in very old browsers like Internet Explorer.' },
  ],
  'png-to-webp': [
    { question: 'How to convert PNG to WebP?', answer: 'Upload your PNG file, select WebP as the output format, and click Convert. WebP supports transparency, so your transparent PNG will keep its transparency.' },
    { question: 'Does WebP support transparency like PNG?', answer: 'Yes! WebP supports both lossy and lossless compression with alpha transparency. This makes it a great replacement for PNG with much smaller file sizes.' },
    { question: 'How much smaller is WebP compared to PNG?', answer: 'WebP lossless images are 26% smaller than PNG. WebP lossy images at equivalent quality are 25-34% smaller than JPG and much smaller than PNG.' },
  ],
  'webp-to-png': [
    { question: 'How to convert WebP to PNG?', answer: 'Upload your WebP file, select PNG as the output format, and click Convert. The conversion preserves transparency and image quality.' },
    { question: 'Why convert WebP to PNG?', answer: 'PNG is universally supported by all image editors and applications. Converting WebP to PNG ensures compatibility with older software that doesn\'t support WebP.' },
    { question: 'Will the file size change?', answer: 'Yes, PNG files are typically larger than WebP files because PNG uses less efficient compression. The quality will be the same or better.' },
  ],
  'heic-to-jpg': [
    { question: 'Does this tool currently convert HEIC to JPG?', answer: 'No. HEIC decoding is not implemented in the current converter. Use a HEIC-capable converter until dedicated decoding is added here.' },
    { question: 'Why is HEIC not supported yet?', answer: 'The tool relies on built-in browser image decoding. HEIC support is not reliable across modern browsers.' },
  ],
  'gif-to-png': [
    { question: 'Can this tool open GIF files?', answer: 'It can when the browser decodes the GIF. Support is browser-dependent and not guaranteed on every device.' },
    { question: 'Will GIF animation be preserved?', answer: 'No. Canvas export produces a static PNG from one decoded frame. Keep the original GIF if you need animation.' },
  ],
  'bmp-to-png': [
    { question: 'Can this tool open BMP files?', answer: 'BMP input relies on the browser built-in decoder. It may work in current Chrome or Edge, but is not guaranteed.' },
    { question: 'What should I do if BMP loading fails?', answer: 'Convert the BMP to JPG or PNG with a BMP-capable application, then use the standard converter.' },
  ],
  'tiff-to-jpg': [
    { question: 'Does this tool currently convert TIFF to JPG?', answer: 'No. TIFF decoding is not implemented in the current converter.' },
    { question: 'Why is TIFF not supported?', answer: 'TIFF has multiple encodings and is not reliably decoded by the browser Canvas path used by this tool.' },
  ],
  'svg-to-png': [
    { question: 'Can this tool open SVG files?', answer: 'It can when the browser safely decodes the SVG. External resources and some SVG features may not render.' },
    { question: 'What resolution will the PNG be?', answer: 'The PNG uses the dimensions decoded from the SVG. This support is browser-dependent.' },
  ],
  'png-to-gif': [
    { question: 'Does this tool currently export GIF?', answer: 'No. The current output choices are JPG, PNG, and WebP. GIF output is not implemented.' },
    { question: 'What can I use instead?', answer: 'Use PNG for lossless graphics or WebP for smaller web images until GIF output is added.' },
  ],
};

export const descriptions: Record<string, string> = {
  'jpg-to-png': 'Convert decoded JPG pixels to losslessly encoded PNG. Existing JPG artifacts remain. No file upload needed.',
  'png-to-jpg': 'Convert PNG images to JPG with adjustable lossy quality. Transparent areas become white.',
  'webp-to-jpg': 'Convert WebP images to JPG with adjustable lossy quality in your browser.',
  'jpg-to-webp': 'Convert JPG images to WebP with adjustable quality. Output size varies by image.',
  'png-to-webp': 'Convert PNG images to WebP with adjustable quality and transparency support.',
  'webp-to-png': 'Convert decoded WebP pixels to losslessly encoded PNG while preserving decoded transparency.',
  'heic-to-jpg': 'HEIC to JPG is not currently supported. Learn why browser-only HEIC decoding is unavailable.',
  'gif-to-png': 'Browser-dependent GIF to PNG conversion. Exports one static frame; animation is not preserved.',
  'bmp-to-png': 'Browser-dependent BMP to PNG conversion. BMP decoding is not guaranteed on every device.',
  'tiff-to-jpg': 'TIFF to JPG is not currently supported because browser Canvas decoding is unreliable for TIFF.',
  'svg-to-png': 'Browser-dependent SVG to PNG conversion. External resources and some SVG features may not render.',
  'png-to-gif': 'GIF output is not currently supported. The converter exports JPG, PNG, and WebP only.',
};
