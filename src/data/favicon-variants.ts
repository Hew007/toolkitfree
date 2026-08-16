import type { ToolVariantPageData, ToolVariantSummary } from './content-types';

export const allVariants: ToolVariantSummary[] = [
  { slug: 'png-to-favicon', label: 'PNG to Favicon' },
  { slug: 'jpg-to-favicon', label: 'JPG to Favicon' },
  { slug: 'logo-to-favicon', label: 'Logo to Favicon' },
  { slug: 'favicon-for-wordpress', label: 'Favicon for WordPress' },
];

export const variantData: Record<string, ToolVariantPageData> = {
  'png-to-favicon': {
    title: 'PNG to Favicon — Generate Common Sizes Free',
    description:
      'Convert a PNG image to favicon sizes from 16x16 to 512x512 in your browser. Download a ZIP with a webmanifest.',
    faq: [
      {
        question: 'How to convert PNG to favicon?',
        answer:
          'Choose your PNG image, click "Generate Favicons," and download the ZIP containing five common PNG icon sizes plus a webmanifest file.',
      },
      {
        question: 'What size should my PNG be?',
        answer:
          'For best results, use a square PNG that is at least 512x512 pixels. The tool resizes it to 16, 32, 180, 192, and 512px PNG icons.',
      },
      {
        question: 'Does PNG transparency work for favicons?',
        answer:
          'Yes. PNG transparency is preserved. Non-square images are centered with transparent padding instead of being stretched. This tool generates PNG icons and does not create a favicon.ico file.',
      },
      {
        question: 'What files are included in the download?',
        answer:
          'The ZIP includes favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png (180x180), android-chrome-192x192.png, android-chrome-512x512.png, and site.webmanifest.',
      },
    ],
  },
  'jpg-to-favicon': {
    title: 'JPG to Favicon — Generate Common Sizes Free',
    description:
      'Convert a JPG image to favicon sizes in your browser. Use a white background for transparent areas and download a ZIP.',
    faq: [
      {
        question: 'How to convert JPG to favicon?',
        answer:
          'Choose your JPG image and click "Generate Favicons." The tool creates five common PNG icon sizes and packages them in a downloadable ZIP.',
      },
      {
        question: 'Can I use a photo as a favicon?',
        answer:
          'You can, but favicons are displayed very small (16x16 pixels). Simple logos, icons, or letters work best. Photos may not be recognizable at small sizes.',
      },
      {
        question: 'What happens to the JPG background?',
        answer:
          'JPG does not support transparency. If your image has a background, it will be included as-is in the favicon. For transparent favicons, start with a PNG.',
      },
    ],
  },
  'logo-to-favicon': {
    title: 'Logo to Favicon — Create Website Icons Free',
    description:
      'Convert your logo to modern favicon sizes in your browser, including a webmanifest.',
    faq: [
      {
        question: 'How to turn a logo into a favicon?',
        answer:
          'Choose your supported logo image, click "Generate Favicons," and download a ZIP with five PNG icon sizes plus the HTML code to add to your site.',
      },
      {
        question: 'What makes a good favicon from a logo?',
        answer:
          'Use a simple, recognizable part of your logo — typically the icon or mark, not the full wordmark. Square or nearly-square logos work best.',
      },
      {
        question: 'What files do I need for a website favicon?',
        answer:
          'A modern website needs: favicon-32x32.png, favicon-16x16.png, apple-touch-icon.png (180x180), android-chrome-192x192.png, android-chrome-512x512.png, and site.webmanifest. Our tool generates all of these.',
      },
    ],
  },
  'favicon-for-wordpress': {
    title: 'Favicon for WordPress — Generate Site Icons Free',
    description: 'Generate WordPress-compatible favicon and site-icon sizes in your browser.',
    faq: [
      {
        question: 'What favicon sizes does WordPress need?',
        answer:
          'WordPress needs a site icon of at least 512x512 pixels. It automatically generates all smaller sizes from this. Our tool creates the 512x512 version plus all other standard sizes.',
      },
      {
        question: 'How to add a favicon to WordPress?',
        answer:
          'Go to Appearance > Customize > Site Identity > Site Icon in your WordPress dashboard. Upload the 512x512 PNG from our download. WordPress handles the rest automatically.',
      },
      {
        question: 'Can I use the ZIP download for WordPress?',
        answer:
          'For WordPress, you only need the 512x512 android-chrome-512x512.png file. Upload it as the Site Icon in WordPress. The other files in the ZIP are useful if you have a custom theme.',
      },
      {
        question: 'What is site.webmanifest?',
        answer:
          'The webmanifest file tells browsers how to display your site when added to a home screen. It is mainly for Progressive Web Apps (PWA). WordPress does not use it by default.',
      },
    ],
  },
};
