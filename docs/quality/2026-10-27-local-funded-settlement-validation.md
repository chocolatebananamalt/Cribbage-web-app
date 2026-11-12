# Local funded settlement validation — 2026-10-27

Historical $3 balancing proof only. Its proposed hosted follow-up was superseded by the owner's $30 entry-fee clarification and the later local payback repair; see 2026-10-27-payback-review-local-validation.md. No $3 hosted fixture was created.

User approved separate local fictional accounting validation: sixteen $3 receipts, one $48 sanctioning expense, no prizes/Q Pool claims/retained balance. No hosted records, shared migration, publication, security changes, real money or email authorized or performed in this step.

## Deliverables and actual execution

* `tests/funded-settlement-v5.sql`: rollback-only SQL proof; direct synthetic roster/participant/schedule/qualification/start/assessment foundation explicitly identified. Actual financial obligations, receipt and expense writers, cross-check closure, playoff writer and v5 draft/finalization RPC behavior exercised.
* `tests/run-funded-settlement-v5-isolated.mjs --isolated-container`: explicit opt-in, exact container name/label/image ID, network none, zero ports/mounts, not privileged. Validates reviewed empty-post-0236 dump SHA256 `e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`, refuses reset of nonempty fixture data, restores only `fixture_0240`, loads 0237–0239 as postgres, verifies/inlines canonical 0240, uses psql `-X`/ON_ERROR_STOP, asserts rollback emptiness.
* `tests/funded-settlement-v5-source-contract.test.mjs`: 3 source-contract tests, distinct from actual SQL execution.

Cached official image `public.ecr.aws/supabase/postgres:17.11.0.004`, ID `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`. Created only local container `cribbage-0240-isolated`, exact ID `98994733dddb237d129dda845efdac0c0ca6cc930d838c03cc058293250d5933`. No host-folder access or exposed port; no new external/persistent credential. The transient local test password disappeared with the container.

Canonical 0240 remained unchanged: raw working-file SHA256 `92f81b32bed0618fda4b17cb7c2def2564e6a6bfdf6a819a51d9c572c52833e8`; normalized-LF `19107d90cc6c86fbf3497bb7bd0f28ad19c07f48f0393eb0ee0d9e693f40b701`. No withdrawn migration was used.

## Passed funded path

Authenticated-role financial RPCs saved sixteen explicit 300-cent obligations and sixteen synthetic 300-cent cash receipt records through `set_roster_payment_obligation_v1` and `record_manual_roster_payment`. `record_tournament_expense` saved one synthetic 4,800-cent expense. Exact payment-1 and expense replays return original results without new ledger versions/receipts/audits. These are disposable test records, not actual cash received/paid.

Actual ledger: 16 active receipts totaling **4,800 cents**, 1 active expense totaling **4,800 cents**. Immutable assessment is 16 × 300 = **4,800 cents**. Supported cross-checker assignment/closure RPCs execute against the disclosed zero-game synthetic foundation. This is not a played scoring or independent paper-evidence proof.

V3 playoff RPC records three synthetic series. V5 first saves a draft lacking expense binding and rejects its finalization as `sanctioning_assessment_unfunded`; exact rejected replay is unchanged. Wrong expense ID rejects. Corrected draft binds the actual expense and exact ledger snapshot. Finalization succeeds with **4,800 income = 4,800 expense + 0 prizes + 0 retained**, empty prizeClaims, no Q Pool claims, and explicit review attestations in the isolated fixture.

Exact draft/final replay is unchanged; changed-body same-key requests conflict; fresh stale-version requests reject; outsiders cannot create draft/final receipts. Payment, expense, draft and final mutation attempts must raise exact `immutable history`; unrelated exceptions rethrow.

Exact assertions passed: **2 draft versions / 1 final version**, **4 draft operation receipts / 3 final operation receipts / 3 conflict rows / 10 settlement audit events** including conflict audits. Financial operation receipt counts remain **16 obligations / 16 receipts / 1 expense**, with matching receipt-to-audit cardinalities; playoff receipt/audit count is 1. These operation receipts are distinct from payment ledger entries.

## Verification, repairs and cleanup

Final actual SQL command: `node tests/run-funded-settlement-v5-isolated.mjs --isolated-container` — **exit 0**, marker `FUNDED_SETTLEMENT_V5_SUPPORTED_LEDGER_AND_FINALIZATION_PASSED`, deferred constraints forced immediate, final ROLLBACK, **0 users / 0 tournaments**. Logs: `test-results/funded-settlement-runner.log`, `test-results/funded-settlement-v5.log`, `test-results/funded-settlement-restore.log` (ignored local artifacts).

Initial recoverable failures were test-harness issues, not product defects: missing canonical include stopped before SQL; newly added replay result matched the original payment-label count and falsely counted 17 temporary result rows. Corrected to `^payment-[0-9]+$` without weakening the actual 16-payment assertion. Independent review also required all-mount rejection, postgres prerequisite ownership, explicit postgres role restoration instead of RESET ROLE returning to session supabase_admin, exact immutable-history errors and precise side-effect counts. All corrected assertions passed on the final real SQL run.

Final `pnpm verify` — **exit 0**: production audit reports no known vulnerabilities; ESLint 0 errors/2 existing warnings; **843 application tests passed**, no failures/skips; provider readiness passed with external providers disabled/manual fallback; production build/typechecking passed; workspace **7 passed / 1 private-handoff skip**. Log: `test-results/funded-settlement-verify.log`. Focused source checks **3/3**, runner syntax/focused lint and diff whitespace pass. No application/migration SQL changed, so no new browser run was needed for this test-only addition.

Independent final review: no P1/P2 findings. It confirmed the corrected result counts, guards, role identity, exact immutable errors and coverage limitations. Guarded cleanup verified exact container ID/image/label/isolation and 0|0 data, removed only that container and its disposable storage, then verified no matching container remained. No restart or user cleanup required. Existing hosted director session and fixtures were not accessed or changed during local validation.

## Explicit limits and next separately approvable stage

Qualification/scoring/schedule/start/assessment are directly seeded prerequisites; the fixture does not run 96 games, public qualification finalization or the normal start workflow. Financial writers run as authenticated with synthetic JWT identity; V3/V5 calls run as privileged postgres with actor checks, not PostgREST/service-key/API transport. Existing ACL tests remain separate evidence. No funded browser/API test, actual concurrency race, legacy result source, prize/Q Pool payout, multi-event allocation, post-draft ledger mutation/expense revision or production-load/index test was run. This proves balancing and finalization only, not ACC sanctioning/payback compliance or prize distribution.

Recommended hosted follow-up: preserve the completed zero-ledger/unfunded fixture and create a fresh TEST ONLY funded tournament with 16 fictional paper players and $3 entry, sixteen explicitly synthetic $3 obligations/receipt records, one explicitly synthetic $48 sanctioning expense bound to the actual $48 start assessment, Q Pools/prizes/retained 0. Reuse reviewed 96-result synthetic matrix, proper supported qualification/closure and three-series playoff flow, then save/finalize the bound funded settlement and verify persistence/counts. Stop if actual assessment or guards differ. Existing B requires a separately approved tournament-specific cross-checker nomination, user's personal invitation acceptance, and approved director nonparticipant confirmation. No extra accounts needed. New hosted business records/access require a specific bundled approval; none were created here. Existing $0 fixture and unfunded $48 remain untouched.

No new implementation, migration or deployment is needed to try that staging scenario on the current reviewed app. Q Pool implementation/policy, photo/OCR, typed byes, physical multi-device/offline, SMTP, password remediation and index/load/security release gates remain separate.
