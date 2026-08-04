import assert from 'node:assert/strict';
import {
  MIN_PLACEMENT_MM,
  PDF_PRESETS,
  PDF_VARIANT_PRESETS,
  autoArrangePage,
  calculatePdfPlacement,
  derivePdfPages,
  fitPlacement,
  moveItemToNewPage,
  moveItemToPage,
  movePageBy,
  movePlacement,
  pixelsToMillimeters,
  removeItemFromPages,
  rotatePlacementBy,
  rotatedAspect,
  scalePlacement,
} from '../src/lib/image-to-pdf.ts';
import { calculateSquareContainRect } from '../src/lib/favicon.ts';
import {
  buildEmailString,
  buildSmsString,
  buildVcardString,
  buildWifiString,
  colorContrastRatio,
  escapeVcardValue,
  escapeWifiValue,
} from '../src/lib/qr-data.ts';
import {
  BACKGROUND_PRESETS,
  backgroundLabelColor,
  mapBackgroundProgress,
  normalizeHexColor,
} from '../src/lib/background-remover.ts';

assert.equal(PDF_PRESETS[PDF_VARIANT_PRESETS['image-to-a4-pdf']].pageSize, 'a4');
assert.equal(PDF_PRESETS[PDF_VARIANT_PRESETS['image-to-pdf-no-margin']].pageSize, 'fit');
assert.equal(PDF_PRESETS[PDF_VARIANT_PRESETS['image-to-pdf-no-margin']].margin, 0);
assert.equal(PDF_PRESETS[PDF_VARIANT_PRESETS['jpg-to-pdf']].inputKind, 'jpeg');
assert.equal(PDF_PRESETS[PDF_VARIANT_PRESETS['png-to-pdf']].inputKind, 'png');

const landscapePlacement = calculatePdfPlacement(210, 297, 1600, 900, 10);
assert.equal(landscapePlacement.x >= 10, true);
assert.equal(landscapePlacement.y >= 10, true);
assert.equal(landscapePlacement.x + landscapePlacement.width <= 200.000001, true);
assert.equal(landscapePlacement.y + landscapePlacement.height <= 287.000001, true);
assert.equal(Math.abs(landscapePlacement.width / landscapePlacement.height - 16 / 9) < 1e-10, true);

const portraitPlacement = calculatePdfPlacement(279.4, 215.9, 600, 1200, 0);
assert.equal(portraitPlacement.x >= 0, true);
assert.equal(portraitPlacement.y >= 0, true);
assert.equal(portraitPlacement.x + portraitPlacement.width <= 279.400001, true);
assert.equal(portraitPlacement.y + portraitPlacement.height <= 215.900001, true);
assert.equal(pixelsToMillimeters(96), 25.4);
assert.throws(() => calculatePdfPlacement(20, 20, 100, 100, 10), /no drawable/);

assert.deepEqual(calculateSquareContainRect(1200, 600, 512), {
  x: 0,
  y: 128,
  width: 512,
  height: 256,
});
assert.deepEqual(calculateSquareContainRect(600, 1200, 512), {
  x: 128,
  y: 0,
  width: 256,
  height: 512,
});
assert.deepEqual(calculateSquareContainRect(512, 512, 32), {
  x: 0,
  y: 0,
  width: 32,
  height: 32,
});

assert.equal(escapeWifiValue('Cafe;5G, "A":\\'), 'Cafe\\;5G\\, \\"A\\"\\:\\\\');
assert.equal(
  buildWifiString('WPA', 'Cafe;5G', 'p,a:ss\\word', true),
  'WIFI:T:WPA;S:Cafe\\;5G;P:p\\,a\\:ss\\\\word;H:true;;'
);
assert.equal(buildWifiString('none', 'Guest', '', false), 'WIFI:T:nopass;S:Guest;;');
assert.equal(escapeVcardValue('A;B,C\\D\nE'), 'A\\;B\\,C\\\\D\\nE');
assert.equal(
  buildVcardString({
    first: 'Ana;Marie',
    last: 'O,Neil',
    phone: '+1,23',
    email: 'ana@example.com',
    company: 'A;B',
    title: 'Lead\nDev',
    website: 'https://example.com/a,b',
  }),
  [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:O\\,Neil;Ana\\;Marie;;;',
    'FN:Ana\\;Marie O\\,Neil',
    'TEL:+1\\,23',
    'EMAIL:ana@example.com',
    'ORG:A\\;B',
    'TITLE:Lead\\nDev',
    'URL:https://example.com/a\\,b',
    'END:VCARD',
  ].join('\r\n')
);
assert.equal(
  buildEmailString('a@example.com', 'A & B', 'Line one\nLine two'),
  'mailto:a@example.com?subject=A%20%26%20B&body=Line%20one%0ALine%20two'
);
assert.equal(buildSmsString('+123', 'A & B'), 'sms:+123?body=A%20%26%20B');
assert.equal(buildSmsString('', 'message'), '');
assert.equal(colorContrastRatio('#000000', '#ffffff'), 21);
assert.equal(colorContrastRatio('#777777', '#777777'), 1);
assert.throws(() => colorContrastRatio('black', '#ffffff'), /six-digit/);

assert.deepEqual(mapBackgroundProgress('fetch:model', 5, 10), {
  stage: 'model-download',
  label: 'Downloading AI model',
  percent: 50,
});
assert.deepEqual(mapBackgroundProgress('compute:inference', 3, 4), {
  stage: 'inference',
  label: 'Removing background',
  percent: 75,
});
assert.deepEqual(mapBackgroundProgress('compute:decode', 0, 0), {
  stage: 'model-initialization',
  label: 'Initializing AI model',
  percent: null,
});

/* --- WYSIWYG PDF layout ------------------------------------------------ */

assert.equal(rotatedAspect(400, 200, 0), 2);
assert.equal(rotatedAspect(400, 200, 180), 2);
assert.equal(rotatedAspect(400, 200, 90), 0.5);
assert.equal(rotatedAspect(400, 200, 270), 0.5);
assert.throws(() => rotatedAspect(0, 200, 0), /greater than zero/);

const pageItems = [
  { id: 1, startsNewPage: true, renderable: true },
  { id: 2, startsNewPage: false, renderable: true },
  { id: 3, startsNewPage: true, renderable: true },
];
assert.deepEqual(
  derivePdfPages(pageItems).map((page) => page.map((item) => item.id)),
  [[1, 2], [3]]
);
// Undecodable items never reach a page.
assert.deepEqual(
  derivePdfPages([
    { id: 1, startsNewPage: true, renderable: false },
    { id: 2, startsNewPage: false, renderable: true },
  ]).map((page) => page.map((item) => item.id)),
  [[2]]
);
// The first renderable item opens a page even when its flag says otherwise.
assert.deepEqual(derivePdfPages([{ id: 9, startsNewPage: false, renderable: true }]).length, 1);
assert.deepEqual(derivePdfPages([]), []);

/* Page shuffling. `layout` names the pages a list groups into, so each case
 * reads as the before and after the user actually sees in the editor. */
const layout = (items) => derivePdfPages(items).map((page) => page.map((item) => item.id));
const singles = (...ids) => ids.map((id) => ({ id, startsNewPage: true, renderable: true }));

// Combining is what dropping an image onto another page does.
assert.deepEqual(layout(moveItemToPage(singles(1, 2, 3), 3, 0)), [[1, 3], [2]]);
// ...and splitting it back out again must restore the original layout, which is
// the round trip that used to be impossible once two images shared a page.
const combined = moveItemToPage(singles(1, 2, 3), 3, 0);
assert.deepEqual(layout(moveItemToNewPage(combined, 3, 2)), [[1], [2], [3]]);
// A boundary of 0 puts the split page first, and one past the end puts it last.
assert.deepEqual(layout(moveItemToNewPage(combined, 3, 0)), [[3], [1], [2]]);
assert.deepEqual(layout(moveItemToNewPage(combined, 3, 2)), [[1], [2], [3]]);
// Splitting the image that opens a multi-image page leaves its page-mates behind.
const trio = moveItemToPage(moveItemToPage(singles(1, 2, 3), 2, 0), 3, 0);
assert.deepEqual(layout(trio), [[1, 2, 3]]);
assert.deepEqual(layout(moveItemToNewPage(trio, 1, 0)), [[1], [2, 3]]);
// An image that already owns its page cannot be split any further.
assert.deepEqual(layout(moveItemToNewPage(singles(1, 2), 2, 1)), [[1], [2]]);
// Combining an image with the page it is alone on is a no-op, not a duplication.
assert.deepEqual(layout(moveItemToPage(singles(1, 2), 2, 1)), [[1], [2]]);
// Dropping past the last page opens a page at the end.
assert.deepEqual(layout(moveItemToPage(singles(1, 2), 1, 5)), [[2], [1]]);
// An unknown id and an out-of-range boundary both leave the list alone.
assert.deepEqual(layout(moveItemToPage(singles(1, 2), 99, 0)), [[1], [2]]);
assert.deepEqual(layout(moveItemToNewPage(singles(1, 2), 1, -1)), [[1], [2]]);

// Page reordering carries every image on the page and never merges them.
assert.deepEqual(layout(movePageBy(trio.concat(singles(4)), 0, 1)), [[4], [1, 2, 3]]);
assert.deepEqual(layout(movePageBy(singles(1, 2, 3), 2, -1)), [[1], [3], [2]]);
assert.deepEqual(layout(movePageBy(singles(1, 2, 3), 0, -1)), [[1], [2], [3]]);
assert.deepEqual(layout(movePageBy(singles(1, 2, 3), 2, 1)), [[1], [2], [3]]);

// Removing the item that opened a page promotes its successor, skipping files
// that failed to decode because they never reach a page of their own.
assert.deepEqual(layout(removeItemFromPages(trio, 1)), [[2, 3]]);
assert.deepEqual(
  layout(
    removeItemFromPages(
      [
        { id: 1, startsNewPage: true, renderable: true },
        { id: 2, startsNewPage: true, renderable: false },
        { id: 3, startsNewPage: false, renderable: true },
      ],
      1
    )
  ),
  [[3]]
);
assert.deepEqual(layout(removeItemFromPages(singles(1, 2), 99)), [[1], [2]]);

const a4 = { width: 210, height: 297 };

// One image on a page must match the legacy contain-and-centre behaviour exactly.
assert.deepEqual(autoArrangePage(a4, 10, [2])[0], calculatePdfPlacement(210, 297, 2, 1, 10));

const arranged = autoArrangePage(a4, 10, [1, 1, 1, 1]);
assert.equal(arranged.length, 4);
for (const placement of arranged) {
  assert.ok(placement.x >= 10 - 1e-9, 'stays inside the left margin');
  assert.ok(placement.y >= 10 - 1e-9, 'stays inside the top margin');
  assert.ok(placement.x + placement.width <= 200 + 1e-9, 'stays inside the right margin');
  assert.ok(placement.y + placement.height <= 287 + 1e-9, 'stays inside the bottom margin');
}
// A 2x2 grid: first two share a row, first and third share a column.
assert.ok(Math.abs(arranged[0].y - arranged[1].y) < 1e-9);
assert.ok(Math.abs(arranged[0].x - arranged[2].x) < 1e-9);
assert.ok(arranged[2].y > arranged[0].y);
assert.throws(() => autoArrangePage({ width: 20, height: 20 }, 10, [1, 1]), /no drawable/);

const placed = { x: 50, y: 60, width: 80, height: 40 };
assert.deepEqual(movePlacement(placed, 10, -20, a4), { x: 60, y: 40, width: 80, height: 40 });
// Dragging far off-page keeps a sliver visible rather than losing the image.
const draggedOff = movePlacement(placed, -9999, -9999, a4);
assert.equal(draggedOff.x, MIN_PLACEMENT_MM - 80);
assert.equal(draggedOff.y, MIN_PLACEMENT_MM - 40);
const draggedFar = movePlacement(placed, 9999, 9999, a4);
assert.equal(draggedFar.x, 210 - MIN_PLACEMENT_MM);
assert.equal(draggedFar.y, 297 - MIN_PLACEMENT_MM);

// Scaling from 'se' keeps the north-west corner pinned and the ratio locked.
const scaled = scalePlacement(placed, 'se', 20, 10, 2, a4);
assert.equal(scaled.x, 50);
assert.equal(scaled.y, 60);
assert.ok(Math.abs(scaled.width / scaled.height - 2) < 1e-9);
// Scaling from 'nw' keeps the south-east corner pinned instead.
const scaledNw = scalePlacement(placed, 'nw', -20, -10, 2, a4);
assert.ok(Math.abs(scaledNw.x + scaledNw.width - 130) < 1e-9);
assert.ok(Math.abs(scaledNw.y + scaledNw.height - 100) < 1e-9);
// A purely horizontal drag must track the pointer exactly, not at half speed.
assert.equal(scalePlacement(placed, 'se', 20, 0, 2, a4).width, 100);
// A purely vertical drag drives the height instead.
assert.equal(scalePlacement(placed, 'se', 0, 10, 2, a4).height, 50);
// Collapsing the handle clamps to the floor instead of inverting the rect.
const collapsed = scalePlacement(placed, 'se', -9999, -9999, 2, a4);
assert.equal(collapsed.width, MIN_PLACEMENT_MM);
assert.ok(collapsed.width > 0 && collapsed.height > 0);
assert.throws(() => scalePlacement(placed, 'se', 0, 0, 0, a4), /greater than zero/);

const rotated = rotatePlacementBy(placed, 0, 90, a4);
assert.equal(rotated.rotation, 90);
assert.equal(rotated.placement.width, 40);
assert.equal(rotated.placement.height, 80);
// Rotating about the centre leaves the centre where it was.
assert.ok(Math.abs(rotated.placement.x + 20 - (placed.x + 40)) < 1e-9);
assert.ok(Math.abs(rotated.placement.y + 40 - (placed.y + 20)) < 1e-9);
assert.equal(rotatePlacementBy(placed, 270, 90, a4).rotation, 0);
assert.equal(rotatePlacementBy(placed, 0, -90, a4).rotation, 270);

// Fit stays inside the margin; fill covers the page; both stay centred.
const fitted = fitPlacement(a4, 2, 10, 'fit');
assert.deepEqual(fitted, calculatePdfPlacement(210, 297, 2, 1, 10));
const filled = fitPlacement(a4, 2, 10, 'fill');
assert.ok(filled.width >= 210 - 1e-9 && filled.height >= 297 - 1e-9);
assert.ok(Math.abs(filled.x + filled.width / 2 - 105) < 1e-9);
assert.equal(fitPlacement(a4, 2, 10, 'actual', 400, 200).width, pixelsToMillimeters(400));
assert.throws(() => fitPlacement(a4, 2, 10, 'actual'), /natural pixel/);

/* --- Background colour ------------------------------------------------- */

assert.equal(normalizeHexColor('#FF7A45'), '#ff7a45');
assert.equal(normalizeHexColor('ff7a45'), '#ff7a45');
assert.equal(normalizeHexColor('  #abc  '), '#aabbcc');
assert.equal(normalizeHexColor('abc'), '#aabbcc');
assert.equal(normalizeHexColor('#12'), null);
assert.equal(normalizeHexColor('zzzzzz'), null);
assert.equal(normalizeHexColor('rgb(1,2,3)'), null);
assert.equal(normalizeHexColor(''), null);

// A normalised colour must always be safe to hand to colorContrastRatio.
assert.equal(backgroundLabelColor('#000000'), '#ffffff');
assert.equal(backgroundLabelColor('#ffffff'), '#1f2937');
assert.equal(backgroundLabelColor('#0000ff'), '#ffffff');
assert.doesNotThrow(() => backgroundLabelColor('not-a-colour'));

// The E2E selects these exact values via [data-background-color].
assert.equal(BACKGROUND_PRESETS[0].value, 'transparent');
assert.ok(BACKGROUND_PRESETS.some((preset) => preset.value === '#0000ff'));
for (const preset of BACKGROUND_PRESETS) {
  assert.ok(preset.label.length > 0);
  assert.ok(normalizeHexColor(preset.swatch), `${preset.label} swatch must be a hex colour`);
}

console.log(
  JSON.stringify({
    status: 'SECONDARY_TOOLS_ALGORITHM_OK',
    pdfVariants: Object.keys(PDF_VARIANT_PRESETS).length,
    faviconCases: 3,
    qrEncodings: 8,
    backgroundStages: 3,
    backgroundPresets: BACKGROUND_PRESETS.length,
  })
);
