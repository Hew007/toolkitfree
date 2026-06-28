import assert from 'node:assert/strict';
import {
  PDF_PRESETS,
  PDF_VARIANT_PRESETS,
  calculatePdfPlacement,
  pixelsToMillimeters,
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
import { mapBackgroundProgress } from '../src/lib/background-remover.ts';

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

console.log(
  JSON.stringify({
    status: 'SECONDARY_TOOLS_ALGORITHM_OK',
    pdfVariants: Object.keys(PDF_VARIANT_PRESETS).length,
    faviconCases: 3,
    qrEncodings: 8,
    backgroundStages: 3,
  })
);
