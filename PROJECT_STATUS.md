# Project Status

## 2026-09-09 private check-in and initial seating boundary

- Applied pilot migration `0047_check_in_and_initial_seating`. Current directors/co-directors can record append-only check-in evidence and, only after registration is closed, publish one immutable initial Table/Seat list. That initial value becomes the permanent tournament verification ID; it is not a player's changing per-game seat.
- Focused Sol review repaired five P1 defects before application: a clean-chain duplicate constraint, replay after lifecycle changes, timestamp-based current-state ordering, incomplete conflict attribution, and post-publication roster/check-in drift. Final re-review found no P0/P1. Pilot catalog evidence confirms forced RLS, no direct anonymous/authenticated table access, authenticated-only empty-search-path RPCs, immutable history, same-tournament composite assignment provenance, and unique Table/Seat/verification IDs.
- This is deliberately narrower than an operational seating feature. The current roster has no player-account association, so player delivery, SMS/printing, round rotation, late-entry policy, table playthrough, and real multi-session lifecycle tests remain release gates. Details and exact remaining evidence are in `docs/quality/2026-09-09-check-in-initial-seating-pilot.md`.

## 2026-09-09 roster-to-account linking contract

- The scoring engine requires an authenticated assigned participant, while the approved roster intentionally has no account link. Recorded the next safe boundary in `docs/decisions/2026-09-09-roster-account-linking-contract.md`: a director/co-director explicitly links a pre-existing authenticated profile to one private roster entry, with immutable receipt/audit history and no name/email inference.
- This contract expressly does not create an account, role, payment, check-in, seat, event participant, or score action. Its implementation and real multi-account authorization evidence are still required before digital players can safely receive assignments or score.

## 2026-09-09 event enrollment contract

- Identified and documented the next required server transition in `docs/decisions/2026-09-09-event-enrollment-contract.md`: only a director/co-director may turn a linked, currently checked-in roster identity into one participant for an approved digital Standard Singles event. It rejects post-seating enrollment until an approved late-entry policy exists and makes no game, seat, score, payment, or role change.

## 2026-09-09 identity linking and guarded enrollment pilot

- Applied pilot migrations `0048` and `0049`: immutable independent roster-to-account linking and pre-seating director/co-director Standard Singles enrollment. The link rejects self-linking and creates no role/event/score authority; enrollment requires a linked, latest-state checked-in roster identity and an approved digital event, then creates no game or seat.
- Static regression coverage passed with 51 tests. Vercel built commit `36e1e14` Ready, returned a normal auth redirect, and had no grouped runtime errors in the one-hour scan. Real independent authenticated-session/database lifecycle evidence remains a release gate; see `docs/quality/2026-09-09-identity-enrollment-pilot.md`.

## 2026-09-09 retry-safe manual-payment client

- Added the protected director/co-director manual-payment workspace controls for the existing private roster ledger. A receipt can be recorded only as a strict positive decimal USD amount, an allowlisted manual method, canonical UTC timestamp, optional bounded note, and a fresh idempotency key; a current receipt can be voided only with a bounded nonblank reason. Neither action asserts paid-in-full, reconciliation, check-in, seating, enrollment, eligibility, or any financial balance.
- The browser retains only an opaque, per-account/per-tournament retry envelope containing operation identity, expected version, source receipt identity where applicable, idempotency key, and a local change detector. It never stores money, method, time, note, or reason. Ambiguous actions are locked and reconciled through the current-role server boundary; an explicit accepted result refreshes, an explicit rejection states that no evidence changed, and all authorization/network/malformed uncertainty remains locked.
- The client applies a synchronous double-activation guard before asynchronous digest work, rejects invalid local request shapes before storage or network activity, and treats any non-OK or mismatched response as nonterminal except for the strict known conflict shape. `pnpm lint`, 48 tests, production build, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed locally. Focused Sol re-review found no P0/P1; real independent director/co-director browser/database lifecycle evidence remains required before release.

## 2026-09-09 protected manual-payment mutation boundary

- Added strict same-origin, cookie-authenticated receipt, void, and recovery routes. They call only the existing narrowly authorized payment RPCs, validate canonical UTC receipt timestamps and integer USD cents, bind all accepted/rejected responses to the requested roster/version/receipt state, and send no direct-table or service-role request.
- Migration `0046_payment_operation_identity_recovery_authorization` changes recovery to return an explicit `{ authorized: true, result }` envelope for current director/co-director callers. The UI may treat only explicit `result: null` as an uncommitted operation; revoked-role or malformed recovery remains locked rather than silently discarded.
- Focused Sol review found and repaired four P1s (authorization/null ambiguity, loose recovery shape, ambiguous date/cents inputs, mixed rejected/success shapes) and a final response-discriminator P1. Final re-review found no P0/P1. The protected page remains evidence-only; its retry-safe mutation client and independent real-session lifecycle tests are still required before a director can record payment in the UI.

## 2026-09-09 meta release-readiness audit

- Completed a fresh requirement-by-requirement audit in `docs/quality/2026-09-09-meta-release-readiness-audit.md`. It confirms the current reviewed branch deploys as a protected Vercel Preview and has no seven-day runtime-error cluster, but it is not a production deployment and must not be represented as one.
- The audit resolved one newly discovered hardening gap by retiring the legacy three-argument payment-recovery RPC in migration `0044`; a Sol review and direct pilot catalog check confirm only the exact, role-scoped five-argument recovery function remains.
- The audit records the still-critical full-product release blockers: authoritative setup/check-in/seating, real dual-session scoring evidence, offline/hybrid operation, results/export/finalization/finance, approved ACC fixtures, backup/restore/rollback/monitoring, and accessibility/simulated-tournament evidence. These remain active work, not waived requirements.

## 2026-09-09 payment-operation identity recovery

- Applied pilot migration `0045_payment_operation_identity_reconciliation`. A future payment client can now safely reconcile an ambiguous receipt/void request using only the current actor, tournament, roster target, exact operation type, and idempotency key. It does not have to reproduce PostgreSQL's canonical financial-request hash in the browser.
- The client contract requires a pre-request opaque envelope with no money, method, time, note, or reason; its local digest is only a change detector, not authority. The original exact hash-bound reconciliation RPC remains available for server use, while the retired ambiguous three-argument signature remains absent.
- Focused Sol re-review found no P0/P1: the new function is current-role gated, exact-kind scoped, has an empty search path, denies `anon`, and is callable only by `authenticated` users. Lint, 48 tests, build, workspace/handoff verification, and diff check passed.

## 2026-09-09 payment-operation recovery hardening

- Applied pilot migrations `0043_payment_operation_reconciliation_hardening` and `0044_remove_legacy_payment_operation_reconciliation`. Payment recovery is now bound to current actor, tournament, roster identity, exact record/void operation type, idempotency key, and canonical request hash. The older three-argument recovery RPC was deliberately removed, leaving no weaker callable fallback. This prevents a retry from treating a void as a receipt or otherwise recovering a different financial action.
- Focused Sol review confirmed the older RPC was not a current disclosure but should be removed to eliminate an avoidable `SECURITY DEFINER` surface and future misuse path. Pilot inspection confirms only the exact five-argument RPC remains; it has an empty search path, denies `anon`, and is executable by `authenticated` callers only. Static regression coverage and `pnpm test` pass; payment actions themselves still require strict routes, opaque retry envelopes, and real-session lifecycle testing.

## 2026-09-09 protected manual-payment evidence workspace

- Applied pilot migration `0042_roster_payment_workspace`. A dynamic, director/co-director-only payment workspace now displays only private roster display names and immutable manual receipt/void history. It deliberately excludes email, ACC number, balance, paid-in-full/reconciliation claims, registration preference, seating, check-in, scoring, standings, and operational side effects.
- The server-only DAL calls only the narrowed RPC and fails closed unless the returned history is contiguous, correctly ordered and alternated, and internally consistent with its latest version/state/current receipt. The protected page has both server membership and database-role checks plus shared-device sign-out.
- Focused Sol review found and repaired two P1s before completion (empty authorized roster return shape and insufficient ledger relationship validation). Final review found no P0/P1. Lint, 48 tests including malformed-ledger rejections, production build, and diff check pass. Real independent director/co-director browser and database lifecycle tests remain release gates.

## 2026-09-09 immutable manual roster-payment evidence

- Applied pilot migrations `0040_manual_roster_payment_ledger` and `0041_roster_payment_history_indexes`. A director/co-director can now record a positive USD cash/check/other receipt for an existing private roster identity or void its current receipt with a reason. The ledger is immutable, versioned (`received → voided → received`), expected-version/idempotency guarded, privately audited, and never marks a player paid-in-full or reconciled.
- This deliberately does **not** process cards, treat a registrant's stated payment preference as proof, calculate fee balance, create a profile/role/participant/check-in/seat/verification ID, or affect scoring, standings, qualification, payout, export, or finalization. The optional receipt note is normalized and retained; void history preserves the original receipt.
- Focused Sol review found and repaired two P1 defects before application (discarded accepted note and cross-scope changed-retry conflict reference); final re-review found no P0/P1. Pilot inspection confirms forced RLS, no direct `anon`/`authenticated` access, authenticated-only narrowly authorized RPCs with empty search paths, and no remaining unindexed-foreign-key advisory. Lint, 48 tests, build, workspace/handoff verification, and diff check passed. Real multi-session receipt/void/replay/race/rollback testing and the broader finance reconciliation/payout implementation remain release gates.

## 2026-09-09 protected roster-promotion interface

- Added a director/co-director-only roster review page and server-only workspace DAL, plus protected roster-promotion and reconciliation routes. The client calls RPCs only, validates exact accepted/rejected results, and states explicitly that promotion does not create an account, payment, check-in, event enrollment, Table/Seat, or verification ID.
- Retry storage holds only an opaque decision ID and idempotency key under the existing shared-device-cleared `registration-operation:` prefix. Storage failure blocks submission; recovery reconciles before enabling actions; ambiguous network/5xx/malformed outcomes retain and lock the original request.
- Focused Sol review found and repaired three P1 retry defects (double-activation envelope replacement, unhandled reconciliation transport failure, and permissive terminal rejection handling). Final re-review found no P0/P1. Lint, 47 tests, and production build pass. Real independent-session/browser and persisted database assertions remain release gates.

## 2026-09-09 roster workspace recovery boundary

- Applied pilot migration `0039_roster_workspace_reconciliation`. The director/co-director-only roster read model now returns only approved, unpromoted same-tournament claims as promotion candidates, alongside existing private roster entries. It exposes a caller/tournament/decision/idempotency-scoped reconciliation RPC for interrupted roster-promotion requests.
- Focused Sol review found no P0/P1: candidates remain limited to approved/unpromoted decisions; PII is still private; reconciliation cannot cross actor, tournament, decision, or operation scope; and anonymous execution is revoked. A UI/API client still must validate exact responses, retain opaque retry envelopes only, and receive real independent-session testing before release.

## 2026-09-09 protected registration roster boundary

- Applied pilot migrations `0036_registration_claim_roster_boundary`, `0037_registration_review_roster_indexes`, and `0038_roster_promotion_authorization_repair`. An immutable director/co-director-approved claim can now create exactly one private roster identity snapshot, with composite same-tournament approval enforcement, replay/conflict handling, receipts, audit events, and no direct table access.
- The roster operation intentionally creates **no** Auth user/profile association, role, event participant, payment, check-in, Table/Seat, verification ID, or scorecard. Claim identity fields remain unverified intake data; account association and every operational state stay separate future controls.
- Focused Sol review found a P1 in the first writer (a revoked director could replay old identifiers and an unauthorized caller could write audit noise). `0038` now checks current director/co-director authorization before replay lookup and permits rejection/conflict audit writes only for an authorized actor. Final Sol re-review found no P0/P1. Pilot inspection confirms forced RLS, no direct `anon`/`authenticated` table access, authenticated-only RPC grants, empty function search paths, and no advisor `unindexed_foreign_keys` finding.
- `pnpm test` passed with 46 tests. Real independent-session authorization, concurrent replay, rollback injection, and persisted-data verification remain release gates; no UI was added in this integrity increment.

## 2026-09-09 protected registration-claim review boundary

- Applied pilot migration `0035_registration_claim_review_workspace`: director/co-director-only review decisions are immutable, collision-aware, idempotent, receipted, and audited. The decision response explicitly states that no roster, payment, or check-in record was created.
- Focused Sol review found four P1 integrity issues (collision approval branch, approved-claim collision visibility, unsuitable duplicate references, and null decision validation); all were repaired and the final re-review found no P0/P1. Pilot inspection confirms the writer exists, `anon` cannot execute it, and neither `anon` nor `authenticated` has direct table access.
- The review queue and future roster/payment/check-in/seating workflows remain distinct required increments. This is not a claim that a registration is enrolled or paid.

## 2026-09-09 registration claim-review contract

- A focused high-risk review established the next `R-REG-01` increment: a director/co-director-only, immutable registration-claim decision queue. It can only mark a claim `approved_for_roster` or `rejected`; it cannot create an Auth account/profile, roster role, event participant, payment record, check-in, seat, or verification ID.
- Recorded the required same-tournament collision resolution, locking, replay/conflict, receipt/audit, private-data, and rollback acceptance matrix in `docs/decisions/2026-09-09-registration-claim-review-contract.md`. This is an implementation contract, not a claim that the workflow is already built.

## 2026-09-09 director correction-policy workspace

- Added a protected director/co-director **Correction Policy** screen linked from Score Corrections. It exposes the approved defaults—immediate correction authority and optional reason—and lets an authorized official require a short correction reason and/or one independent approval for future corrections. The database remains authoritative; clients neither read private policy tables nor select a policy version.
- Applied pilot migration `0034_correction_policy_workspace`. It adds narrowly granted authenticated-only read/reconciliation RPCs and replaces the writer with an expected-policy-version guard. The legacy writer signature is removed, so two officials cannot silently overwrite each other: the first writer advances the version and a stale second request receives an immutable, reconcilable `stale_policy` rejection.
- Focused Sol review found and prompted repair of the stale-policy overwrite P1; the re-review found no P0/P1. Pilot inspection verified the guarded writer exists, the legacy signature is absent, `anon` cannot execute any new RPC, authenticated execution is limited to the narrowly authorized functions, and all three functions use `SECURITY DEFINER` with an empty search path. The Supabase advisory scan reports only the pre-existing private-table / intentionally authenticated-RPC notices and the previously accepted password-protection warning.
- `pnpm lint`, `pnpm test` (43 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. Preview deployment `dpl_12XA3jjFi9ZsczErUEAdgytXPQxL` for commit `3ac5f13` is Ready, returned the expected HTTPS app shell, and Vercel reported no runtime-error cluster in the one-hour scan. A real director/co-director browser concurrency exercise is still required before release.

## 2026-09-09 deployment runtime pin

- Replaced the open-ended Node engine range (`>=22`) with the tested `24.x` major to prevent Vercel from silently selecting a future Node major. The CI workflow and current local runtime already use Node 24. Added a regression check; lint, 42 tests, and the production build passed.

## 2026-09-09 shared-device sign-out and clear boundary

- Added a protected-screen **Sign out and clear this device** control to the tournament workspace, live score-entry, correction, and how-to views. It clears only this browser’s application retry/registration artifacts, calls a same-origin, origin-checked server route for **local-only** Supabase sign-out, propagates only Supabase cookie changes, and sends `Clear-Site-Data` for cache/storage before hard replacement to sign-in.
- Corrected four P1 findings in the first pass (the actual registration retry prefix, local rather than global sign-out scope, storage-failure continuation, and hard navigation) and two P1 findings in the re-review (no forwarding of Next internal request-override headers and a visible persistent local-cleanup warning). The final Sol re-review found no P0/P1 findings. `pnpm lint`, `pnpm test` (41 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed.
- This closes an implementation gap in `R-REG-01`; a real HTTPS browser Back/Forward and cookie/storage-clear exercise with an authenticated disposable account remains a release-verification gate.

## 2026-09-09 release-audit evidence refresh

- Corrected the release audit after verifying the current implementation rather than relying on its older baseline: the signed-in, assignment-scoped live score-entry route and the protected correction workspace are implemented in the supported Standard Singles pilot slice. The Vercel Preview for commit `49d4e52` is Ready and returned the expected root app shell without a runtime-error cluster in the bounded scan.
- This is evidence correction, not a production claim. The critical next proof remains two independent authenticated browser sessions against disposable synthetic data, followed by the documented rejection, race, and recovery paths. Broader event, finance, offline, results, rules, deployment, and operational gates remain open.

## 2026-09-09 protected correction workspace mutations

- Added the signed-in correction proposal and independent review controls to the protected workspace. They use only the existing server-authoritative API boundaries, display pending corrections as non-authoritative, and refresh the server-scoped workspace after an accepted outcome.
- Hardened ambiguous retry handling after an independent Sol review found two P1 issues: storage keys now contain no player names or correction reason and are scoped to the authenticated account; an opaque envelope locks the exact result or review decision after network/5xx/malformed-response ambiguity, so a user can retry it safely but cannot create a changed or reverse operation before refresh. Switching accounts on the same browser clears stale envelopes. A future sign-out/shared-device-clear control must use the same cleanup routine.
- Added a caller-scoped immutable-receipt reconciliation endpoint for ambiguous correction responses. It distinguishes proposal receipts (which target the game but contain an immutable correction ID) from review receipts (which target the correction); no reason is returned.
- `pnpm lint`, `pnpm test` (38 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. The pilot migration is applied. The final Sol review found no P0/P1 after the privacy, ambiguity, and receipt-target repairs. Local browser rendering is intentionally fail-closed without local public Supabase variables; hosted real-role phone/desktop verification remains a required release gate.

## 2026-09-09 protected correction workspace route

- Added the signed-in tournament-scoped correction workspace at `/tournament/[tournamentId]/corrections`. Its server-only data layer accepts only the narrow `get_correction_workspace` RPC shape and never reads private tables directly. The page makes Pending’s no-standings/no-export effect explicit and renders no actionable data if the database returns empty role-scoped collections.
- `pnpm test` passed with 36 tests, `pnpm lint` passed, and `pnpm build` passed with the protected correction route compiled. Mutation controls, retry UI, real role sessions, and browser verification are deliberate remaining gates; this route alone is not an operational correction workflow.

## 2026-09-09 protected correction workspace foundation

- Added a private actor-scoped correction workspace read RPC and narrow proposal/review HTTP boundaries. The workspace derives roles server-side, exposes only Draft Standard Singles candidates/pending reviews, excludes a cross checker from their own game and a reviewer from their own edit or either player’s game, and reveals optional reasons only to independently eligible reviewers. Authenticated users retain no direct read access to correction/private-state tables.
- Corrected three P1 findings during independent Sol reviews: the workspace’s missing read boundary, a reason-length rule that could otherwise be bypassed by direct RPC calls, and overly permissive accepted-response handling. New corrections now enforce both a 500-character/2,000-byte reason limit inside the private schema; endpoint contracts bind returned correction/game/version/decision fields to the exact request and preserve retries after malformed/mismatched responses.
- Pilot evidence: no-scope callers receive empty collections; `anon` cannot execute the new workspace function; authenticated has no direct `SELECT` on correction, state-event, or publication tables; a temporary trigger test rejected 501 characters and accepted 500 before rollback. Repository verification passed: 35 tests, lint, build, workspace, private handoff, and whitespace checks.
- This is not a release claim. A protected correction browser workspace, independent authenticated role sessions, direct-RPC visibility/revocation tests, concurrency tests, and immutable result-version/supersession remain required.

## 2026-09-09 public registration claim pilot

- Added the public QR/link registration foundation required by `R-REG-01`: high-entropy token hashes, a separate open/closed registration state, private append-only registration claims, and a small public API/page. The public boundary accepts only a registration claim and an intended payment method; it cannot create an account, role, roster/event participant, payment receipt, Table/Seat, or permanent verification ID.
- The live synthetic-pilot transaction verified open-link claim creation, payload-equal idempotent replay, changed-payload conflict rejection, duplicate-claim review hold, configurable total/hourly intake limits, link closure, direct anonymous table denial, and claim immutability. It found and corrected an email-validation error before persistence; every test transaction was rolled back.
- A focused security review then found three migration/replay defects before any public link was enabled: a clean-chain duplicate constraint, immutable-row interference with legacy fingerprint backfill, and delimiter-collision fingerprints. Migrations `0017`/`0018` now repair those paths with a guarded constraint, controlled trigger restoration, and canonical JSON fingerprints. A live anonymous synthetic collision regression returned `received` then `idempotency_conflict`; it was rolled back.
- Independent Sol security re-review found no remaining P0/P1 issues. Vercel Preview deployment `dpl_HiNqnX8is9tLTRfnf2Qv3P9rdsER` from `f883a3b` rendered the dashboard and the generic closed/unavailable registration state without a runtime-error cluster.
- Director/co-director review, manual-payment ledger, check-in, shared-device clearing, and seating remain explicit implementation gates. No public registration link is enabled permanently in the pilot.

## 2026-09-09 correction fingerprint compatibility hardening

- Replaced the correction RPC's delimiter-based request fingerprint with canonical JSON for fresh installations, and applied pilot repairs `0019`/`0020`. Existing immutable correction receipts remain replay-compatible through an exact legacy-hash comparison while all new receipts use canonical fingerprints.
- A transactional pilot test confirmed an old-format receipt replays its saved response and a changed reason containing `|` returns `idempotency_conflict`; all fixture writes rolled back. Independent Sol review found no remaining P0/P1 issue after the compatibility repair.

## 2026-09-09 correction-policy gap review

- The review confirmed an unimplemented `R-CORR-01` capability: directors cannot yet require a correction reason or independent approval. The existing correction engine remains safe for its immediate/optional-reason default, but does not satisfy the configurable-policy requirement.
- Recorded the reviewed implementation contract for append-only policy versions, immutable correction snapshots, pending-no-effect behavior, independent non-self approval, stale/published guards, lifecycle invariants, and the required concurrency/replay/rollback test matrix. No scoring behavior was broadened or guessed.
- Applied the first safe foundation: private immutable versioned policy rows, default version-0 provisioning for existing and future tournaments, and a foreign-key link from correction snapshots to policy versions. Configuration and pending-review RPCs are not implemented yet, so this schema does not present unavailable controls as working capability.
- Added the authenticated, director/co-director-only append-only policy configuration RPC. A pilot transaction created policy version 1 requiring a reason and one approval, then exact-replayed without creating another version; all transaction data rolled back. Proposal/review enforcement remains explicitly incomplete.

## 2026-09-09 correction-policy proposal safety repair

- Corrected two findings from the high-risk review before any production claim: the configuration repair migration now tolerates the clean `0022` to `0024` migration chain, and the policy-aware proposal function locks/reads the tournament row before accepting a new correction. The already-migrated pilot received repair `0026`.
- Added all missing foreign-key indexes for policy versions and configuration-conflict history in `0027`; the pilot performance advisor now reports no unindexed-foreign-key finding. The remaining unused-index notices are expected for a synthetic pilot with no representative workload.
- A synthetic transactional pilot confirmed exact policy-configuration replay remains available after finalization while a fresh configuration is rejected and immutably audited. Full repository checks passed (30 tests, lint, build, verification, private-handoff verification, and whitespace check). A focused Sol review found no P0/P1 issue after remediation.
- This remains a safe partial foundation, not finished `R-CORR-01`: approval-required corrections are pending/no-effect, but independent approval/rejection, a deferred lifecycle invariant, two-connection serialization proof, and clean-disposable-chain proof remain release gates.

## 2026-09-09 independent correction review foundation

- Added a protected independent review boundary for approval-required corrections. It requires a different eligible cross checker/director/co-director at decision time, stores a reviewer-role snapshot, rejects null/invalid decisions, locks the correction/game/tournament/publication guard, exact-replays only payload-identical retries, and preserves immutable receipts/audit/conflict history.
- Added a deferred immutable lifecycle invariant with explicit transition sequence: immediate corrections are `applied@1`; approval corrections are only `pending@1`, `pending@1 → rejected@2`, or `pending@1 → approved@2 → applied@3`. Pending and rejected paths do not update score projections; approval atomically changes both reciprocal scorelines and canonical result only after all authorization, policy-snapshot, stale-source, ruleset, and Draft publication guards pass.
- Added a private immutable per-event Draft publication guard, seeded/provisioned for every event. Both new proposals and approvals fail closed when the guard is missing or not Draft. This is deliberately a pre-result-versioning guard; it cannot publish or supersede results, which remains a required later capability.
- Pilot synthetic transactions verified pending no-effect, null-review no-side-effect, and eligible independent approval from A/+31 to B/+30 with the expected three-event transition history; all test records rolled back. The advisor is clear of unindexed foreign keys. Independent Sol review found and the implementation fixed a null-decision and missing-publication-guard P1 before pilot application; final review found no P0/P1.
- Git Preview deployment `dpl_CgJvC7mWpFd9twiCBf8jGXFi91CT` is Ready from commit `836d3c0`; its root route returned HTTP 200 with the expected score-entry shell and Vercel reported no runtime-error clusters over the one-hour scan. Production remains intentionally on `main` and is not a release candidate.
- The production release gate remains open: protected correction UI, real authenticated independent browser sessions, clean-chain disposable migration proof, two-connection concurrency/publish-race proof, and immutable result-version/supersession support are still required.

## 2026-09-08 correction-foundation pilot verification

- Applied `0011_correction_foundation` to the isolated synthetic-data pilot. It provides append-only correction/state/conflict records and an authenticated, cross-checker-only correction RPC. It preserves original verification evidence, denies self-corrections, applies the default immediate-authority/optional-reason policy atomically, and safely rejects non-identical reuse of an idempotency key.
- Applied `0012_correction_history_indexes` after the hosted advisor identified missing foreign-key covering indexes in the new history tables. The re-scan cleared those findings; unused-index notices are expected while the pilot contains only synthetic transactions.
- Forced-deferred pilot transactions passed for the positive correction, self-correction rejection, and idempotency-conflict paths. Each test was rolled back, leaving no test correction records in the pilot. A focused Sol review found no P0/P1 findings after remediation.
- This is a database foundation, not a finished correction feature: protected official UI, role management, independent browser sessions, published-result versioning, and broader release gates remain outstanding.

## 2026-09-08 public registration and manual-payment requirement

- Added the agreed public tournament registration boundary to the normative requirements: a non-guessable flyer QR code/link permits self-registration only while server-side registration is open; it never grants a role or private data access. Duplicate identity claims require director review.
- Recorded the first-release financial boundary: payment remains manual (cash/check or other director-recorded method), and only an authorized director/co-director can mark it received in a private audited ledger. Online payments remain a future separately reconciled integration.

## 2026-09-08 live score-entry pilot hardening

- Added the protected, server-backed Standard Singles score-entry route. It loads only a signed-in, checked-in assigned player's active game context through a narrow authenticated RPC; it uses the existing server-authoritative submission/confirmation routes and does not expose direct private-table access.
- Applied pilot migrations `assigned_game_context`, `assigned_game_context_hardening`, `confirmation_eligibility_hardening`, and `assigned_game_context_confirmation_recovery`. The corrections align the read model with canonical `pending`/`verified` state, make the saved score and confirmation state refresh-safe, remove unnecessary internal IDs from the client payload, preserve IDs across ambiguous network retries, and enforce event/ruleset eligibility at the confirmation data boundary.
- Added concise score-entry help for a paper-card/digital-card game and recorded `R-GUIDE-01`, including the fuller director guide requirement. The instruction does not weaken the two entries/two confirmations verification rule.
- Added a protected tournament-scoped `Start Here / How To` route for players and directors, linked from live score entry. It covers the paper/digital flow, check-in, seating publication, permanent verification IDs, and the requirement to leave exceptions pending for authorized cross-check/judge handling.
- Corrected the deferred game-state invariant to allow exactly one accepted entry in `submitted`, while retaining the two-submission requirement for mismatch, confirmation-pending, verified, and corrected states. Pilot transactions forced deferred constraints and confirmed both the one-entry state and the two-player/two-confirmation verified state with reciprocal +31/−31 scorelines.
- `pnpm lint`, `pnpm test` (26 tests), `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check` passed. Pilot SQL verified an assigned caller receives its constrained context, an unassigned caller receives none, and a verified game refreshes to its authoritative state. Preview deployment `dpl_DVrpjbWYsXYHuwNk1Uokdq3EpUi3` is Ready from commit `414ccd5` with no current runtime error clusters. Independent browser sessions, a seeded real role, and phone/desktop live-route verification remain required before this vertical slice can be called complete.

## 2026-09-08 correction foundation decision

- Recorded the server-side correction boundary before implementation: corrections are immutable separate history, require non-self cross-check authorization, preserve original verification history, default to immediate authority with optional reason, and atomically recompute only the effective canonical/scoreline projections. Pending approval must remain non-authoritative, and published-result corrections fail closed until result versioning exists.

## 2026-09-07 canonical setup and Events/Flyer foundation

- Confirmed **Events and Flyer** is an event-management/reference area with flyer creation inside it, not a flyer-only operation. It now lists Main Event, Consolation Event, and configured Satellite Events without incorrectly treating Topaz (a location) as an event.
- Made **Set Up Tournament** the prototype’s planned canonical data-entry source. It contains prototype options based on observed sanctioning-request tournament/director/venue fields, Main/Consolation/Satellite configuration menus, two co-director entries, and a disabled flyer-import format preview. Future production reuse is explicitly specified for flyer, seating, results, finance, and a director-assisted draft worksheet; no automatic portal submission is claimed without a documented ACC API/import contract.
- Refined the review surfaces: larger permanent scorecard ID, inline tournament context on seating print, searchable/cached/online Rulebook labels, and category-first results. Regenerated the synthetic qualifier PDF so the winners lead the qualifier order.
- `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, `pnpm verify`, and `pnpm verify:handoff` passed. Hosted desktop review deployment `dpl_68JMBS9YFzgGtP7aZmWyrx1USHUK` rendered the Score Entry panel without an error overlay. Phone and physical-print verification remain pending.

## 2026-09-07 score-entry and scorecard format review

- Updated the review shell to use the approved player-facing Score Entry/Game Result language and to preview both players’ game and reciprocal spread entries.
- Reworked the scorecard into the requested 12-game, paper-card-inspired grouped header format, with the player ACC number, Table/Seat, current game, opponent, Verification ID #, and Games Won. Removed prototype explanations, initials, loss count, and Checked by from the visible card.
- Recorded the future paper-player seating-list requirement and the consent/provider gate for optional SMS notifications. `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed. Hosted Preview deployment `dpl_8Res9v9BjVDAz9P5G4ksqSEs7C7m` rendered the revised desktop review shell; a real phone browser pass remains required.

## 2026-09-07 scorecard totals, seating print, and rulebook cache review

- Moved the pending-opponent notice into the unused right side of the fixed scorecard total row and changed it to `Updated Total Calculations Pending Opponent Entry`; enlarged the stacked Opponent/Verification headers and made the Plus/Minus header symbols match.
- Changed the top context badge to `GAME 3`; production must advance this only after the current game is server verified.
- Renamed seating columns to `Assigned Table - Seat`; both printed columns now repeat Player, Scorecard, and Assigned Table - Seat headers, use compact `A-5` values, preserve left-column-first pagination, and use one-half-inch print margins.
- The user recorded permission to cache the full ACC Rulebook. Verified and cached the dated official 64-page 2025 PDF from the ACC rules URL; the Rulebook tab now opens that local copy. This is a prototype asset integration, not an assertion that every rule implementation is complete or current.

## 2026-09-07 continued prototype-format review

- The review flow now shows the pending-opponent notices only after a submitted entry; the fixed total-row notice uses the same 16px red status treatment as the scorecard header and is announced accessibly.
- Reduced printable seating capacity to 28 entries per column (56 per Letter page) to fit 12-point print with half-inch margins. The prototype keeps the requested left-column-first order and repeats the three compact headers in both columns.
- Made configured events data-driven in the review layout, including Main, Consy, Canadian Doubles, and a custom satellite sample. Canadian Doubles is now represented as a future team-scorecard workflow, not a manual-only result; actual standings use remains gated on team verification and dated ACC fixtures.
- Check-in now explicitly holds Table/Seat and permanent ID generation until registration closes. Added a viewable flyer sample and an interactive two-format Rulebook view: Quick Reference, cached 2025 full PDF, and the external official ACC source.

## 2026-09-07 scorecard ID and Seating review

- Distinguished a permanent player `ID #` (used for scorecard verification throughout the tournament) from each game’s changing Table/Seat assignment. The Score Entry and Review Result screens now display both concepts separately.
- Tightened the Scorecard columns, made the header and two total/summary rows fixed outside the touch-scrolling game rows, retained the requested grouped Game/Spread divider lines only, added signed spread totals, and surfaced red `Verification Pending Entry` beside the card heading.
- Renamed the Operations option to Seating and added prototype controls for table/seats-per-table capacity, name search, sorting by first/last/card type/current table-seat, and printing the seating list. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed. Hosted preview `dpl_57LReyrNzTQS13uEWPx5ijZ7Jx75` rendered the revised Score Entry screen without an error overlay; local browser remains intentionally blocked without public Supabase variables.

## 2026-09-07 score-entry keypad refinement

- Reordered the keypad status band to put the entered number on the left, `Spread Points` centered over the keypad, and any Skunk aid on the right. The keypad now ignores a fourth digit while existing 1–121 validation still rejects impossible three-digit entries. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed.

## 2026-09-07 operations and results layout review

- Restored left-aligned `Spread Points:` to match `Game Winner:`, centered only the entered value above the keypad, and updated Review Result seating punctuation.
- Expanded the review prototype with Tournament Setup, Players & Check-In, Table Plan, Judge Desk, Flyer Editor, a print-specific two-column Seating Assignments layout, and a clickable Qualification Preview. The Table Plan visibly identifies an under-filled final table for director review; authoritative rotation/play-through instructions remain gated on an approved ACC fixture.
- Flyer & Events now presents event editing and flyer generation rather than treating `ACC Sanctioning Fee` or `Ready to Publish` as event states. The qualification preview presents configuration, qualifying-place, MRP, and Q Pool areas before results are final. `pnpm lint`, `pnpm test` (25 tests), `pnpm build`, and `pnpm verify` passed; hosted preview `dpl_2c7f3rE7zRtVzZkGh4ubkzrE1rLz` rendered the revised Score Entry without an error overlay.

## 2026-09-07 navigable format-review prototype

- Replaced the static anchor review shell with a navigable local review flow: Score Entry, Review Current Game Result, Scorecard, Operations, Seating & Paper Cards, Cross Check, Flyer & Events, Financials, and Results.
- Updated Current Game Results language, the invalid spread-point message, event game-count context, paper-card headers, vertically stacked Net Points/Games Won values, and touch-scrolling scorecard container. The Review Result step is visual/prototype state only and does not bypass server-side independent verification.
- `pnpm test` (25 tests), `pnpm lint`, and `pnpm build` passed. Hosted Preview deployment `dpl_6pYkkG1QrRAjcTH2AMSFWJCzsBR3` rendered the Current Game Results screen and top-level navigation without a development error; a real phone browser pass remains required.

## 2026-09-07 release-readiness audit

- Recorded a current-state, evidence-based release audit in `docs/quality/2026-09-07-release-readiness-audit.md`. The Preview and bounded pilot score API have evidence, but production deployment, real score-entry integration, role views, corrections/disputes, offline/hybrid operation, event/finance/results/export, rule fixtures, and operational exercises remain critical release blockers.

## 2026-09-07 skunk-language requirements reconciliation

- Reconciled the normative requirements with the approved prototype review: player-facing Skunk/Double Skunk/Triple Skunk labels and icons require no disclaimer, while remaining presentation-only and excluded from official calculations, standings, and exports.

## 2026-09-07 spread-points score-entry label

- Renamed the player-facing `Winning margin` field to `Spread Points`, removed the visible `1–121` range cue, and retained the existing internal 1–121 score validation. The keypad and invalid-entry feedback use the same plain-language wording.

## 2026-09-07 score-entry language cleanup

- Removed prototype workflow jargon from the score-entry panel: `FAST ENTRY`, `1 of 3`, and `Derived result`. The panel is now headed simply `Record game result`; after a valid entry it states the plain-language win result with the existing game-points, Plus/Minus, and skunk aid.
- Added a regression test that rejects those labels and requires the player-facing result wording. `pnpm verify:local` passed (23 application/security tests plus build and local handoff checks), and a signed-in hosted browser rendered the updated score-entry panel from preview deployment `dpl_HYexTAhfWuGrjGtAurEZkutRgJAP`.

## 2026-09-07 Vercel framework configuration fallback

- Added a repository-owned `vercel.json` declaring the `nextjs` framework. This is the durable equivalent of selecting the Next.js framework preset in the Vercel dashboard and will accompany every Git deployment.
- `pnpm verify:local` passed: lint, 22 application/security tests, production build, workspace verification, and 6/6 private-handoff checks.
- Vercel deployed commit `f1c57c1` as `dpl_GHHrC2nF2zMuwiKLsDewQhoETKLg` and now routes requests to the app instead of returning its edge-level 404. Preview environment values were then configured and commit `dedcc78` deployed as `dpl_E8EYFwyjaSBrujHKQfFznA3R7TFq`; a signed-in browser independently rendered the full ACC Tournament Desk prototype from that URL. Production remains intentionally separate: it still points at `main`, has no production environment values, and must not be promoted until release gates are complete.

## 2026-09-06 preview deployment diagnosis

- Pushed commit `9978f67` to `codex/production-readiness-baseline`. Vercel cloned it, installed the locked dependencies, ran `next build`, and marked preview deployment `dpl_mwbNt8UbRcQF7x6RLZUwadpiNjue` Ready.
- The generated preview URL and its branch alias both return Vercel `404 NOT_FOUND` before any application runtime logs are created, including with a temporary protected-deployment share URL. This is a hosted Vercel routing/deployment configuration issue, not a failed application build; it remains a release blocker.
- Pilot advisors now report only expected unused-index information plus intentional private-schema/RPC warnings, and one unresolved Supabase Auth warning: leaked-password protection is disabled. The UI is OTP-only, but service-side password behavior has not been verified; production must enable leaked-password protection or enforce passwordless Auth.

## 2026-09-06 pilot advisor remediation

- Applied `0005_pilot_index_and_advisor_baseline` to the isolated synthetic-data pilot only after focused review. It adds non-unique covering indexes for the advisory foreign keys and does not broaden table, policy, or RPC privileges.
- Corrected the fresh-schema index names in `0001` to match `0005`, preventing duplicate equivalent indexes on a clean migration replay.
- The Supabase password-protection advisory remains a release blocker: the current UI is magic-link only, but the hosted Auth password setting has not been independently verified or configured. Production must enforce passwordless Auth or enable leaked-password protection before launch.

## 2026-09-06 Supabase auth scaffolding

- Added pinned `@supabase/supabase-js@2.115.0` and `@supabase/ssr@0.12.6`, fail-closed public environment validation, browser/server cookie-aware client utilities, a minimal email-link sign-in page, and a same-origin-safe `/auth/callback` route.
- Added `.env.example` with blank public variables only. No secrets, service keys, policies, RPCs, direct public database access, or environment values were added. The existing prototype dashboard route remains available.

## 2026-09-06 Supabase auth review hardening

- Browser/server utilities now pass direct `process.env.NEXT_PUBLIC_*` references for Next bundling while retaining the testable validator. Added Next 16 `src/proxy.ts` claim refresh with cookie propagation and no swallowed errors.
- Sign-in is invite-only (`shouldCreateUser: false`). Added a server-side tournament DAL membership/role gate and protected dynamic tournament route; unknown or unassigned users receive no tournament data. `.env.example` is explicitly unignored and contains only blank public variables.

## 2026-09-06 Supabase auth blocker remediation

- Added response-aware route-handler cookie propagation for the callback and retained claim-refresh cookie propagation in the Next 16 proxy. Protected membership now uses a narrowly scoped, unapplied `app.get_tournament_role` security-definer function with empty search path, `auth.uid()` membership check, revoked defaults, and an explicit authenticated execute grant only.
- Safe `next` paths are preserved through sign-in and callback. `.env.example` remains tracked, blank, and credential-free (`a35a1da` latest template correction).

## 2026-09-06 final auth boundary correction

- SSR proxy and callback now preserve refreshed request headers and response cookies. The unapplied membership migration exposes only a public `get_tournament_role` security-definer wrapper with empty search path, fully qualified private-table access, revoked public/anonymous execution, and authenticated execute only; the DAL uses that RPC and never reads `app` tables directly.

## 2026-09-06 Standard Singles game API vertical slice

- Added an unapplied `0003` migration with authenticated SECURITY DEFINER `submit_game_score` and `confirm_game_score` RPCs. They enforce actor assignment/role scope, idempotency replay/conflict detection, matching submissions, two confirmations, and atomic canonical scoreline/game-point derivation without client table grants.
- Added validated POST handlers at `/api/v1/games/[id]/submissions` and `/api/v1/games/[id]/confirmations`, using `getClaims` and RPCs only. No environment, Supabase project, migration, or deployment was changed.

## 2026-09-06 game API review remediation

- Restricted confirmations to the assigned player confirming their own submission; staff confirmation is not enabled. The second submission now atomically persists `confirmation_pending` for an exact pair or `mismatch` otherwise, with digital/approved/open/checked-in gates.
- RPCs compute request digests internally, lock the game before idempotency lookup, record accepted receipts and linked audit events, and return structured rejection responses. Routes no longer accept caller-supplied hashes or source methods.

## 2026-09-06 final game API review correction

- Both RPCs now require an open tournament; submission requires an approved digital Standard Singles event and checked-in assigned player, while confirmation rechecks current checked-in assignment and own-submission ownership.
- Rejection logging is now internal to the authoritative RPC subtransaction: partial mutations roll back, then controlled rejected receipts/audit events are appended without any client-callable logging RPC or false acceptance. `pgcrypto` qualification is recorded from the pilot read-only verification below.
- Pilot read-only verification confirmed the extension schema is `extensions`; 0001 defaults and 0003 digest/generator calls now use `extensions.gen_random_uuid()` and `extensions.digest()`.

## 2026-09-06 rejection-integrity hardening

- Added an immutable, private `app.operation_conflicts` record for same- or cross-tournament idempotency conflicts and unscoped/unknown-game rejection attempts. It retains the attempted key/hash and any prior receipt ID without an invalid composite reference.
- Domain validation is now ordered after game lookup where possible; expected domain rejects return stable codes, while unexpected database/audit failures rethrow and are surfaced by routes as generic 503 responses without raw database messages.
- Added static coverage for conflict retention, immutable audit behavior, structured non-2xx route mapping, and the audit-write failure boundary. Migration 0003 remains unapplied.

## 2026-09-06 idempotency/null-boundary hardening

- Both RPCs now reject required null arguments explicitly, serialize the actor/idempotency-key pair with a transaction advisory lock, and resolve exact replays before mutable tournament/event/assignment eligibility checks after safe game lookup.
- Stable idempotency conflicts remain separate immutable conflict records; accepted replay responses never receive rejection audit events or mutate state.

## 2026-09-06 PL/pgSQL exception-structure correction

- Corrected the unapplied 0003 RPC draft after the pilot rejected it atomically on PostgreSQL syntax near `exception`: each function now uses one valid `EXCEPTION` clause with `P0001` and `OTHERS` branches. No pilot mutation occurred.
- Static tests now assert two exception blocks total and both fallback rethrows. No local `psql` parser/client is available, so database parse/apply validation remains pending a controlled integration environment.

## 2026-09-06 pilot trigger security correction

- The pilot's first real 0003 mutation test exposed authenticated execution failure in the deferred submission revalidation trigger (`permission denied for schema app`). Updated the 0001 base trigger/revalidation functions to use `SECURITY DEFINER`, empty `search_path`, fully qualified private-table references, and revoked client execution.
- Added unapplied `database/migrations/0004_trigger_security_hardening.sql` to correct the already-created pilot schema. No pilot changes were made during this pass.

## 2026-09-06 pilot advisor index baseline

- Added unapplied `database/migrations/0005_pilot_index_and_advisor_baseline.sql` with covering indexes for the advisor-listed private-schema foreign keys, including audit scope, participant/event scope, conflict receipt, confirmation actor, submission ownership, and tournament director references.
- Mirrored the index coverage in 0001 for fresh database creation. The pilot remains intentionally policy-free/private with revoked direct table DML; only authenticated, auth-checked security-definer RPCs are intended to execute. Authentication is magic-link/OTP only, so leaked-password lint is not applicable.

## 2026-09-06 local schema contract scaffolding

- Added an unapplied local first-draft migration for private Standard Singles core tables, UUID/FK/scope checks, 1–121 margins, 0/2/3 game points, normalized two-side game pairs, forced RLS, and revoked direct `anon`/`authenticated` DML.
- Added static schema rejection-boundary tests and wired them into `pnpm test`. No Supabase service, auth, routes, policies, RPCs, or production database was changed. Applying the migration remains gated on server authorization policies, integration fixtures, and recovery review.

## 2026-09-06 local schema security redesign

- Reworked the unapplied migration into private `app` schema with `profiles.id` linked to `auth.users`, restrictive non-cascading history/core FKs, composite tournament/event/ruleset/round/game scope, assigned two-sided games, exact two submission slots, immutable winner/margin submissions, submission-bound distinct confirmations, pending-state score guards, game versioning, and actor/operation/target/request-hash idempotency.
- Updated static schema tests to cover these security and rejection invariants. No Supabase migration, policies, RPCs, auth routes, or services were touched.

## 2026-09-06 second schema review correction

- Expanded the local state model to pending/submitted/mismatch/confirmation_pending/verified/corrected; confirmations now support exactly two distinct actors and allow a player to confirm their own submission. Verified/corrected games require two matching submissions, exactly two reciprocal scorelines, one winner, and two confirmations.
- Added immutable confirmation/audit protection, audit foreign-key linkage, assigned-side submission linkage, game/scoreline Table/Seat snapshots, approved matching ruleset enforcement for digital events, and corrected idempotency semantics so request-hash comparison remains future RPC logic.

## 2026-09-06 third schema remediation

- Added deferred revalidation after scoreline, submission, and confirmation mutations. Verified/corrected games now require matching submissions, exactly two reciprocal side-mapped scorelines with matching seats/margins and reciprocal Plus/Minus/game points, exactly two distinct submission-bound confirmations, and valid assigned slot/player linkage.
- Added immutable receipt/ruleset protections, stored replay response payloads, tournament-scoped audit receipt linkage, and retained the migration as local-only/static-test scaffolding.

## 2026-09-06 final score-entry readiness pass

- Added and tested `isScoreEntryReady`: no winner or invalid margin cannot start entry; a valid margin plus selected winner can. Dashboard initial controls remain unpressed and review-disabled.
- Improved decorative VS contrast/accessibility and corrected direct handoff evidence to 6/6 (outer workspace verification remains 6/6).

## 2026-09-06 final prototype accessibility/CI correction

- Added defensive runtime winner validation; the dashboard starts with no winner selected, keeps both controls unpressed, and disables score review until a winner and valid margin are entered.
- CI now uses `pnpm verify` only for clean-clone checks; `verify:handoff` remains a mandatory local-only command via `verify:local`. `verify:all` uses pnpm and excludes private handoff verification.
- Raised essential UI information to 16px minimum, retained 56px keypad targets, strengthened muted/status colors for normal-text contrast, and recorded browser checks at 320/375/1280px plus the unrun 200% zoom limitation.

## 2026-09-06 prototype accessibility and source-boundary pass

- Corrected the demo scorecard so live entry remains visibly `Pending preview · not certified` and is excluded from settled rows, totals, and net calculations. Removed static “saved” behavior.
- Added signed-net formatting tests, 16px essential labels/table/status targets, 56px keypad targets, `aria-pressed` winner controls, offline-safe system font stack, and the user-authorized `public/branding/acc-logo.jpg` via `next/image`.
- Added ESLint flat config and lint CI gate. Existing CI score/build/recovery gates remain intact; this pass added lint and did not replace them.

## 2026-09-06 prototype corrective pass

- Corrected score derivation so either selected winner receives 2 game points for a normal win or 3 for an informal skunk-band win; reciprocal Plus/Minus fields remain correct.
- Added opponent-winner normal/skunk regression coverage, pinned `pnpm@11.19.0`, meaningful `test`/`verify:all` scripts, and CI installation/build/score/recovery gates on Node 24.
- Recorded dependency/lockfile validation: the lead-added dependency set and `pnpm-lock.yaml` pass frozen install; initial ignored `unrs-resolver` build was narrowly approved via `pnpm-workspace.yaml`; `pnpm audit --audit-level=high` reports no known vulnerabilities.

## 2026-09-07 prototype operations and results review

- Refined the review prototype with a prominent `Verification Pending Opponent Entry` state and a matching total-row notice that verified totals exclude the pending game.
- Corrected seating print pagination to fill the left column before beginning the right column; the synthetic roster has four entries and is not an actual tournament count.
- Added a public Rulebook tab with an app-owned quick-reference placeholder and an official dated-link placeholder; it intentionally does not reproduce or cache the ACC rulebook without permission.
- Added event and repeatable co-director setup cues, a Table C exception-review screen, more precise cross-check language, event-selectable tournament results, and an explicitly synthetic, non-official Main qualifier-report PDF sample.
- A focused Sol review confirmed that rotation/play-through instructions, MRP/payout calculations, and portal-role parity remain production gates pending dated ACC fixtures and verified portal requirements.

## 2026-09-06 fresh prototype shell

- Added a bounded Next.js App Router TypeScript prototype under `src/app`: ACC-branded responsive tournament dashboard, large 1–121 score keypad, derived scoring/skunk aid, paper-style scorecard, and static operations/verification/correction/results cards.
- Added pure score derivation utility and rejection/boundary tests. This shell uses synthetic data only and intentionally has no Supabase, auth, persistence, or production claims.
- Verified production build, score tests, workspace/handoff checks, and browser behavior at desktop plus a 375px phone viewport. Fixed the phone page-level horizontal overflow found during browser review.

## 2026-09-06 final source-accuracy corrections

- Corrected cross-check staffing to apply per individual table, including the ACC related-couple/significant-other/relative third-checker safeguard only where a qualifying table is affected.
- Expanded `TR-06` with ACC 2025 Judge Protocols, Rule 10.1(b), Appendix A items 1–3, and existing rules 12.1–12.2, 13.2, and Cross-Checking Guidelines item 20.
- Removed Muggins disclosure from unresolved gates; retained only event configuration as data to record. Architecture now requires all affected scorelines to update atomically and defines normalized side-pair uniqueness plus explicit rematch/version and replay handling.

## 2026-09-06 second normative requirements hardening

- Tightened hybrid/paper verification to require each assigned player to independently enter and confirm their own paper result using context-only PIN; unavailable players leave the card `PendingCrossCheck`, with no staff substitution absent a future approved exception.
- Encoded the cited ACC 2025 judge/cross-check baseline, immediate correction semantics, paid-placement amounts, Muggins disclosure, high-non-qualifier fixture, finance gates, non-singles manual/imported boundary, and event-finalization gates.
- Replaced the architecture summary with a canonical `tournament → event → round → canonical_game → card_scoreline → ...` model, explicit offline security boundary, result versions, finance/attachments, and internal export artifact.
- Added direct requirement mappings for roles, offline queue security, finalization, flyers, attachments, and financial classification. No production code, imports, credentials, or external services were changed.

## 2026-09-06 normative requirements hardening

- Hardened `docs/product/production-requirements.md` after independent review: added stable requirement IDs and positive/rejection traceability, self-contained registration/check-in/shared-device/seating/dispute/Consolation/template/attachment workflows, exact digital and hybrid actor rules, canonical per-card/match linkage and Rule 12.2 fixture coverage, explicit Pending/Applied correction semantics, judge capacity/self-dispute safeguards, Standard Singles boundary, restricted-hold retention, deletion/backup/restore controls, internal director-assisted export wording, finance/reporting gates, signed-in results default, informal skunk bands, measurable accessibility targets, and rulebook-cache permission gate.
- Updated `docs/product/requirements.md` so the summary IDs, audience, correction state, canonical score linkage, and export boundary agree with the normative baseline.
- No production code, imports, credentials, or external services were changed. Remaining requirements are intentionally implementation gates where ACC policy, payout fixtures, retention, copyright, or export schema approval is still absent.

## 2026-09-06 normative production requirements baseline

- Added `docs/product/production-requirements.md` as the self-contained normative baseline for scoring, digital/digital and hybrid/paper state machines, post-verification corrections, authentication, staged full-product delivery, public results, private finance, ACC-ready export, retention uncertainty, and traceability/acceptance gates.
- Updated `docs/product/requirements.md` to point to the normative baseline while retaining the recovered summary and source map.
- No production code, imports, credentials, or external services were changed.

## 2026-09-06 requirements reconciliation and production-readiness audit

- Reconciled user-approved scorecard, correction, flyer, results, Q-pool, branding, and ACC-export decisions into `docs/product/requirements.md`; recorded current ACC 2025 scoring, tie-break, and qualification sources.
- Updated launch planning to reflect the connected GitHub/Vercel project and healthy Supabase project. The only Vercel deployment is a placeholder that returns 404; Supabase has no migrations or public tables.
- Production implementation has not begun. The next milestone is a fresh accessible branded prototype, followed by an authenticated two-player, dual-confirmed, server-audited vertical slice.

## 2026-09-06 handoff restoration

- Restored the 33-entry ACC handoff ZIP into `imports/acc-handoff-2026-09-05` without overwriting any source material.
- Ran `scripts/organize-handoff.ps1`; all 32 manifest artifacts and their organized copies match size and SHA-256, with three exact duplicate pairs mapped to shared copies.
- Verified with the bundled Node 24.19.0 runtime: `tests/workspace.test.mjs` (6/6 passing) and `tests/handoff.test.mjs` (3/3 passing).

## 2026-09-05 model routing

- Added project-specific builder/reviewer routing in `docs/operations/MODEL_ROUTING.md`; Astra is explicitly prohibited.
- Terra is the default lead, Sol performs focused plan/high-risk review, and bounded mechanical and routine work may use Luna or Mini.
- Routing never replaces the mandatory verification gates.

## Recovery update: 2026-09-05

ACC_Digital_Tournament_System_CODEX_MAXIMAL_HANDOFF_2026-09-05.zip found in C:/Users/choco/New folder/. All 32 listed artifacts match SHA-256 and size. There are 33 archive entries including the manifest and 29 unique listed artifact contents. Original files are preserved; inventory.json maps organized copies.

Specification v1.1 is the baseline; v1.3 is the latest review prototype. No production backend, database or multi-user engine was recovered. The missing original August transcript is helpful but no longer blocks implementation planning.

Read docs/recovery/REVIEW.md, docs/quality/VERIFICATION.md and docs/operations/LAUNCH_PLAN.md. Next milestone: validate rules and build one tested, authenticated two-player game with atomic verification and audit.

The earlier scaffold notes below are historical and superseded by this recovery update.

## Current state

- Repository scaffold created.
- GitHub CLI connected.
- Previous ChatGPT system conversation still needs to be recovered.
- No earlier application source code has been found locally.

## Next task

Recover and import the ChatGPT conversation export, then reconstruct the product requirements and identify any embedded code or downloadable artifacts.

## Open questions

- Which ChatGPT account or workspace contains the original system conversation?
- Did the original conversation generate downloadable ZIP, HTML, JavaScript, or repository files?
