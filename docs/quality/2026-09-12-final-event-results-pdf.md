# Final Event Results PDF Verification — 2026-09-12

## Acceptance contract

- Only a signed-in tournament role may request the report.
- No provisional or superseded result chain may produce a final PDF.
- Qualification rank and playoff placement remain separate.
- Qualifiers remain highest-to-lowest; High Non-Qualifier is unnumbered and follows them.
- Director-reviewed MRP, Q-pool, other-award, and playoff-prize values appear without claiming automatic ACC calculation or submission.

## Evidence

| Check | Result |
| --- | --- |
| Pure report validator/PDF tests | Pass: PDF parses with `pdf-lib`, has PDF signature/title, and malformed IDs, ranks, totals, duplicate identities, and non-qualifier playoff identities reject. |
| Disposable hosted database | Pass: migration 0153 applied; function is stable `SECURITY DEFINER`, executable only by `service_role`, and an unauthorized actor receives null. |
| Full synthetic hosted lifecycle | Pass on disposable and pilot: rollback-only qualification fixture plus playoff/draft/manual-finalization lifecycle produced the complete version-bound report and rejected an unauthorized reader. No fixture rows were retained. A review-discovered multi-event setup join was scoped to the selected event and the corrected function was reapplied before release. |
| Pilot database | Pass: identical migration applied; catalog grants match disposable. |
| Application boundary | Pass: authenticated no-store PDF route; returns 409 until the exact final report exists; results screen displays the reviewed playoff finish, qualifying order, MRP/award values, and exposes the download only when the server report is ready. |
| Local production build | Pass after correcting the initial route import depth and TypeScript definite-assignment error. |
| PDF visual render | Pass: a 24-player synthetic final report with a 160-character unbroken name and 500-character unbroken source rendered through Poppler as two clean US Letter pages. Title hierarchy, playoff/qualification separation, explicit plus and minus columns, currency, HNQ placement, version details, repeated continuation header, and footer were readable with no clipping or overlap. `pypdf` extraction preserved every section and value. |
| Browser visual check | Pass at 1280×720 and 375×812 on `/demo`: meaningful content, no framework error overlay, and the existing responsive navigation/layout remained intact. The finalized-results link is intentionally absent without a finalized server report. |

## Remaining limitation

The shared pilot currently has no retained finalized qualification fixture, so a permanent live PDF cannot be downloaded until the director completes a real event through settlement finalization. The full hosted lifecycle was nevertheless executed inside rollback-only transactions in both databases. Physical browser/download and print inspection remains part of the director rehearsal.

## Independent review closure

The focused high-risk review found three medium-priority gaps. All are closed in this change: the on-screen and printable qualifier records now carry separate plus and minus totals, wrapping hard-splits oversized unbroken tokens instead of allowing horizontal overflow, and the response validator rejects duplicate playoff identities or playoff placements for anyone outside the finalized qualifier list. The hosted lifecycle fixture also proves a newer incomplete settlement draft immediately hides the older final report.
