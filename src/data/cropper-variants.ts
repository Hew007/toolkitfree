export const allVariants = [
  { slug: 'crop-to-square', label: 'Crop to Square' },
  { slug: 'crop-to-16-9', label: 'Crop to 16:9' },
  { slug: 'crop-to-4-3', label: 'Crop to 4:3' },
  { slug: 'crop-to-3-2', label: 'Crop to 3:2' },
  { slug: 'free-crop', label: 'Free Crop' },
];

export const variantData: Record<string, { title: string; description: string; defaultAspectRatio: number | null; faq: { question: string; answer: string }[] }> = {
  'crop-to-square': {
    title: 'Crop Image to Square Online — Free',
    description: 'Crop images to a perfect square (1:1) for social media profiles, Instagram posts, and thumbnails. Free, no upload needed.',
    defaultAspectRatio: 1,
    faq: [
      { question: 'How to crop an image to a square?', answer: 'Upload your image, select the 1:1 aspect ratio, adjust the crop area by dragging, and click Crop. Download your perfectly squared image.' },
      { question: 'What size is a square image?', answer: 'A square image has equal width and height (1:1 ratio). Common sizes include 1080×1080 (Instagram), 500×500 (Facebook), and 400×400 (LinkedIn).' },
      { question: 'Why crop to a square?', answer: 'Square images work perfectly as social media profile pictures, Instagram posts, and thumbnails. They display consistently across all platforms without cropping.' },
      { question: 'Can I choose the output size of the square?', answer: 'The crop tool lets you select the area to keep. The output size depends on how large you make the crop area. For specific pixel dimensions, use our Image Resizer after cropping.' },
    ],
  },
  'crop-to-16-9': {
    title: 'Crop Image to 16:9 Online — Free',
    description: 'Crop images to 16:9 widescreen ratio for YouTube thumbnails, presentations, and desktop wallpapers. Free, no upload needed.',
    defaultAspectRatio: 16 / 9,
    faq: [
      { question: 'How to crop an image to 16:9?', answer: 'Upload your image, select the 16:9 aspect ratio, position the crop area, and click Crop. Your widescreen image is ready to download.' },
      { question: 'What is 16:9 used for?', answer: '16:9 is the standard widescreen ratio used for YouTube thumbnails (1280×720), HD video, presentations, and most modern displays.' },
      { question: 'Will the image quality change after cropping?', answer: 'Cropping only removes parts of the image — it does not compress or alter the remaining pixels. The quality of the cropped area stays the same as the original.' },
    ],
  },
  'crop-to-4-3': {
    title: 'Crop Image to 4:3 Online — Free',
    description: 'Crop images to 4:3 ratio for presentations, standard photos, and older displays. Free, no upload needed.',
    defaultAspectRatio: 4 / 3,
    faq: [
      { question: 'How to crop an image to 4:3?', answer: 'Upload your image, select the 4:3 aspect ratio, adjust the crop area, and click Crop. Download your cropped image instantly.' },
      { question: 'What is 4:3 used for?', answer: '4:3 is the traditional screen ratio used in presentations (PowerPoint defaults), older monitors, iPads, and many digital cameras.' },
      { question: 'Can I crop multiple images to 4:3?', answer: 'Currently the tool processes one image at a time. Upload and crop each image individually for the best results.' },
    ],
  },
  'crop-to-3-2': {
    title: 'Crop Image to 3:2 Online — Free',
    description: 'Crop images to 3:2 ratio, the standard for photography prints and DSLR cameras. Free, no upload needed.',
    defaultAspectRatio: 3 / 2,
    faq: [
      { question: 'How to crop an image to 3:2?', answer: 'Upload your image, select the 3:2 ratio, drag to position the crop area, and click Crop. Your photo is ready to download.' },
      { question: 'What is the 3:2 aspect ratio?', answer: '3:2 is the native ratio of most DSLR and mirrorless cameras. It is also standard for 4×6 inch photo prints.' },
      { question: 'Why use 3:2?', answer: '3:2 matches the native sensor ratio of most cameras, so cropping to this ratio preserves the original composition intent. It is also the ratio for standard photo prints.' },
    ],
  },
  'free-crop': {
    title: 'Free Image Cropper — Crop Any Size Online',
    description: 'Crop images to any custom size. Drag to select the area you want to keep. Free, private, runs entirely in your browser.',
    defaultAspectRatio: null,
    faq: [
      { question: 'How does free crop work?', answer: 'Upload your image, select "Free" for aspect ratio, drag the crop handles to select any area, and click Crop. You can resize the selection freely without any ratio constraint.' },
      { question: 'Can I enter exact pixel dimensions?', answer: 'The crop tool shows you the current selection size in pixels. Drag the handles to get your desired dimensions. For exact pixel control, use our Image Resizer after cropping.' },
      { question: 'Does cropping reduce image quality?', answer: 'No. Cropping removes pixels outside the selection but does not compress or alter the remaining pixels. The cropped area retains the full quality of the original.' },
      { question: 'What image formats can I crop?', answer: 'You can crop any image your browser can open — JPG, PNG, WebP, GIF, BMP, and more. The output can be saved as PNG, JPG, or WebP.' },
    ],
  },
};
