# Paper-review completion and Director handoff

Local-only candidate, 2026-11-10. No hosted changes, publication retry, access activation, database fixture, external photo processing or real money.

## Completed behavior

The individual paper-game screen can return an official to the eligible paper-game directory after the entry step. A mismatch can also link a Director to the existing audited disagreement-review page. Opening either link performs no score mutation, confirmation, correction or advancement.

The server game page supplies the existing directory and correction-route availability flags. Both remain false. Display flags are not authorization: the destination pages and their authenticated readers still check actual access, current source and independent identity. The correction destination retains its primary-Director check; no role or permission was broadened.

Navigation requires a valid projected source, online connection, initialized storage, no operation in progress, no blocked state, no pending request and no dirty fields/acknowledgement. Capture and independent re-entry phases hide links even when fields are blank, protecting local card/photo work that is not represented in the score fields. Waiting, complete and mismatch views may return to the directory. Only a mismatch with a Director role may show the correction link. Co-directors and cross-checkers retain the existing instruction to ask the Director. No answers, scores or identity credentials are placed in URLs.

Changed application files:

- `src/lib/seating/native-mixed-paper-navigation-v1.ts` — bounded navigation projection.
- `src/components/native-mixed-paper-entry-v1.tsx` — safe handoff/return links and held-navigation explanation.
- `src/components/native-mixed-paper-provider-v1.tsx` and `native-mixed-bound-paper-screen-v1.tsx` — pass availability without changing transport, identity or pending-storage lifecycle.
- `src/app/tournament/[tournamentId]/rehearsal-paper/[eventId]/[startId]/[gameId]/page.tsx` — derive flags from actual existing route gates on the server.

## Verification

- `node --experimental-strip-types --test tests/native-mixed-paper-navigation-v1.test.mjs tests/native-mixed-paper-entry-view-v1.test.mjs tests/native-mixed-paper-provider-v1.test.mjs`: 18 passed (five new focused cases plus existing paper-entry/provider regression checks, including actual React SSR).
- TypeScript `--noEmit` and targeted ESLint passed.
- `node --experimental-strip-types tests/native-mixed-paper-navigation-browser.mjs`: actual React screen in fresh offline `about:blank`, 390px and 1440px, 16px/32px root text. Director link destination, Co-director exclusion, capture-stage hold, pending/dirty/offline/busy/blocked/stale/default-off holds, zero writes and zero network requests passed. Screenshot inspected at enlarged phone size; no horizontal overflow.
- Browser evidence: `test-results/paper-navigation-browser-20261110/result.json` and four screenshots. The browser harness needed its TS-versus-TSX loader distinction, standard empty public-env substitution and typography-tolerant heading locator corrected; no denied origin/navigation was attempted.
- Independent source review GO: no high-confidence authority/privacy/recovery defect. Navigation SHA-256 `d0e93affceeb7e13c962ddc8908a32e7be02265224ff57a88ae06aa730ed3a89`, paper-entry SHA-256 `775866fb767eaa49e396a3c92d54a66cc5c9653b92c1eb3aa9aa873ceaaa16ec`, server page SHA-256 `290670827831c9b917538b6cfd1f67f8eaada3160dc520f505d8a9dd97262b89`.

No new SQL or database behavior was introduced, so another database replay was unnecessary. Existing audited correction/evidence writers were preserved unchanged. Full `pnpm verify` and handoff were not run: pnpm remains unavailable in this shell and the denied audit/origin access was not retried.

## Remaining acceptance

This is not live or user-tested. Actual signed-in provider navigation, device/browser-back behavior and Director correction/resumption across separate accounts still require the reviewed hosted release and bounded cohort acceptance. Offline browser link clicks were intercepted to verify destinations without navigating or sending requests. No new payout, ACC, membership or independent-verification policy decision is required by this change. Publication remains paused under the existing restriction.
