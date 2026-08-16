import type { ToolVariantPageData, ToolVariantSummary } from './content-types';

interface SplitterVariantPageData extends ToolVariantPageData {
  defaultRows: number;
  defaultCols: number;
  intro: string;
  features: string[];
}

export const allVariants: ToolVariantSummary[] = [
  { slug: 'split-into-2', label: 'Split in Half' },
  { slug: 'split-into-4', label: 'Split Into 4' },
  { slug: 'instagram-grid', label: 'Instagram Grid' },
  { slug: 'split-for-printing', label: 'Split for Printing' },
];

export const variantData: Record<string, SplitterVariantPageData> = {
  'split-into-2': {
    title: 'Split an Image in Half Online — Free',
    description:
      'Cut one image into two halves in your browser. Split left and right or top and bottom, and move the dividing line to any exact pixel.',
    defaultRows: 1,
    defaultCols: 2,
    intro:
      'The tool opens with one vertical line down the middle, so you get a left half and a right half. Switch to "2 down" for a top and bottom half instead, or drag the line to cut anywhere but the centre.',
    features: [
      'Left and right, or top and bottom',
      'Move the dividing line to any exact pixel',
      'Both halves keep the original resolution',
      'Download the two halves separately or as a ZIP',
    ],
    faq: [
      {
        question: 'How do I split an image in half?',
        answer:
          'Upload the image and the tool places one line down the middle. Click Split to get the left and right halves. To halve it top and bottom instead, choose the "2 down" preset before splitting.',
      },
      {
        question: 'Can I split it somewhere other than the exact middle?',
        answer:
          'Yes. Drag the dividing line, or type an exact pixel position in the line input. The two pieces then have whatever widths you chose, which is useful when the two halves of the picture are not the same size.',
      },
      {
        question: 'Do the halves lose quality?',
        answer:
          'Each half is redrawn from the decoded source at full resolution. PNG and WebP output keep those pixels. Choosing JPG re-encodes each half, which adds a second round of lossy compression.',
      },
      {
        question: 'How are the two files named?',
        answer:
          'A single row or single column is numbered in order, so a file called photo.png becomes photo-1.png and photo-2.png. Left comes before right, and top comes before bottom.',
      },
    ],
  },
  'split-into-4': {
    title: 'Split an Image Into 4 Parts — Free Online',
    description:
      'Cut one image into four quarters in your browser. Start from an even 2 by 2 grid, then move either dividing line to an exact pixel position.',
    defaultRows: 2,
    defaultCols: 2,
    intro:
      'The tool opens with a 2 × 2 grid, giving four quarters. Both dividing lines can be moved independently, so the four pieces do not have to be the same size.',
    features: [
      'Even 2 × 2 quarters in one click',
      'Move the vertical and horizontal lines independently',
      'Pieces named by row and column so the order survives',
      'Download the four pieces separately or as a ZIP',
    ],
    faq: [
      {
        question: 'How do I split an image into 4 equal parts?',
        answer:
          'Upload the image, keep the default 2 × 2 grid, and click Split. If the width or height is an odd number, the leftover pixel goes to the first piece, so no two pieces differ by more than one pixel.',
      },
      {
        question: 'Can the four parts be different sizes?',
        answer:
          'Yes. Drag either dividing line, or type an exact pixel position for it. This is how you cut a picture that is made of four differently sized pictures stitched together.',
      },
      {
        question: 'What are the four files named?',
        answer:
          'Pieces are named by row and column, so photo.png becomes photo-r1-c1.png, photo-r1-c2.png, photo-r2-c1.png and photo-r2-c2.png. Row 1 is the top row and column 1 is the left column.',
      },
      {
        question: 'Can I split into more than four parts?',
        answer:
          'Yes. Change the row and column count, or use Add line to place extra dividing lines wherever you need them, up to 144 pieces in total.',
      },
    ],
  },
  'instagram-grid': {
    title: 'Instagram Grid Maker — Split a Photo Into 9',
    description:
      'Split one photo into a 3 by 3 Instagram grid in your browser. Pieces are named by row and column so you can post them in the right order.',
    defaultRows: 3,
    defaultCols: 3,
    intro:
      'The tool opens with a 3 × 3 grid, the layout used for an Instagram profile puzzle. Square sources work best, so crop the photo to 1:1 first if it is not already square.',
    features: [
      '3 × 3 grid ready on upload',
      'Pieces named by row and column for posting order',
      'Adjust any dividing line if the subject needs a different cut',
      'No watermark and no account required',
    ],
    faq: [
      {
        question: 'How do I make an Instagram grid from one photo?',
        answer:
          'Upload the photo, keep the 3 × 3 grid, and click Split. You get nine pieces named by row and column. Post them so the grid reads correctly, which means starting with the bottom right piece.',
      },
      {
        question: 'In what order do I post the pieces?',
        answer:
          'An Instagram profile grid fills from the top left, and new posts push older ones to the right. To make the full picture line up, post the pieces in reverse: start with row 3 column 3 and finish with row 1 column 1.',
      },
      {
        question: 'What size should the photo be?',
        answer:
          'A square source works best because each piece then comes out square as well. Crop the photo to 1:1 first with the Image Cropper. A 1080 by 1080 source gives nine 360 by 360 pieces.',
      },
      {
        question: 'Does this post to Instagram for me?',
        answer:
          'No. The tool creates the image pieces in your browser and lets you download them. The selected image content is not sent to ToolkitFree for processing, and no Instagram account or login is involved.',
      },
      {
        question: 'Can I use a different grid than 3 by 3?',
        answer:
          'Yes. A 1 × 3 row is common for a carousel-style header, and 3 × 2 or 3 × 4 also work. Change the row and column count, or add and remove individual lines.',
      },
    ],
  },
  'split-for-printing': {
    title: 'Split an Image for Printing Across Pages',
    description:
      'Cut a large image into printable tiles in your browser, then combine the tiles into one PDF to print a poster across several sheets of paper.',
    defaultRows: 2,
    defaultCols: 2,
    intro:
      'Split a large picture into tiles that each fit on one sheet, then send the tiles to the Image to PDF tool to get a single printable file. Add a small discard width at each line if you want to trim the printer margins away.',
    features: [
      'Tile a poster across as many sheets as you need',
      'Discard a band at each line to allow for printer margins',
      'Move any line so a tile does not cut through the subject',
      'Combine the tiles into one PDF with Image to PDF',
    ],
    faq: [
      {
        question: 'How do I print a large image across several pages?',
        answer:
          'Split the image into as many tiles as you have sheets, download them, then open the Image to PDF tool and combine the tiles into one document. Print that PDF at 100 percent scale so the tiles line up.',
      },
      {
        question: 'How many tiles do I need?',
        answer:
          'Divide the finished poster size by the printable area of one sheet. An A4 sheet holds roughly 19 by 27 cm of printable area, so an A2 poster needs about 2 columns and 2 rows.',
      },
      {
        question: 'How do I allow for the printer margin?',
        answer:
          'Set a discard width at each line. The tool then drops a band of pixels at every cut instead of slicing at a single point, which leaves room for the unprintable edge without duplicating content.',
      },
      {
        question: 'Will the tiles line up when I tape them together?',
        answer:
          'The tiles are cut from exact pixel positions, so they line up if you print every sheet at the same scale with scaling turned off. Check that your print dialog is set to 100 percent rather than fit to page.',
      },
    ],
  },
};
