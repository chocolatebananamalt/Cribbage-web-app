// pdf-lib's standard fonts encode with WinAnsi (CP1252). A character outside
// that set throws, and it throws from widthOfTextAtSize as well as from
// drawText, so measuring a name is enough to fail. Every PDF route runs inside
// withApiFailureBoundary, which turns that throw into a 503, meaning one
// Hawaiian name takes down an entire report rather than degrading one line.
//
// This tournament is run in Hawaii, so the okina (U+02BB) and macron vowels are
// expected input, not edge cases. Every string drawn into a PDF must pass
// through safeText first.
//
// Known limitation, accepted deliberately: macrons decompose under NFKD and
// their combining marks are stripped, so "Mahealani" is printed without them.
// The okina is mapped to a straight apostrophe, the standard ASCII fallback.
// Rendering true Hawaiian orthography requires embedding a Unicode TTF through
// @pdf-lib/fontkit, which is the correct long-term fix and a larger change than
// belongs in a pre-launch patch.
export function safeText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[–—−]/g, "-")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[\u02bb\u02bc\u02bd\u2019]/g, "'")
    .replace(/[^\x20-\x7E]/g, "?");
}

// These builders draw a single unwrapped line and previously used a bare
// slice(), which silently amputated the tail of a settlement line: a dollar
// figure or the back half of an ACC number, leaving a shorter value that still
// looks legitimate on an official report. Marking the cut makes it visible.
export function clip(value: string, max: number) {
  const text = safeText(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3))}...`;
}
