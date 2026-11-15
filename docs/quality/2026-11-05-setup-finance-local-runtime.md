# Setup and Finance: disposable local runtime verification

## Result and scope

The final complete local PostgreSQL run exited 0. It installed migrations 0237-0292 and all 15 current setup/Finance proposals over the pinned empty baseline. No migration, proposal or production SQL source was changed. Local Chrome IndexedDB recovery also passed. This is private owner-candidate evidence, not release clearance or a completed Finance workflow.

User authorization covered bounded disposable local setup/Finance tests with fictional data and verified cleanup. Staging/production, real money, invitations and publication were excluded and were not accessed. All seven sequential PostgreSQL test containers were removed; root independently queried their exact IDs/name and verified absence. Browser test storage was deleted and its context closed. Nothing was left running.

## PostgreSQL evidence

Final evidence directory: `test-results/event-settings-finance-current-2026-11-05T02-54-37-021Z`.

- Exact container `f71659fddfde3289149f098dd2355cf045110514c0f60cc3220f87293ae6cf75`, pinned image `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`, Docker Desktop Linux local npipe, network none, no mounts/ports/privilege and dropped capabilities. The engine was never a hosted target.
- Empty baseline SHA-256 `e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`; empty auth.users/tournaments were checked before seeding. This is not an exhaustive assertion that every configuration table was empty.
- Legacy Q/setup/typed Finance save/read/replay/reconcile, source conflicts, append-only correction, unchanged original history, rollback and real two-session barrier cases passed. Q amount parity covers 35 pure amount cases, not complete eligibility/accounting.
- The product operational activation gate rejected new writes while literal false with no attempt/outcome/binding. A fixture-only local marker temporarily exercised positive candidate activation with the real role/source/context/assessment/playoff/Finance guards. The exact original helper definition was restored and verified. Product source was never enabled or weakened.
- Positive candidate activation created one activation and one operational binding. The positive native scenario is one Standard Main event, not proof of all Main/Consolation/Satellite or mixed-play combinations.
- All 15 protected authoritative Finance table insert paths for configured events raised the expected integration-required backstop.
- Registration/roster/participant prerequisites were direct synthetic seeds. Payment and expense evidence used `public.record_manual_roster_payment` and `public.record_tournament_expense` and asserted their success statuses. No bank/provider or physical-world receipt was established.
- Native source reading/allocation accepted; exact replay and reconciliation passed; changed request conflicted; setup-version IDs in operational allocation were rejected; an actual exclusive source-table lock returned retry-exact without an operation record, then the unchanged request succeeded. Injecting an outcome failure rolled back the write; same-key recovery succeeded. Three allocation revisions persisted before disposal. These are allocation revisions, not three payments or payouts.
- Effective privilege/catalog checks covered 22 exact private tables and 58 functions with no missing objects/RLS or ordinary-role permissions. Actual SET ROLE probes denied SELECT/INSERT/DELETE/TRUNCATE for all 22 tables and denied six key private functions for anon/authenticated/service_role. The native source getter is included.
- Money moved and payout authorized flags remained false. Native allocation is not disbursement, approved awards or a final accounting close.

`sql-result.json`, `trace.json`, `final-db-counts.txt`, `container.json` and `cleanup.json` preserve exact results. Supplemental catalog detail from the previous successful run is `test-results/event-settings-finance-current-2026-11-05T02-49-27-856Z/candidate-private-acl-live.json`. Root cleanup verification: `test-results/event-finance-local-runtime-cleanup-independent.json`. All 56 installed migration files and 15 proposal files were independently rehashed against the final successful trace; `test-results/event-finance-runtime-source-hashes.json` confirms all 71 current source files match.

## RLS posture and limits

The three native allocation tables enable RLS but do not FORCE RLS:

- native_ledger_allocation_operations_v1
- native_ledger_allocation_outcomes_v1
- native_ledger_allocation_revisions_v1

A test originally conflated missing FORCE with an ordinary-role privilege. The corrected test separately preserves RLS and effective/direct privilege denials and reports this owner posture. No product policy was changed to fit the test. FORCE changes ordinary-owner treatment; SUPERUSER/BYPASSRLS still bypass it. The local owner fixture is privileged. Provider role attributes, inherited/default privileges, installer ownership, trusted HTTP auth and real deployment semantics remain unverified. There is no claim of production security clearance.

## Browser device recovery

`node tests/event-finance-device-recovery-browser.mjs` used one disposable headless Chrome context at localhost:3369 and the real lazy IndexedDB adapter. It verified mounted session/UI activation, explicit save and byte-identical reload of zero overrides and incomplete `3.` typing, saved-account key isolation, revision archives and concurrent-tab CAS conflict preserving both proposals. The exact prior raw revision was read from the archive store and matched. No page errors or HTTP write requests occurred. IndexedDB writes did occur as the intended device test; the `writes:[]` result field describes HTTP only.

`test-results/event-finance-device-browser/result.json` and `cleanup.json` report success, actual database deletion and browser closure; server shutdown was independently confirmed by connection refusal. This source was a fictional prepared contract, not actual Supabase authentication. It does not prove sign-in/sign-out ownership guards, malicious same-origin isolation, cross-device sync, quota/failure/upgrade behavior or real Finance sources. Explicitly unsaved in-memory changes are not promised durable on navigation.

## Full verification

Final `pnpm verify` passed: 1,724 application tests, six provider checks, dependency audit, ESLint, production build and eight workspace checks. `pnpm verify:handoff` passed six checks. Logs are `test-results/event-finance-local-runtime-final-verify.log` and `event-finance-local-runtime-final-handoff.log`. Independent source reviews closed the recovery and cleanup findings. A post-run helper comment was corrected to distinguish seeded registration prerequisites from the supported payment/expense RPCs; executable behavior was unchanged.

Earlier failed fixture runs are preserved with cleanup proof. Failures were harness assumptions: raw PostgreSQL boolean parsing, a NULL fixture switch, retired registration defaults, forged direct expense authority and the overbroad FORCE assertion. Existing constraints were preserved; supported RPCs replaced the invalid direct payment/expense construction. The last two runs exited 0, with the final run adding direct-role probes.

## Exact incomplete action: full UI-to-server-to-payout flow

Status: NOT IMPLEMENTED, not denied. The old Finance draft store uses setup-event VERSION IDs and plain financial lines. The new UI uses operational event IDs and also needs named rows, complete source/basis/count/settings metadata, incomplete forms, whole-band overrides and their saved planning basis. No reviewed operational-event store/source assembler connects these. IDs were not coerced and no guard was bypassed to manufacture success.

Required next implementation: a correctly scoped native workspace producer; a separate versioned operational-event proposal store/journal/reconcile with source/role locks, exact retries, immutable prefixes and rollback; then a distinct actual evidence/ledger and final finishing-result/recipient bridge. Native additional-income and optional-pool allocation coverage is incomplete. `buildMainConProposalBasisV1` is qualification-only estimated awards and cannot assign recipients or approve payment. Existing custom ratio/beyond-qualifier policy gaps remain blocked.

The full Finance save-to-payout path, real-user/provider flow and weekend real-money readiness remain unproved. No hosted release or data change is authorized by this test outcome.
