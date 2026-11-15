# Final review: acknowledged approval versus unavailable current read

Base: 2496fb726118f87c29f587c567824bafc71503fb, not the unrestored overnight 13033415 candidate. Work is isolated in final-review-readback-20261115/candidate. Existing candidate and Library package remain unchanged.

## Actual reachable workflow inspected

- `/tournament/[tournamentId]/results` without an event is an all-event chooser, not an aggregate cross-event sporting ranking or payout. Event-specific Results reads authoritative event sources; Satellite and team/doubles have distinct paths. Do not combine their sporting rankings or funds by invention.
- For finalized supported standard-singles Main/Consolation and the primary Director, Results links to `finance/[eventId]/selected-step-awards` under existing gates. Its actual page mounts fund review, unpaid award review, and the existing final approval/closure component. The separate `final-review` page mounts that same component. These require current source evidence; screen availability alone is not provider acceptance.
- `finance/[eventId]/page.tsx` intentionally supplies `enabled={false}` to the legacy recorded-cost and playoff-prize sections. No attempt was made to turn them on. Event Desk's Finance link therefore does not establish those capabilities are usable.
- Final event approval/closure is event-scoped. Tournament dashboard archive is separate; it is not payment settlement or universal all-event financial closeout. No new global closeout, payout defaults, ACC award or money transfer is claimed.

## Reproduced application defect and minimal fix

In `modern-event-close-section-v1.tsx`, a bound accepted historical receipt and successful pending-to-archive transition were followed by a current GET. A failed GET entered the outer unknown-write catch, falsely stating that the exact request remained retained. Actual component reproduction at390/1440 showed pending0, archive1, POST1 alongside that false statement.

The fix catches only the subsequent read failure after successful archival. It reports the recorded approval and unavailable current records, preserves an empty current view, and requires explicit Refresh Current Records before further approval. The existing refresh invalidates consent. It performs no resend and makes no current-source assertion. Unknown response, unbound receipt and failed archive still use the unchanged exact-pending recovery path.

Only one product file changes. No DTO, SQL, grant, gate, payout, ledger, permission, scope or archive semantics change. No hosted requests, user session/draft access, tournament creation or publication occurred.

## Executed evidence

- Actual component browser, Chrome headless,390x1000 and1440x1000:8cases pass, covering accepted-receipt/current-read failure and explicit refresh with no second POST, unknown response loss, unbound receipt, and failed archival. Before-fix mode also passes by explicitly asserting the incorrect historical message and actual pending/archive/send counts. The ordinary after-fix expectation failed before the change.
- Browser fixtures use the actual React component and request constructor. Auth observer, recovery coordinator, storage and HTTP are synthetic ports; offline fixture supplies a deterministic UUID only where browser crypto lacks randomUUID. No genuine IndexedDB/SW/provider/SQL or multi-user acceptance is claimed.
- Existing `modern-event-close-v1.test.mjs`:9pass, including disabled/unauthorized transport, identity/session changes, held sources, exact historical recovery, separate closure confirmation and regular-only Consolation.
- Full application suite:3640pass/0fail. Full TypeScript noEmit/incrementalfalse and changed-file ESLint pass.
- Independent review by existing Sol reviewer: PASS/no must-fix. Compared1221sourcefiles; only this product file differs. Reviewed the real IndexedDB transition contract: true resolves after transaction completion, so pending deletion/history archival are atomic before the new message. Real storage/SW and live-provider acceptance remain outside these synthetic checks.

Required aggregate verification result and portable hashes are recorded in the adjacent support REPORT.md/MANIFEST.json. Do not describe this narrow correction as complete cross-event closeout acceptance.
