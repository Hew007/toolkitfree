/**
 * The site's public identity, in one place.
 *
 * Search engines and AI assistants use this to tell ToolkitFree apart from the
 * many similarly named tool sites, so it has to be consistent everywhere it
 * appears — which is why the homepage and the About page both read it from here
 * rather than each declaring their own.
 *
 * Every value must be verifiable. A `sameAs` entry is a claim that this site and
 * that profile are the same operator; one pointing at a profile that does not
 * exist is worse than having none at all.
 */
export const SITE_ORGANIZATION = {
  '@type': 'Organization',
  name: 'ToolkitFree',
  url: 'https://toolkitfree.net/',
  email: 'hnhw182@gmail.com',
  description:
    'Free browser-based tools for images, PDFs, QR codes, ID photos, and animated media. Selected file contents are processed locally on the device.',
  founder: {
    '@type': 'Person',
    name: 'ruofeng_x',
  },
  sameAs: [
    // The channel the approved product demo is published on.
    'https://www.youtube.com/channel/UCzOeU_EDy79n3dmaHdmya8A',
  ],
} as const;
