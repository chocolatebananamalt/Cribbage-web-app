# Director chair-label download — 2026-11-10

## Actual app change

The existing `OneTableMovementPreview`, used by the Director preparation review, now has **Download Chair Labels** for its verified single-table18-chair case. A user click downloads `preview-chair-labels.html`, an offline printable file with18 physical-chair labels over three Letter sheets. It includes no player names/participant IDs, source digests, session data, scores or movement arrows. Chair1 says stationary in this reviewed layout. Existing source validation is reused and invalid/unsupported layouts expose no button. No draw/save/publish writer is called. File generation errors produce a safe status and object URLs are released.

The standalone HTML uses CSP default-none and inline CSS only; names/IDs of people never enter it and table labels are HTML-escaped. Print at actual size. Room capacity/furniture and any voluntary anchor choice still need actual verification. Download is not proof the seating was published or officially approved. No new permissions, routes or feature enablement were added; existing Director gate controls the parent component.

## Checks

Eight focused tests pass:18labels/3sheets/no secret/player output; corrupted/unsupported candidate rejection; six existing movement regressions. TypeScript and scoped ESLint pass. `tests/one-table-chair-labels-browser.mjs` bundles the actual React component locally and mounts only offline about:blank. At390/1440 a real button click triggered an actual browser download; saved HTML has18labels, prints to three PDF pages and passes all sheet bounds. Switching to a corrupted candidate removes the button. Zero network requests; fresh contexts closed. Evidence: `test-results/chair-label-download-20261110/result.json`, downloaded HTML, PDFs, button screenshots. No Next server/browser navigation or denied-origin workaround.

Full pnpm verify remains unavailable (pnpm missing; denied audit not retried). No fresh database fixture, scoring replay, hosted access/write, public upload/retry, role grant or payment. Real-device download/printing remains acceptance, alongside the broader trial's provider/cohort, physical-layout and staffing gates. This feature is local source only until an appropriately reviewed release is authorized and unblocked.
Independent source review: GO, no functionality/privacy/authorization blocker. Applied copy recommendation: Layout Preview and preview-chair-labels.html avoid implying completed human review. Focused8tests and actual offline click/download/PDF checks rerun after copy change pass.


Host precision: the shared preview is also used by local-seating-planner.tsx and roster-random-draw-client.tsx, including unreviewed or historical candidates. Download inherits each host's existing admission; it proves only mathematical consistency of that candidate, not current-plan status or completed human review. Labels deliberately use Layout Preview.

