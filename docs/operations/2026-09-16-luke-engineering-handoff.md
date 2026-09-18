# ACC Tournament Desk — Engineering Handoff for Luke

> Historical snapshot prepared on 2026-09-16. For the current 2026-09-17
> Setup/workspace/Judge Call release and an explicit seven-phase gap matrix,
> read `2026-09-17-luke-streamline-and-judge-call-handoff.md` first.

**Audience:** an implementation-capable AI coding agent with repository, GitHub, and Supabase Developer access.
**Prepared:** 2026-09-16 (Hawaii)
**Purpose:** make the remaining production work diagnosable without rediscovering the project history. This is not a product overview and must not be treated as evidence that a physical tournament rehearsal passed.

## 1. Working baseline and access boundaries

### Current deployed baseline

- Production URL: `https://cribbage-web-app.vercel.app/`
- Current Production deployment: `dpl_BehnrdzFhFsjXwyjrgKeKhqtPyc9`, state `READY`, GitHub `main` commit `7105e79e2780c55c8df37cd29bc8ad0b83d3f0d9` (PR #61).
- Vercel runtime-error scan for the preceding 24 hours: no grouped runtime errors and no `error`/`fatal` runtime logs.
- Supabase project: `fnjkwymxpnsqvxtpronk` / **ACC Tournament Pilot Integration**. Do not run unreviewed production SQL or directly edit application tables.
- Current rehearsal record: **Genesis Rehearsal**, `257e8c68-8299-4a20-bce1-93902f41cc7a`, `status=open`, `registration_status=open`, planned start `2026-09-16`.

### Current rehearsal event facts

| Event | Type / format | Current scoring method | Operational state |
| --- | --- | --- | --- |
| Main Event | Main / Standard Singles | digital | active |
| Consolation Event | Consolation / Standard Singles | digital | active |
| Satellite Event -C.D. | Satellite / Canadian Doubles | digital | active |
| Canadian Doubles Practice | Satellite / Canadian Doubles | digital | active |
| Satellite Event - Paper team Doubles | Satellite / Traditional Doubles | manual | **retired** |

The retired event must stay retained for audit history but must not be offered for enrollment, setup changes, team upgrades, seating, or scoring.

### Non-negotiable operating rules

1. Read `AGENTS.md`, `START_HERE.md`, `PROJECT_STATUS.md`, `docs/operations/DURABLE_PROJECT_MEMORY.md`, and `docs/quality/VERIFICATION.md` before changing code.
2. All score, money, role, seating, sync, and correction changes are server/database-authorized. Never repair a role or tournament record with an ad hoc table update.
3. Keep app code in `src/`, tests in `tests/`, migrations append-only in `database/migrations/`, and operational evidence in `docs/quality/`.
4. Do not commit credentials, real player data, magic links, Supabase service keys, screenshots containing private information, or files from `imports/`/`docs/private/`.
5. Every material change requires a regression test, `pnpm verify`, relevant hosted/database checks, a diff review, updated operational evidence, and `PROJECT_STATUS.md`.

## 2. What is demonstrably working

This section means implementation/deployment evidence exists. It does **not** replace the still-required independent-device rehearsal.

| Area | Proven implementation boundary | Primary evidence |
| --- | --- | --- |
| Authentication | Passwordless email sign-in, callback exchange, tournament-scoped access, and sign-out are implemented. Anonymous protected routes return `401`/no-store. | `src/app/sign-in`, `src/app/auth/callback`, private Supabase server client and production smoke records. |
| Setup lifecycle | Draft setup → explicit **Finalize All Events / Open Registration** → QR/link issuance; registration is separate from seating and Start Play. | `src/app/tournament/[tournamentId]/setup`, `src/app/api/v1/tournaments/[id]/setup/activation/route.ts`, migrations 0137/0193/0195+. |
| Registration/roster | Public claims queue; duplicate review, director/co-director promotion, cash/check intent/receipts, check-in, seating assignment, and role-limited lookup exist. | Registration, roster, payments, seating routes/workspaces and SQL fixtures. |
| Singles scoring | 1–121 spread validation, derived 0/2/3 game points, reciprocal scorecards, two independent submissions plus two confirmations, no self-review, correction audit trail, and pending-entry exclusion from standings are implemented. | `src/lib`, scoring API routes, `tests/game-api-semantics.test.mjs`, scorecard/result fixtures. |
| Paper/hybrid evidence | Private paper-card capture/upload/review path exists. Images have opaque paths, server authorization, digest/size checks, signed upload, and non-authoritative human review. OCR remains default-off. | `src/components/private-paper-card-photo.tsx`, paper-card API modules, migrations 0162+, paper-card tests. |
| Offline/recovery foundation | Authenticated idempotent retry queue, no-double-submit semantics, and device-failure recovery records exist. Pending local work is not server verified. | `src/lib/offline*`, recovery API/workspaces, offline queue/recovery tests. |
| Results/finance | Qualification ordering is separate from playoff result placement. Main/Consy MRP calculator uses the recorded `2016-08-01` schedule source; Satellite results explicitly have no MRP/qualification effect. Cash/check ledger, Side Pool workflow, reconciliation, CSV/PDF generation, and result finalization are implemented. | `src/lib/results`, settlement/finalization routes, financial workspaces, migrations 0190 and later. |
| Team scope | Two-person Traditional/Canadian Doubles have a normalized team/member model, a designated scorer, Digital/Paper shared card mode, team verification rules, and reporting fields. Generic/custom team formats remain non-digital. | team routes/workspaces, `tests/october-team-scoring.sql`, team migrations. |

## 3. Defects and code risks that need work

### P0 — setup finalization is not atomic across its dependent operations

**Status:** open code defect; it can produce a false `503` after finalization has already committed. This is the most important handoff item.

**Exact path:** `POST /api/v1/tournaments/:id/setup/activation` in `src/app/api/v1/tournaments/[id]/setup/activation/route.ts`.

**Current sequence:**

1. `finalize_tournament_setup_and_open_registration_v1` commits activation and opens registration.
2. The Next.js route separately calls `materialize_tournament_setup_side_pools_v1`.
3. For doubles, it separately calls `enable_supported_team_scoring_v1`.
4. Either later RPC can fail after step 1 committed; the route returns `503 operation_unavailable` despite an active/open tournament.

**Why retry is unsafe/incomplete:** an exact retry sees the already-finalized setup and may not carry an `events` array compatible with the later dependent calls. The caller sees an unresolved state even when registration is open. This is the same failure shape behind the earlier misleading **Retry Finalize & Open Registration** experience.

**Required implementation:** replace the multi-RPC route sequence with one server-only transactional RPC that performs activation, side-pool materialization, and supported-team enablement under the same idempotency receipt/transaction. It must return one durable result for both first execution and exact replay. Do not use a browser/client compensating transaction.

**Acceptance tests:**

- Inject a side-pool materialization failure and a team-enablement failure; prove activation/registration changes roll back in both cases.
- Send the same idempotency key twice; prove one activation, one set of side-pool materializations, one team capability state, one receipt, and identical returned response.
- Send a changed request with a reused key; reject it without side effects.
- Verify active Main/Consy/Satellite states, QR issuance, and registrations after a successful committed result.

### P1 — `Setup Amendments` repeats the same non-atomic orchestration pattern

**Exact path:** `src/app/api/v1/tournaments/[id]/setup/amendments/route.ts`, especially the calls to `materialize_tournament_setup_side_pools_v1` and `enable_supported_team_scoring_v1` after setup amendment processing.

**Risk:** an appended event can persist while Side Pool materialization or team capability enablement fails. A retry must not duplicate pools, create orphaned team capability records, or conceal an active event from the director.

**Required implementation:** use the same one-transaction command used for P0, parameterized for initial finalization vs. permitted append-event amendment. Preserve immutable setup versions/receipts and event-change audit history.

### P1 — real live rehearsal acceptance is unverified, not an assumed pass

The following code exists, but there is no evidence yet from two independent authenticated people/devices in the actual rehearsal. Treat every item as a release gate, not an implementation absence:

- Digital/Digital, Digital/Paper, and Paper/Paper Singles entries with two independent submissions and confirmations.
- Digital/Digital, Digital/Paper, and Paper/Paper supported two-person team entries, scorer replacement, four-member display, reciprocal team cards, mismatch, and correction.
- Single-device outage, whole-venue outage, reload/reconnect, exactly-once synchronization, and reconstruction of a failed device using an opponent/paper evidence path.
- Initial seating publication, search by name/ACC number, paper-card list/printout, and verification-ID persistence across rotations.
- Director/co-director/cross-checker role acceptance/revocation boundaries and co-director invitation acceptance.
- Cash/check partial payment, correction/void/refund, Side Pool elections/receipts/payouts/reconciliation, Main/Consy automatic MRPs, Satellite no-MRP report, and final PDFs.

The definitive checklist is `docs/operations/OCTOBER_PILOT_REHEARSAL.md`; record results/screenshots and exact failed request IDs in a new dated `docs/quality/` evidence file.

### P2 — production historical/status documentation has stale or inconsistent counts

`PROJECT_STATUS.md` contains historical statements such as test totals and older setup labels that are correct for their dated releases but cannot be read as current live proof. Do not mass-edit history. Add a new dated status entry only after evidence and use current commands/results. The current project status already says the physical rehearsal is open.

### P2 — optional providers deliberately remain disabled

These are not October bugs and must not be turned on just to eliminate a warning:

- Online payment providers (Stripe/Cash App Pay/Apple Pay/Google Pay/Venmo): future default-off layer; cash/check is the operational path.
- External OCR: default-off until provider/privacy, false-read, and live evidence gates pass. Manual paper transcription/cross-check remains supported.
- SMS: deferred notification channel; seating lists and in-app lookup are the required path.
- ACC automated portal submission: no approved API/import contract; use the director-reviewed export/manual entry workflow.

## 4. Recent fixed failures: keep regressions from returning

| Former observed failure | Cause | Current prevention | Regression target |
| --- | --- | --- | --- |
| Setup fields shrank to checkbox dimensions | broad checkbox CSS matched generic setup inputs | scoped `.policy-settings.setup-workspace input` rules | phone + desktop fields accept text/date/money values while draft is editable |
| Registration QR/link said unavailable | saved setup lacked public tournament phone/email | structured contact validation before QR issuance | link remains denied with a specific `registration_contact_required`; works after a saved valid revision |
| Finalization said retry/503 for a legacy manual team event | activation-state reader rejected valid scoreless manual legacy team event | `get_tournament_setup_activation_state_v3` treats valid legacy state correctly and excludes retired events | active legacy team event reads stable; retired event is absent from active list |
| Canadian Doubles event could not become digital-capable | legacy ruleset did not meet current team fixture requirement | guarded authorized ruleset upgrade migration/function | only scoreless eligible supported doubles can upgrade; started/unsupported events reject |
| Retired Traditional Doubles appeared active | activation-state query did not filter operational state | migration `0202_setup_activation_hides_retired_events.sql` filters `event.operational_state='active'` | retired event remains queryable only for history/reporting, never setup/enrollment |
| Q Pools and Side Pools were visually/operationally confused | configuration had no distinct setup contracts | max 2 Main/Consy Q Pools; max 6 separately named Side Pools per event | reject third Q Pool/seventh Side Pool and duplicate normalized Side Pool names; materialize exactly once |
| Shared-device button implied destructive clearing | sign-out and storage clearing were combined | normal Sign out preserves recovery; clear appears only if safe | unsent queue/retry denies clearing; next player cannot inherit unsafe prior-user state |

## 5. Implementation workflow for an AI agent

1. Create a focused branch; do not modify the live rehearsal as a debugging fixture.
2. Reproduce P0 in the disposable Supabase project with synthetic records. Add a failure-injection-capable SQL fixture before changing the route.
3. Design one server-only atomic RPC. It owns locks, authorization, validation, operation receipt, activation, pool materialization, and supported-team enablement. The HTTP route becomes a single RPC call plus strict response validation.
4. Apply the same command to append-event amendments, preserving the different authorization/lifecycle constraints.
5. Add source tests plus hosted disposable rollback/negative fixtures. Verify no direct browser role can execute the RPC.
6. Run `pnpm verify`, `pnpm verify:handoff`, `pnpm exec tsc --noEmit`, database fixtures, and protected phone/desktop browser checks. Review diff against `docs/product/production-requirements.md`.
7. Use PR review. Only after verified merge deploy through the owner-controlled GitHub → Vercel workflow. Check Production HTTP response and Vercel runtime errors after deployment.
8. Add dated quality evidence and a new `PROJECT_STATUS.md` entry. Do not mark the physical rehearsal passed without actual independent-device evidence.

## 6. Quick pointers

- Requirements: `docs/product/production-requirements.md`
- Owner decisions/current constraints: `docs/operations/DURABLE_PROJECT_MEMORY.md`
- Rehearsal protocol: `docs/operations/OCTOBER_PILOT_REHEARSAL.md`
- Setup activation route: `src/app/api/v1/tournaments/[id]/setup/activation/route.ts`
- Side Pool activation/materialization contract: `database/migrations/0198_setup_side_pool_definitions_and_recovery.sql`
- Team enablement: search `enable_supported_team_scoring_v1` in `database/migrations/` and `src/app/api/v1/tournaments/[id]/team-scoring/enable/route.ts`

## 7. Evidence limits

- The recent Vercel production scan was clean; that only establishes no observed runtime error in that time window.
- Tests/migrations establish server behavior and rejection paths; they do not prove people can complete a real tournament with multiple independent devices.
- No claim in this file authorizes ACC portal automation, official replacement of ACC systems, digital payment provider activation, or OCR provider activation.
