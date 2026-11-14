# Prize RPC adapter and guard source verification

Acceptance: one authenticated user-client RPC per attempt; exact canonical request/account/tournament/hash binding; explicit V4 fresh-save protocol with historical V3 recovery; no false success on auth switch, errors or malformed records; recovery independent of writes, never clearing pending; no actual DB/provider/hosted activity. Guard foundation must remain private, unattached and clearly incomplete.

Changed source: src/lib/api/event-prize-rpc-v1.ts; event-prize-settings-v1.ts; event-prize-transaction-v1.ts; database/proposals/event-prize-guard-source-v1.sql. Added adapter tests and fresh-V3-stage rejection test. Independent review required before frozen checkpoint.

Focused command: node --conditions=react-server --experimental-strip-types --test tests/event-prize-rpc-v1.test.mjs tests/event-prize-settings-v1.test.mjs tests/event-prize-transaction-v1.test.mjs. SDK/transaction doubles only; NOT a PostgreSQL transaction, RLS, ACL, concurrency or rollback proof. No UI change, so no browser result is claimed.

Review corrected fresh V3/V4 cross-layer mismatch and throwing feature-flag handling. Fresh coordinator stages and adapter acceptance both require V4; shared ACK validation still permits historical V3. Recovery includes exact original raw request; a server cannot hash-bind a missing journal using an operation ID alone.

SQL is an unexecuted partial foundation, not a migration. No core carry trigger attachment exists. Full writer/head/snapshot/outcome, fresh nested-key collision protocol, commit/replay behavior and read-only recovery implementation are still absent. Current-role, transaction-ID, expected-version and nested-payload checks are source reviewed only. Future writer must take both operation advisory locks consistently before tournament/role locks, and raise nested JSON rejection inside its savepoint. No GUC or posted absence may authorize carry. No operational claim until authorized isolated DB tests and real signed-in provider acceptance succeed.

No payout mathematics or policy changed. Historical awards/drafts and earlier source checkpoints must be preserved. No actual migration/grant/publication/payment was attempted. Current full-check attempt may require registry network access for dependency audit; do not reuse earlier audit result as current proof.

Final executed results: 41 focused tests; 2,177 application tests; lint exit 0 (119 pre-existing warnings); provider readiness exit 0; production build exit 0; workspace 8 and private handoff 6 passed. Source-only independent review GO after the fresh-V3-stage and guarded-flag fixes, and after adding the private binding trigger's cross-table association proof. No SQL syntax/install/runtime or real SDK session test was performed.

`pnpm verify` exit 1 at its first dependency audit: registry.npmjs.org ENOTFOUND, then fetch failed. All subsequent local components were run separately and passed; this is NOT a passing complete verify command. An escalated read-only audit retry was rejected by automatic approval review before execution because dependency metadata could be sent to the external npm registry without export authorization. No further retry or indirect bypass was attempted. That audit is denied/pending authorization; no current clean audit claim is made.

Evidence logs: test-results/event-prize-rpc-v1-verify.log (failed audit); test-results/event-prize-rpc-v1-local.log (local components); focused final log and source/archive checkpoint receipt. This archive is source preservation, not a database recovery point.

Final lint rerun removes the new unused test helper; only the 119 existing warnings remain. Final focused and integrity checks rerun after that test-only cleanup. Snapshot association trigger is attached only to the new private binding table; the core carry trigger remains unattached.
