export const allVariants = [
  { slug: 'resize-for-instagram', label: 'Resize for Instagram' },
  { slug: 'resize-for-facebook', label: 'Resize for Facebook' },
  { slug: 'resize-for-twitter', label: 'Resize for Twitter/X' },
  { slug: 'resize-for-youtube', label: 'Resize for YouTube' },
];

export const variantData: Record<string, { title: string; description: string; faq: { question: string; answer: string }[] }> = {
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
};
