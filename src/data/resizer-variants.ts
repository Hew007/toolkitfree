import type { ToolVariantPageData, ToolVariantSummary } from './content-types';

export const allVariants: ToolVariantSummary[] = [
  { slug: 'resize-for-instagram', label: 'Resize for Instagram' },
  { slug: 'resize-for-facebook', label: 'Resize for Facebook' },
  { slug: 'resize-for-twitter', label: 'Resize for Twitter/X' },
  { slug: 'resize-for-youtube', label: 'Resize for YouTube' },
  { slug: 'resize-for-linkedin', label: 'Resize for LinkedIn' },
  { slug: 'resize-for-tiktok', label: 'Resize for TikTok' },
  { slug: 'resize-to-1920x1080', label: 'Resize to 1920x1080' },
];

export const variantData: Record<string, ToolVariantPageData> = {
  'resize-for-instagram': {
    title: 'Resize Image for Instagram - Post, Story, Reel Sizes',
    description: 'Resize images for Instagram posts (1080x1080), stories (1080x1920), and reels. Free online tool. No upload needed.',
    faq: [
      { question: 'What size should Instagram photos be?', answer: 'Instagram posts are best at 1080x1080 pixels (square) or 1080x1350 (portrait). Stories and Reels should be 1080x1920 pixels (9:16 aspect ratio).' },
      { question: 'What happens if my photo is the wrong size?', answer: 'Instagram will crop or letterbox your photo. To avoid this, resize your image to the correct dimensions before uploading using our tool.' },
      { question: 'What is the best aspect ratio for Instagram?', answer: 'Square (1:1) for posts, Portrait (4:5) for taller posts, and 9:16 for Stories and Reels.' },
    ],
  },
  'resize-for-facebook': {
    title: 'Resize Image for Facebook - Cover, Profile, Post Sizes',
    description: 'Resize images for Facebook cover photos (820x312), profile pictures, and posts. Free online image resizer.',
    faq: [
      { question: 'What size should a Facebook cover photo be?', answer: 'Facebook cover photos should be 820x312 pixels on desktop. On mobile, they display at 640x360. The safe area that shows on both is approximately 820x312.' },
      { question: 'What size should Facebook post images be?', answer: 'For the best display, use 1200x630 pixels for Facebook post images. This is the recommended size for link previews and shared posts.' },
      { question: 'What size should a Facebook profile picture be?', answer: 'Upload at least 180x180 pixels. Facebook displays profile pictures at 176x176 on desktop and 196x196 on smartphones.' },
    ],
  },
  'resize-for-twitter': {
    title: 'Resize Image for Twitter/X - Header, Profile, Post Sizes',
    description: 'Resize images for Twitter/X header (1500x500), profile picture, and tweet images. Free online tool.',
    faq: [
      { question: 'What size should a Twitter header be?', answer: 'Twitter/X header images should be 1500x500 pixels. Keep important content in the center as it may be cropped on different screen sizes.' },
      { question: 'What size should tweet images be?', answer: 'For in-stream photos, use 1600x900 pixels (16:9 ratio). Twitter supports up to 4096x4096 but will compress larger images.' },
    ],
  },
  'resize-for-youtube': {
    title: 'Resize Image for YouTube - Thumbnail, Banner, Profile Sizes',
    description: 'Resize images for YouTube thumbnails (1280x720), channel banners (2560x1440), and profile pictures. Free tool.',
    faq: [
      { question: 'What size should a YouTube thumbnail be?', answer: 'YouTube thumbnails should be 1280x720 pixels (16:9 aspect ratio), with a minimum width of 640 pixels. Maximum file size is 2MB.' },
      { question: 'What size should a YouTube channel banner be?', answer: 'The recommended YouTube banner size is 2560x1440 pixels. The safe area visible on all devices is 1546x423 pixels in the center.' },
    ],
  },
  'resize-for-linkedin': {
    title: 'Resize Image for LinkedIn - Profile, Post, Banner Sizes',
    description: 'Resize images for LinkedIn profile photos (400x400), post images (1200x627), and banners (1584x396). Free online tool.',
    faq: [
      { question: 'What size should a LinkedIn profile photo be?', answer: 'LinkedIn profile photos should be at least 400x400 pixels. LinkedIn displays them as a circle, so keep important content centered.' },
      { question: 'What size should LinkedIn post images be?', answer: 'LinkedIn post images should be 1200x627 pixels for the best display in the feed. LinkedIn supports up to 7680x4320 but compresses larger images.' },
      { question: 'What size should a LinkedIn banner be?', answer: 'LinkedIn personal profile banners should be 1584x396 pixels. Company page banners should be 1128x191 pixels.' },
    ],
  },
  'resize-for-tiktok': {
    title: 'Resize Image for TikTok - Profile, Thumbnail, Cover Sizes',
    description: 'Resize images for TikTok profile pictures (200x200), video covers (1080x1920), and thumbnails. Free online tool.',
    faq: [
      { question: 'What size should a TikTok profile picture be?', answer: 'TikTok profile pictures should be at least 200x200 pixels. TikTok displays them as circles, so center your subject.' },
      { question: 'What size should a TikTok video cover be?', answer: 'TikTok video covers should be 1080x1920 pixels (9:16 aspect ratio). This matches the full-screen vertical video format.' },
      { question: 'What aspect ratio does TikTok use?', answer: 'TikTok uses 9:16 vertical aspect ratio. All videos and covers should be 1080x1920 pixels for the best quality.' },
    ],
  },
  'resize-to-1920x1080': {
    title: 'Resize Image to 1920x1080 - Full HD 1080p',
    description: 'Resize images to 1920x1080 pixels (Full HD). Perfect for wallpapers, presentations, and video thumbnails. Free online tool.',
    faq: [
      { question: 'Why resize to 1920x1080?', answer: '1920x1080 is Full HD resolution, the standard for most monitors, presentations, and video content. It provides crisp quality while keeping file sizes manageable.' },
      { question: 'Will the image be stretched?', answer: 'If you enable "Maintain aspect ratio," the image will fit within 1920x1080 without stretching. If disabled, the image will be stretched or squished to fill the exact dimensions.' },
      { question: 'Is 1920x1080 good for wallpapers?', answer: 'Yes, 1920x1080 is the most common desktop monitor resolution. For higher-resolution displays (2K, 4K), consider larger dimensions.' },
    ],
  },
};
