# Entry fee and sanctioning money-flow rehearsal

Later checkpoint: payback classification and qualifier coverage are now implemented/tested locally; see 2026-10-27-payback-review-local-validation.md. The historical staging draft and unapproved prize split below remain unchanged.

The owner corrected the proposed $3 entry-only fixture and approved a new 16-player synthetic staging rehearsal of $30 entry receipts, $48 sanctioning expense and $432 available for prizes. No prize split, new B role or final settlement is approved yet. Prior fixtures remain unchanged.

## Official evidence and classification

Read 2026-10-27: [ACC Director Manual, February 2019](https://www.cribbage.org/NewSite/sched/Directors%20Manual%20-%202019.pdf), printed pp. 11–12, section 7. Entry fees are gross player charges. Minimum payback is 85%; sanctioning fees are eligible noncash player returns, while cards, printing, advertising and hall rental are ordinary tournament expenses. Prize distribution is not mandated; recommended guidance is not an automatic policy. Prizes should be posted before the end of qualifying.

The currently hosted [Western sanctioning form](https://www.cribbage.org/NewSite/sched/SanctioningRequestWestern.pdf), revision 12.20.21, lists $3/Main and $1/Consolation per entrant, describes entry fees as including those charges, and separates Q Pool entry. These are currently posted dated sources, not proof of a newly issued 2026 schedule or universal regional terms.

Cash conservation: $480 gross entry income = $48 expense + $432 prize claims + $0 retained. Sanctioning is deducted once from cash; it may also count toward the return percentage without becoming another cash expense. With only these costs, $432 cash prizes plus $48 eligible noncash return is $480/100%, not $432 less a second $48. Q Pools remain separate and disabled here.

Format caveat: the manual printed p. 8 section 6 requires 17 players for a sanctioned Main. Its p. 9 one-day minimum is 12 games; the posted Western form says 11. Twelve meets both, but 16 players does not establish sanctioned eligibility. This is a software fixture, with no actual ACC submission, sanction, membership validation or money movement.

## Executed local proof

New tests/prize-pool-settlement-v5.sql preserves the prior $3 positive-final fixture. Supported financial writers record 16 x 3000 cents and one 4800-cent expense in a rollback-only database. Supported V3/V5 logic verifies missing allocation and double-deducted expense reject as non_conserving_ledger, with replay/key-conflict checks. A final local draft has income 48000, expense 4800, empty claims and retained-field 43200 only as a technical algebra placeholder. V5 does NOT support a policy-neutral unallocated pool. No hosted retained claim is authorized, and no successful finalization or prize claim occurs. Rejected final attempts use synthetic attestations. Qualification/start/assessment foundation is seeded; V3/V5 direct calls use privileged postgres, not API/PostgREST transport.

Command: `node tests/run-funded-settlement-v5-isolated.mjs --isolated-container --prize-pool` exited 0 with PRIZE_POOL_SETTLEMENT_V5_CONSERVATION_NEGATIVES_AND_PENDING_POLICY_PASSED. Constraints forced immediate; rollback left 0 users/0 tournaments. Cached official image public.ecr.aws/supabase/postgres:17.11.0.004, image ID b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706, network none, no ports, mounts or privileges. Initial overridden PGDATA startup failed before SQL; corrected to the image default. Exact successful disposable container 718bfb31753db73dbb74a99f4695e93e9c197586fd76807344af9c946e65b9f6 was removed after empty-state verification. No cleanup remains.

Full pnpm verify exited 0: 848/848 application tests, production audit no known vulnerabilities, lint 0 errors/2 existing warnings, provider readiness and production build/typecheck pass; workspace 7 passed/1 private-handoff skip. Five new source checks and runner syntax pass. Independent review: no remaining P1/P2. No application/migration changes or publication. No funded browser finalization, prize payout, Q Pool, legacy-source, multi-event, actual concurrency or load proof from this local run.

## Actual hosted checkpoint

Verified existing director session and server-backed staging chooser on Preview gd2rl760r at published c3eeec1. New tournament **ab275686-6349-40e3-8771-bdfb1fe18f65**, TEST ONLY — PR122 Entry Fee Funded Rehearsal 2026-10-27, planned 2026-12-20. Exact director de0f27a1-60d0-4449-af83-fdf360a9bc08. Setup revision 1 details and revision 2 event saved. Revision 2 **d03459c5-7621-47d3-bd8c-d5802f6a3ef4**, client event row **fb2b9085-bcc2-43ce-8168-a014a2ca2e74**: Standard Main, 12 games, entry 3000 cents; unchanged sanctioning rates Main 300/Consolation 100. No actual event materialized yet.

The finalization confirmation explicitly locks event details. Cancelled without submitting to keep prize-plan wording editable until approved. Registration remains closed; roster 0, no receipts/expenses, games, assessment, B nomination/binding or settlement created for this new fixture. Current director browser session and empty score/retry queue preserved on tournament workspace. No existing fixture or production changes.

## Smallest next decisions

Propose explicit TEST ONLY prizes $216 champion, $108 runner-up, $54 each semifinal loser, total $432, optional prize order left absent for the tied semifinal band. This is a director-chosen test split, not an ACC-mandated formula. Approval is needed before locking this description or recording prize/final settlement claims.

Separately approve existing pr122-player-b@test.invalid as tournament-scoped cross_checker for this new tournament, user-operated secure invitation acceptance, and director's audited B nonparticipant confirmation; no additional account/role. Ordinary setup/scoring/qualification/simulated playoffs and synthetic $30 receipt/$48 expense scope are already approved. Preserve prior zero-ledger and mixed fixtures. No actual payments, email, credentials, settings, migration, publication or production work.
