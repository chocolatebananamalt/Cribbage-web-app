# Reviewed native seating: authenticated transport and UI (local only)

## Implemented

Guarded authenticated production composition and GET/POST/readback routes, plus a reviewed-draw publication panel. Current Director/co-director access is checked before and after each operation. The panel retains the complete request before sending; it never redraws, replaces a nonce, clears mismatched recovery bytes or treats a thin acknowledgement as acceptance. Accepted POST requires exact stored readback. Actor/tournament changes remount and invalidate the old scope, so late old replies cannot clear the new request or unlock its flight.

The new SQL proposal is a pair of thin authenticated-only wrappers around the separately tested private core. It grants no private-table/core access. These wrappers are UNAPPLIED and UNEXECUTED. The app gate remains literally false, with local-loopback/deployment gates ahead of client construction. The RPC audit explicitly pins this local-only exception to wrapper and core source hashes; enabling it deliberately fails that audit until reviewed runtime/migration evidence replaces the exception.

## Evidence

- Handler and RPC contract checks: 16 passed. Independent final focused auth/handler/RPC review: 57 passed, no remaining P1/P2 before final request-type/fail-closed TypeScript corrections; those small changes were independently reviewed afterward with 9 handler checks passing.
- Actual local headless browser with real recovery coordinator and fictional intercepted API responses: 10 scenario groups, 320/390/768/1440 px, 100%/200% text. Explicit review; no initial publication; double click sends one POST; lost response/reload GET-only recovery; exact same-nonce busy retry; changed bytes preserve work and block old send; late old tournament POST leaves new scope locked and both recovery envelopes intact.
- Visual inspection caught inherited two-column review fields on phones; module now forces one-column fieldset. Phone normal, 320 px doubled text and desktop recovery screenshots inspected. Narrow enlarged table headings wrap and pages become tall; no document clipping observed. No accessibility certification claimed.
- Final pnpm verify exit 0: 1,409 application tests and 8 workspace checks passed, production dependency audit clean, lint, provider-readiness declaration checks and optimized production build passed. Separate pnpm verify:handoff: 6 passed. The final display-only caption correction followed this full suite; browser rerun explicitly asserts the recovered table says Published starting IDs. Its result.json is the authoritative browser receipt.

## Test corrections

Initial browser locator expected the textarea's exact accessible label after it contained text; changed to anchored textbox label. Existing no-store audit originally did not follow this new shared factory; extended its real AST import/export/factory wiring check with unsafe-substitution regression tests. Initial production build found NextRequest callback type mismatches and a union-narrowing issue; corrected to actual NextRequest type and explicit accepted/rejected-only recovery cleanup. None of these corrections changes the tested core SQL or bypasses authentication.

## Remaining gates

No new database fixture was created. Previously approved native-core fixture was already removed and remains separate proof. This slice has no actual authenticated public-wrapper SQL execution, browser-to-database chain, Supabase-provider session acceptance, hosted deployment, physical-room/human acceptance or scheduling/start action. New permission is needed for a disposable local database covering wrapper ACL/real authenticated role execution and combined HTTP-to-DB recovery/concurrency, followed separately by scoped provider/staging acceptance and reviewed migration/publication authorization. Do not enable or call this workflow against staging using this source-only checkpoint.

## Files and artifact coverage

SQL: database/proposals/reviewed-draw-authenticated-wrapper-v1.sql (SHA256 7e27fca258ba6767c6439843498fcb7418aba9d43990f0d918d569625ef7bfd0).
Private core unchanged: c1b91e64f8d0a31681a6835ef5440fc2d4716fa93de4ca066b05f25856cef50e.
Evidence: test-results/reviewed-native-publisher-browser/result.json and PNGs; reviewed-native-transport-verify.log and -handoff.log; reviewed-native-transport-contract.log.

## Backup note
The first transport archive is an intermediate checkpoint before the final caption correction. The v2 archive supersedes it with the final source, explicit caption assertion and matching browser evidence; neither archive implies backend/provider acceptance.
