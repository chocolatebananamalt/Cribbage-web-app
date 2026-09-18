// pdf-lib's standard fonts encode with WinAnsi. A Hawaiian name containing the
// okina (U+02BB) or a macron vowel throws, and it throws from
// widthOfTextAtSize as well as drawText, so measuring is enough to fail. Every
// PDF route runs inside withApiFailureBoundary, which reports that throw as
// 503, so one name took down an entire report.
//
// This tournament is run in Hawaii. These names are expected input.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import { clip, safeText } from '../src/lib/results/pdf-text.ts';

const HAWAIIAN = [
  'Kaleoʻokalani',
  'Māhealani',
  'Kahoʻohanohano-Delacruz',
  'Kealiʻikanakaʻole-Fonoti',
  'Puʻuwai Māhoe',
];

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the raw names really are unencodable, so this test is not vacuous', async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const name of HAWAIIAN) {
    assert.throws(() => font.widthOfTextAtSize(name, 10), /WinAnsi cannot encode/,
      `expected pdf-lib to reject the raw name ${name}`);
  }
});

test('sanitized names survive both measurement and drawing', async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([612, 792]);
  for (const name of HAWAIIAN) {
    const safe = safeText(name);
    assert.doesNotThrow(() => font.widthOfTextAtSize(safe, 10), `width failed for ${name}`);
    assert.doesNotThrow(() => page.drawText(safe, { x: 36, y: 700, size: 10, font }), `draw failed for ${name}`);
  }
  assert.ok((await document.save()).length > 0);
});

test('the okina becomes an apostrophe rather than a question mark', () => {
  assert.equal(safeText('Kaleoʻokalani'), "Kaleo'okalani");
  assert.equal(safeText('Kealiʻikanakaʻole'), "Keali'ikanaka'ole");
  // Accepted limitation, stated so nobody mistakes it for correct orthography:
  // macrons are stripped rather than rendered.
  assert.equal(safeText('Māhealani'), 'Mahealani');
});

test('every PDF builder routes drawn text through the shared sanitizer', () => {
  // satellite measures inside wrap(), so the sanitizer must sit on wrap's input:
  // sanitizing only at drawText still throws at widthOfTextAtSize.
  const satellite = read('src/lib/results/satellite-results-pdf.ts');
  assert.match(satellite, /const words = safeText\(text\)\.split/);
  assert.match(satellite, /from "\.\/pdf-text\.ts"/);

  const finalized = read('src/lib/results/finalized-event-report-pdf.ts');
  assert.match(finalized, /const words = safeText\(text\)\.split/);
  assert.match(finalized, /from "\.\/pdf-text\.ts"/);

  for (const file of ['src/lib/results/side-pool-report-pdf.ts', 'src/lib/results/team-results-pdf.ts']) {
    const source = read(file);
    assert.match(source, /drawText\(clip\(text/, `${file} must clip-and-sanitize before drawing`);
    assert.doesNotMatch(source, /drawText\(text\.slice/, `${file} must not draw a raw slice`);
  }
});

test('truncation marks the cut instead of silently amputating a value', () => {
  // A bare slice() turned "remaining $67.89" into "remaini", and an ACC number
  // "(HI4820)" into "(HI48" - a shorter value that still looks legitimate on a
  // report whose footer tells the director to verify awards before submission.
  const line = `  Team ${'Kealiʻikanakaʻole-Fonoti '.repeat(6)} received $123.45 remaining $67.89`;
  const clipped = clip(line, 110);
  assert.equal(clipped.length, 110);
  assert.ok(clipped.endsWith('...'), 'a truncated line must show that it was truncated');
  assert.doesNotMatch(clipped, /[^\x20-\x7E]/, 'clip must also sanitize');
  // Short lines are returned untouched, with no spurious ellipsis.
  assert.equal(clip('Place 1: Kaleoʻokalani', 110), "Place 1: Kaleo'okalani");
});
