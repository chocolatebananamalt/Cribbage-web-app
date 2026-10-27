# Director-selected setup prize schedule — local implementation plan

Owner approved this bounded local feature on 2026-10-27 after approving the fictional $480/$216/$264 rehearsal budget. No hosted draft mutation, publication or shared migration is authorized in this task. Preserve the staging draft and existing director session. This adds a configurable director rule, not an ACC-mandated prize formula.

Acceptance: explicitly opt into a structured schedule from setup; save positive per-person weights for finishing bands 1, 2, 3–4 with source/reason/review and immutable version history. Preview estimated entries and expenses as assumptions only. Resolve actual totals from current paid entry evidence, all current recorded expenses and canonical four-qualifier/no-bye results. Bind an explicit scheduleVersionId in the settlement request/hash/draft; compare exact total-award claims and preserve equal 3–4 awards. Accepted payback facts snapshot records the resolved schedule and the final pins that review. Independent 85%-of-gross validation remains separate.

Supported slice: one positive-entry Standard Main, 12 games, exactly four qualifiers, no pools, byes, extra income, retained balance or eligibility exception. Explicit opt-in only; existing unstructured events retain their old request/read histories. Schedule revisions require explicit review/reason and stop once qualification is finalized or any playoff outcome, settlement draft/review/final exists. Unknown or different qualifier counts are blocked; no automatic alternative ratio. This is not a general bracket/payout policy engine.

Rounding is part of the saved rule: floor each per-person proportional share to whole cents, then assign every remaining cent to the singleton champion. Never split a shared cohort unequally. The estimate/resolution shows this rule and remainder. For approved TEST ONLY case: 16 x $30=$480; expenses sanction $48 + meals $96 + hall $48 + cards $24=$216; $264 prizes and zero retained. Weights 4,3,2-per-person produce total awards $96/$72/$48/$48. Eligible return $264+$48+$96=$408=85% gross, while all four expenses reduce cash once. No real money or actual sanction is represented. Current ACC Main minimum 17 means this sixteen-person fixture is software-only.

Persistence design: stable (tournament, setup client row) stream, append-only settings-fingerprinted rule versions and activation binding. Private forced-RLS tables, service-only actor-authorized RPCs, operation receipts/conflict history and consistent locks. Player-visible authorized summary contains schedule/history and reviewed awards only, excluding private ledger evidence and actor/receipt identifiers. Historical published evidence remains unchanged. No public unauthenticated share or new credential is needed.

Independent design review required explicit scheduleVersionId rather than selecting latest silently; nullable pins preserve historical rows. The existing immutable payback review is reused as the resolved-version record to avoid a redundant subsystem. Finalized records must not become stale due to later schedule updates; updates are closed before business outcome/draft records exist. New financial/source facts stale unfinalized reviews in the established way.

Checks required: strict API and pure arithmetic tests; SQL save/replay/conflict/auth/immutability/activation/settings/claim/final pin guards; actual overlapping sessions; phone/desktop repeated/interrupted saves and server-derived draft award controls; full pnpm verify; independent final review. Local test database must use reviewed official image, network none, no exposed ports/mounts/privileges, empty reviewed baseline and cleanup. Browser tests are isolated synthetic localhost mocks, not authenticated hosted acceptance. Any missing checks remain explicit gaps.
## Final verification and reviewed artifact

Canonical migration file was generated through the pinned official CLI in an unlinked local workdir, then copied byte-identically from the reviewed proposal: database/migrations/0242_setup_prize_schedule_v1.sql. Proposal/canonical are **60,404 bytes**, SHA256 **4B93E65892A6CA7293A7485DF600EE1D16340823312686B7BDCB6CAA75971F2B**. This is local file registration, not hosted migration application. Published branch remains f85209e1f7e3cd181f13e0efe882efb6ac9099d9 / draft PR 122. Staging remains at 0241; the saved rehearsal is untouched.

`pnpm verify` exited 0: **904/904 application tests**, production audit no known vulnerabilities, lint **0 errors / 2 existing warnings** (unused useEffect in event-control and shared-device-sign-out dependency), provider readiness and production build/typecheck passed; workspace **7 passed / 1 skipped** because private handoff is unavailable. No dependency, TypeScript configuration, credential, memory or deployment setting changed. A prior run failed because an ignored generated browser fixture supplied extra sentinel properties as a typed literal; the mock now parses JSON transport data. Application types/build checks remain strict; the final full run passed.

Actual PostgreSQL command: `node tests/run-prize-schedule-v1-isolated.mjs --isolated-container --container-id <created-id>`. EXIT 0, marker **PRIZE_SCHEDULE_V1_SUPPORTED_RESOLUTION_PAYBACK_AND_FINAL_PASSED**, final immediate constraints and rollback **0 users | 0 tournaments**. It exercises initial save/replay/stale/conflict, settings fingerprint/activation, qualification cutoff before playoff, orphan-stream reader filtering, unsupported scopes, exact schedule pins/claims, stale financial facts, payback review/finalization, immutable history and runtime ACLs. All six public RPC signatures are service-only; private helpers/direct table DML are not available to anon/authenticated/service roles. Four new tables are forced-RLS. Explicitly distinct unrelated outsider verifies reader denial; a linked roster player correctly receives the sanitized summary.

The supported fixture records 16 synthetic 3000-cent obligations/receipts and four synthetic expenses totaling 21600 cents through supported financial RPCs. Server derives awards 9600/7200/4800/4800, 40800-cent eligible return against 48000 gross, exact 85%, one accepted payback snapshot and final pin. Qualifying games/start/cross-check foundations are directly seeded; this does not prove a whole played tournament or HTTP authentication transport. New service RPCs are exercised with explicit actor arguments in the disposable database; actual privilege assertions enforce the server-only boundary.

Actual race command: `node tests/prize-schedule-concurrency.mjs --isolated-container --container-id <created-id>`. EXIT 0, marker **PRIZE_SCHEDULE_REAL_OVERLAP_SAME_KEY_AND_STALE_VERSION_PASSED**. Two independent sessions were observed waiting on locks in each race. Same-key requests replay one version; competing expected-version requests produce one success and one stale rejection. Final counts: **1 stream, 2 versions, 3 receipts, 3 audits, 0 event bindings/finals**. Race database removed; original database stayed empty. This tests pre-activation schedule saves, not finalization-versus-ledger mutation races or forced response loss.

Database isolation: existing reviewed official image public.ecr.aws/supabase/postgres:17.11.0.004, image SHA b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706; network none, zero mounts/binds/ports, nonprivileged. Empty baseline SHA e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc. Runners require a correctly formatted exact container ID supplied per invocation and inspect the fixed task name; no machine-specific container ID is embedded in published source. Invalid/missing/extra arguments are tested before Docker access. Exact task container removed after final review and empty-state check; no disposable resources remain.

Three actual isolated headless browser suites passed:
- `node tests/prize-schedule-browser.mjs`: 390/1440 px without overflow; approved $480/$216/$264 estimate and $96/$72/$48/$48; blank/unchecked rejection, duplicate taps, aborted save, retained exact retry, null receipt, known rejection, newer/malformed storage, stale-settings revision, activation-blocking state, and unordered saved cohorts. Four intercepted mock writes, zero backend writes.
- `node tests/settlement-schedule-browser.mjs`: three mocked server calculations; source change invalidates old calculation; explicit Use copies four total claims without a write; separate Save sends one pinned draft request; reload preserves it. An older retained unpinned request is not silently upgraded. One intercepted draft write, zero backend writes.
- `node tests/prize-summary-browser.mjs`: phone/desktop and print emulation/PDF; saved history, approved amounts, 500-character unbroken source, absence of actor/operation/ledger sentinels, and distinct empty/unavailable states. No API calls. Screenshots/PDF and server logs remain ignored in test-results.

Independent design/code/runtime review: **GO; no remaining P1/P2**. Review fixed first-save availability, policy-only fingerprinting, lock order, active-roster bijection, controlled errors, large-number parity, optional prize order, orphan streams and the qualification-finalization cutoff. Runtime caught a conditional-parser defect and a fixture-only wrongly labelled outsider; corrected and rerun. A changed expense correctly produces schedule_claim_mismatch for adopted schedules; historical unstructured paths keep their old diagnostic order.

Two early hash-pin edits were rejected by automatic review while their source was unexplained. Read-only evidence established (1) unchanged 0240 raw CRLF hash 92f81... versus its already reviewed normalized LF hash 19107..., and (2) a proposal comment-only header change whose exact reversal reconstructed the prior checksum. One explained same-action retry was admitted in each case; no integrity guard, approval control or access restriction was bypassed. No uncertain database operation remains.

## Remaining acceptance and separately reviewed rollout

This patch is complete locally and **unpublished**. No hosted business record, role, invitation, financial entry, prize claim or final settlement was created. Director session is preserved. The user's approved rehearsal budget and weights remain valid; dependent hosted work stays held until this feature is separately rolled out. B still needs this tournament's cross-checker nomination/personal acceptance and authorized nonplayer attestation; no prior role carries across.

Smallest future rollout: approve the final sanitized diff for the existing repair branch/draft PR, verify exact-head CI and its Git Preview, verify fresh authenticated staging isolation, then apply only checksum-verified 0242 to nnhcnvksxgxnpvdqjgpg after history/writer/queue checks. Read-only verify stored SQL/history, ACL/RLS/triggers and unchanged business counts. No production, credentials, settings or paid services are needed. Do not use the denied redeploy route. Stop on drift/failed checks/isolation/uncertain apply; reconcile before retry. App-only rollback cannot let old clients bypass adopted schedule pins: preserve read-only records and review a forward fix rather than dropping history.

Limits: exactly four no-bye qualifiers in one positive-entry Standard Main 12-game event, no Q/side pools, retained balance, other income or legal-age/fee exceptions. Larger/bracket-changing cases fail closed and need separately supported rules, not an inferred ratio. Equal-cohort awards and champion-only remainder are this explicit director-selected app policy, not a mandated universal ACC split. Whole hosted funded acceptance, actual photo/OCR, physical multi-device/offline/concurrency, SMTP, Q Pool membership/payouts, production backup/restore/release and unresolved staging password rotation remain separate gates. Production dependency audit was fresh; no claim of a fresh development-inclusive audit. Current ACC Main minimum 17 means the sixteen-player rehearsal is software-only, never actual sanction certification.

## Final worktree inventory

34 current uncommitted files since published f85209e, including the prior local-only 0241 rollout report. This feature accounts for the other 33. Lead integrated API/UI and owned final verification; separate domain/SQL and UI/browser workers returned checkable evidence; an independent high-risk reviewer reviewed design, code and executed runtime results. No worker was sole authority for payout math or permissions. Final pattern scan of these files found no credential/private-path pattern matches (not an absolute secret guarantee). Runtime caches and test-results remain excluded. No memory file changed.

- database/migrations/0242_setup_prize_schedule_v1.sql
- docs/product/production-requirements.md
- docs/product/requirements.md
- docs/quality/2026-10-27-proposed-prize-schedule-v1.sql
- docs/quality/2026-10-27-setup-prize-schedule-local.md
- docs/quality/2026-10-27-staging-0241-rollout.md
- PROJECT_STATUS.md
- src/app/api/v1/tournaments/[id]/events/[eventId]/prize-schedule-resolution/route.ts
- src/app/api/v1/tournaments/[id]/setup/prize-schedules/[rowId]/reconciliation/route.ts
- src/app/api/v1/tournaments/[id]/setup/prize-schedules/[rowId]/route.ts
- src/app/tournament/[tournamentId]/events/[eventId]/settlement-v5/page.tsx
- src/app/tournament/[tournamentId]/events/[eventId]/settlement-v5/settlement-v5-client.tsx
- src/app/tournament/[tournamentId]/page.tsx
- src/app/tournament/[tournamentId]/prize-schedules/page.tsx
- src/app/tournament/[tournamentId]/prize-schedules/prize-schedule-summary.tsx
- src/app/tournament/[tournamentId]/setup/prize-schedule-client.tsx
- src/app/tournament/[tournamentId]/setup/setup-client.tsx
- src/lib/api/payback-review.ts
- src/lib/api/prize-schedule.ts
- src/lib/api/settlement-v5.ts
- src/lib/api/setup-activation.ts
- src/lib/client-session-storage.ts
- src/lib/results/prize-schedule.ts
- tests/prize-schedule-api.test.mjs
- tests/prize-schedule-browser.mjs
- tests/prize-schedule-concurrency.mjs
- tests/prize-schedule-runner-contract.test.mjs
- tests/prize-schedule-v1-source-contract.test.mjs
- tests/prize-schedule-v1.sql
- tests/prize-schedule.test.mjs
- tests/prize-summary-browser.mjs
- tests/run-prize-schedule-v1-isolated.mjs
- tests/settlement-schedule-browser.mjs
- tests/setup-activation.test.mjs
