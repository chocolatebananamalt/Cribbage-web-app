# Local payback and qualifier-award repair — verified, unpublished

Owner approved local implementation/testing on 2026-10-27. Branch codex/director-setup-journey remains at c3eeec1ab777a6ff6411d2ec240b227c13a98824; PR 122 remains draft. No hosted business write, publication, shared migration application, new access or real transaction occurred.

## Authoritative source and coverage

Current linked [ACC Policy Manual](https://www.cribbage.org/NewSite/about/Policy%20Manual.pdf), revision list through February 2025: chapter 6 I.B/C, printed 6-1, specifies the top 25% rounded upward. I.H, printed 6-3, covers bracket-filling byes. The [2019 Director Manual](https://www.cribbage.org/NewSite/sched/Directors%20Manual%20-%202019.pdf), section 7A printed 11, states the one-in-four award ratio but does not mandate one distribution. No fixed percentages or universal doubling are introduced. The owner's requirement is one positive TOTAL award for every ordinary full-entry cash-eligible qualifier, with equal awards in equal elimination cohorts. No additional round payments, invented third/fourth ordering or MRP change.

Exception: current Policy Manual chapter 6 **I.G, printed 6-3, PDF page 35**, permits a player subject to age-related prize restrictions to pay sanctioning only and receive points without cash, with a parent-receipt provision where allowed. Every qualifier needs explicit eligibility evidence; exceptions/unknowns block this slice. No age is inferred from accounts. I.A.3 printed 6-1 requires 17 Main players: the 16-player synthetic foundation is software proof, not sanction eligibility.

Chapter 6 III printed 6-3/6-4 requires 85% cash/player-benefit return and no director monetary profit. Categories follow its list: sanctioning, meals, coffee, donuts, pastries, snacks, charity and trophies are benefits; cards, printing, advertising, postage, telephone, supplies and hall rental are operating costs. Unknown classifications block review. Q Pools remain separate.

## Implemented local contract

- Pure validator src/lib/results/acc-payback.ts: trusted canonical rows, exact per-qualifier eligibility, positive total awards, equal cohorts, sourced costs, independent cash conservation and BigInt 85%-of-gross arithmetic. No arbitrary formula. Pure tests cover complete no-bye cohorts 4–256, not end-to-end format support.
- Local 0241: append-only requirement/review/conflict tables; three service-only public RPCs, private revoked helpers, forced RLS/direct-DML restrictions, receipts/audit, safe replay and scope-bound final review ID.
- Gross is derived from an exact event-participant/active-roster bijection with obligations and current receipts equal to the configured fee, not net income or payment-allocation guesses. Exact financial/source IDs and versions are snapshotted. Every current expense is classified once; sanctioning evidence uniquely matches the assessment.
- Positive-fee 12-game Standard Main activations and new V5 drafts automatically require review. Pre-migration records remain historical until a new draft or accepted review adopts their event. Required events reject new legacy inserts; historical receipt replay remains before validation. No global legacy revocations.
- V5 finalization preflight returns structured missing/stale-review rejection. Defense triggers independently reject legacy inserts and pin/recheck the exact current review on a final. Existing immutable history is not rewritten.
- Strict API DTO records director_selected schedule and total_award basis, explicit source/evidence, verified actor, same-origin, header-only operation ID, safe integers, response bindings and request-byte bound.
- UI uses blank evidence controls and server facts, shows distinct benefit/operating/required-return totals and currentness, gates new finalization, preserves locked exact retries/null receipts, protects newer/malformed storage and shared-device retry queues. Historical states remain explicitly uncertified.

First integrated slice: one fully paid Standard Singles Main, no other event, Q/Side pools, independent income, refunds/voids, exemptions, partial/overpayment or byes. Positive retained funds and alternate cohort awards block it. Any historical Q/Side setup version conservatively blocks scope even if later removed. Larger playoff-win-depth API limits remain; no new general format or allocation ledger is claimed.

## Actual verification

| Check | Result |
| --- | --- |
| pnpm verify | Exit 0; **874/874 application tests**, 0 failed/skipped |
| Production dependency audit | No known vulnerabilities; no dependency changes; not a fresh development-advisory clearance |
| ESLint | 0 errors; two existing warnings: event-control-client unused useEffect and shared-device-sign-out dependency |
| Providers/build/typecheck | Passed; external providers disabled/manual fallbacks declared |
| Workspace | 7 passed / 1 private-handoff skip |
| Focused final contracts/review | 26/26; independent review no P1/P2 |
| Local rollback SQL | Exit 0; PAYBACK_REVIEW_V1_SUPPORTED_FINAL_REPLAY_AND_REJECTIONS_PASSED; constraints immediate; rollback 0 users/0 tournaments |
| Real SQL races | Exit 0; two independent waiting requests observed in each race; same key gives one review/receipt replay, competing version gives one accept/one stale; 2 reviews/3 receipts/3 audits/0 finals |
| Mocked browser | Exit 0 at 390 and 1440 px, no overflow; three intercepted POSTs, zero backend writes |

SQL command: node tests/run-payback-review-isolated.mjs --isolated-container. It proves supported financial/review/V5 calls, replay/conflict, pre-review final rejection, exact review linkage, stale obligation/expense/new-draft rejection and exact 101/20/1/max-safe ceiling cases. Direct legacy probes test trigger behavior, not every public legacy RPC mapping. Qualification/scoring/start/assessment foundation is seeded; financial calls use synthetic authenticated identity, V3/V5/payback calls privileged postgres with actor checks, not actual PostgREST/service-key transport.

Concurrency command: node tests/payback-review-concurrency.mjs --isolated-container. This is actual overlapping review requests observed via waiting sessions, not finalization racing ledger/source mutation or forced response-loss proof. Separate race database is removed and original fixture rechecked empty.

Browser command: node tests/payback-review-browser.mjs. Real headless Chrome/localhost with all API writes mocked: missing evidence produces no writes; explicit fields, double-click single flight, aborted request/reload/null receipt, locked values, exact retry key/body, rejection cleanup, newer/malformed storage protection and historical read-only behavior pass. Screenshots test-results/payback-review-390.png and payback-review-1440.png. No physical device, card scan/OCR, email or real payment proof.

## Corrections, registration and cleanup

Review corrected aggregate eligibility, unsupported-bye handling, stale-review readiness, total-award basis and fractional-cent ceiling. First SQL test safely rejected a published-participant mutation in the fixture; negatives now append lifecycle/payment changes in rollback subtransactions without weakening guards. First race failed a test audit-action-name filter; corrected it, preserving expected counts, then real races passed.

First aggregate: 872 passed/1 failed solely because three RPCs were not locally registered. Checks were not weakened. Pinned official Supabase CLI 2.121.0 generated an unlinked migration stub under ignored test-results; reviewed SQL became canonical database/migrations/0241_payback_review_v1.sql, byte-identical to its proposal. Only the header changed to accurately say local reviewed/not hosted; SQL and race tests were rerun against the final bytes. Canonical/proposal SHA256 **46C14BB2B7AD9E2F5BA27E78997043F6B9503801EB3503234DB24017D41ABCA9**; fixture **E93A1A353F930010523C5248748ADF83458B6B02B040D2685C710BCDC1A5FEF9**. Existing 0240 is unchanged.

Cached official image public.ecr.aws/supabase/postgres:17.11.0.004, ID b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706. Owned container d8aec162f82b971c7f6153e5371c0089736ff15e11ff596d2314c843fd37a85f had network none, no ports/mounts and no privilege. Baseline hash e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc. Verified empty original DB/absent race DB, removed only that container/storage. No restart or user cleanup. Initial sandbox localhost failure was resolved by scoped authorized execution, not security changes.

Fresh read-only staging check: ab275686-6349-40e3-8771-bdfb1fe18f65 remains setup v2 with 0 activations/events/roster/payment/expense/nomination records; **0241 not applied**. Director session and prior fixtures preserved. Production untouched.

## Next separately approvable step

Sanitize/review accumulated local diff, publish approved repair files through normal branch Git Preview integration, verify exact-commit CI/Preview and fresh staging isolation, then apply only hash-verified 0241 to staging with no active writers and read-only ACL/history/smoke checks. Stop on drift; do not drop immutable history as an automatic rollback. No production/merge/promotion is implied.

The actual fictional prize split is still unapproved. B still needs this new tournament's nomination, personal invitation acceptance and audited nonparticipant attestation before hosted closure. Q Pool membership/policy, byes, OCR/scan, physical multi-device/offline, SMTP, development/security/index/load gates and staging-password remediation remain separate. No code/data release readiness is inferred from one accounting fixture.


## Changed files in this local repair

Application/schema:
- database/migrations/0241_payback_review_v1.sql
- src/lib/results/acc-payback.ts
- src/lib/results/payback-finalization-gate.ts
- src/lib/api/payback-review.ts
- src/lib/api/settlement-v5.ts
- src/lib/client-session-storage.ts
- src/app/api/v1/tournaments/[id]/events/[eventId]/payback-review/route.ts
- src/app/api/v1/tournaments/[id]/events/[eventId]/payback-review/reconciliation/route.ts
- src/app/tournament/[tournamentId]/events/[eventId]/payback-review/payback-review-client.tsx
- src/app/tournament/[tournamentId]/events/[eventId]/settlement-v5/page.tsx
- src/app/tournament/[tournamentId]/events/[eventId]/settlement-v5/settlement-v5-client.tsx

Tests:
- tests/acc-payback.test.mjs
- tests/payback-finalization-gate.test.mjs
- tests/payback-review.test.mjs
- tests/payback-review-v1-source-contract.test.mjs
- tests/payback-review-v1.sql
- tests/run-payback-review-isolated.mjs
- tests/payback-review-concurrency.mjs
- tests/payback-review-browser.mjs

Documentation: this report, payback-review-design and the frozen proposed SQL under docs/quality; PROJECT_STATUS.md; docs/product/requirements.md and production-requirements.md; historical annotations in the entry-fee and local-funded reports. Other previously accumulated uncommitted evidence/fixtures remain separate and require publication-scope review. No memory, credential, dependency or production configuration file was changed.
