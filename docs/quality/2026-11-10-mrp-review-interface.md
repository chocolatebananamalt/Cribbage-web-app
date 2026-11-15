# Manual MRP evidence review interface — 2026-11-10

## Scope and correction

The existing SQL proposal already included `public.get_mrp_membership_manual_review_v1`; the earlier assessment that no SQL reader existed was incorrect. This change reuses it. SQL SHA256 remains f16fd5453c691d866b821c41310aab52fdc4404cf22c2c867edfbbf32a0fd4e7. No migration, grants or SQL execution needed. Prior authorized fictional runtime attempt2 verified primary-director/session/roster authorization, current history, immutable correction/withdrawal, CAS/concurrency/replay/rollback and cleanup (`test-results/mrp-membership-manual-review-runtime-20261109/attempt-2/state.json`). It is not proof of current hosted installation or provider acceptance.

## Implemented locally

- GET handler in existing manual-review API factory: normal cookie client; expected subject/session validated against claims and getUser before and after RPC; exact tournament/event/roster scope; private no-store responses. SQL remains authoritative for actual primary Director, live session and linked roster participant. Co-director labels never substitute for primary-director authorization.
- Shared browser-safe request/receipt contract, extracted without changing request semantics. Workspace decoder validates full scope, exact keys, sequential versions, unique IDs, prior chain, current head/digest, latest-observation/correction/withdrawal lineage and all pending/no-award flags. Malformed, stale-shaped, foreign and authority-claiming data is unavailable, not empty/eligible.
- Default-off API routes at `/api/v1/tournaments/[id]/events/[eventId]/mrp-membership-review` and `/reconcile`, using normal server cookie client only. Existing literal-false feature guard executes before client/body/params/RPC work. No gate or access change.
- Normal same-origin cookie browser transport, captured scope/subject/session, pre/post current-owner checks and exact operation/request recovery. Valid body and HTTP status must agree: accepted/not-found200, rejection409, retry/blocked503; apparent success on500 remains unknown. No bearer/admin credential or external source request.
- `MrpMembershipReviewV1`: default-closed component for a future authenticated Director host. Explicit current-history load, selected-person context, source observation (default Unknown), evidence/source dates independently optional, verified website-error correction and withdrawal, append-only history/audit details. Correction only offered after an inactive/nonmember observation; unknown/not-found/unavailable cannot be overridden into eligibility. Every result remains Review Pending, awarded=null.
- No raw head IDs to type. Request binds the verified head/digest/observation/correction automatically. Evidence changes or unchecking confirmation invalidate old callbacks synchronously. Uncertain writes hold the exact in-memory request with explicit Check/Retry; no new operation until known outcome. Old rejection acknowledgements cannot discard newer pending work. Accepted receipt does not imply current head: reload required before another entry.

## Verification

26 focused handler/decoder/transport tests pass. Existing17 command/SQL-source tests preserved, plus3 GET cases,2 history-decoder cases and4 transport cases. TypeScript and scoped lint pass. Actual React offline about:blank at390/1440 checks default-off/no calls, verified head-bound correction, unknown write hold, identical operation/body reconciliation, unknown-status correction blocking, stale Save after uncheck/unmount and stale rejected-ACK after a new unknown request. Zero network; fresh contexts closed. Evidence: `test-results/mrp-review-interface-tests-20261110.log`, `test-results/mrp-review-interface-20261110/result.json` and screenshots. Initial harness label-selector error and reviewer-detected stale callback/status defects were corrected; final verification recorded after fixes.

## Explicit remaining gates

Not mounted in a real Director roster/Results page, not activated or published. A host must bind the actual selected roster person, normal verified account/session/project and current role, invalidate transport current() on changes, and enable only after reviewed release/provider acceptance. Local fake browser methods do not establish authentication. API routes remain404 by default; existing SQL/table ACLs closed.

Pending request is memory-only: page reload/scope remount loses its browser copy. Keep page open while uncertain; no durable cross-reload recovery claim. Server history/CAS/exact receipts protect persisted records, but full reload/device/provider acceptance remains.

No ACC grace period, historical status from current lookup, membership-effective-date inference, live directory lookup, registration rejection, result changes, official eligibility, MRP calculation/export or awards. This records evidence for later determination only. Full pnpm verify unavailable (pnpm missing; denied audit not retried). No fresh DB, hosted read/write, access activation, external image/source request, public upload/retry or payment occurred.
Independent final source review: GO, no remaining narrow P1/P2. Fixed stale/unmounted command callbacks, exact-pending rejected-ACK binding and canonical-body/HTTP-status mismatch before final verification. Actual form and uncertain-state phone screenshots visually inspected. Final26 focused tests and browser390/1440 pass after fixes. No additional SQL/database test was needed because reader/authorization SQL bytes remain unchanged.


Subsequent local integration mounts the component on Event Participants behind the unchanged OFF gate; see 2026-11-10-mrp-review-director-mount.md. The earlier unmounted-source limitation is superseded locally only; hosted activation/provider and durable recovery remain unverified.

