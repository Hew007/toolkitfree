import assert from 'node:assert/strict';
import {
  PDF_TOOL_BUDGETS,
  createPdfOutputName,
  hasPdfSignature,
  movePdfPage,
  normalizePdfRotation,
  parsePdfPageRange,
  rotatePdfPage,
} from '../src/lib/pdf-page-tools.ts';

assert.deepEqual(parsePdfPageRange('', 4), [0, 1, 2, 3]);
assert.deepEqual(parsePdfPageRange('1-3, 5, 3, 7-8', 8), [0, 1, 2, 4, 6, 7]);
assert.deepEqual(parsePdfPageRange(' 2 , 4-5 ', 5), [1, 3, 4]);
assert.throws(() => parsePdfPageRange('0', 4), /between 1 and 4/);
assert.throws(() => parsePdfPageRange('4-2', 4), /lower to higher/);
assert.throws(() => parsePdfPageRange('1-a', 4), /not a valid/);
assert.throws(() => parsePdfPageRange('5', 4), /between 1 and 4/);

const signature = new TextEncoder().encode('%PDF-1.7\n');
assert.equal(hasPdfSignature(signature), true);
assert.equal(hasPdfSignature(new TextEncoder().encode('not a PDF')), false);

assert.equal(normalizePdfRotation(-90), 270);
assert.equal(normalizePdfRotation(450), 90);
assert.equal(rotatePdfPage(0, -90), 270);
assert.equal(rotatePdfPage(270, 90), 0);
assert.deepEqual(movePdfPage(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
assert.deepEqual(movePdfPage(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);

assert.equal(createPdfOutputName('report.pdf', 'combined'), 'report-extracted.pdf');
assert.equal(createPdfOutputName('report.PDF', 'individual'), 'report-split-pages.zip');
assert.equal(PDF_TOOL_BUDGETS.desktop.maxPages, 300);
assert.equal(PDF_TOOL_BUDGETS.mobile.maxPages, 150);
assert.equal(PDF_TOOL_BUDGETS.desktop.maxBytes, 100 * 1024 * 1024);
assert.equal(PDF_TOOL_BUDGETS.mobile.maxBytes, 50 * 1024 * 1024);

console.log(
  JSON.stringify({
    status: 'PDF_PAGE_TOOLS_VALIDATION_OK',
    rangeCases: 7,
    rotationCases: 4,
    budgetCases: 4,
  })
);
