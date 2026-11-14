# Custom ratio candidate verification — local only

2026-11-04. No hosted reads/writes, database fixture, migration apply, publication, invitations or money.

Implemented separate candidate amount V3, versioned intent/recovery codec, exact Q policyV5/source codec, paid-card preview and retained-plan recomputation. Positive ratio domain1..2147483647 is a PostgreSQL storage constraint, not an ACC rule; no historical method widened. Existing Side operating engine's custom7 behavior is regression-covered. Satellite intent persists through pure codec but calculation is deliberately blocked pending event distribution policy.

Focused final36/36 tests PASS, including500 deterministic intent roundtrips,1,000+ old-domain calculator comparisons, extended-domain invariants, source/identity conflicts, unchanged legacy contracts and Side history. Independent review32/32 PASS; duplicate and case-alias identity P2 findings both fixed, no remainingP1/P2. Historical V2 calculator, V4 codec and0258 migration unchanged.

Pure SQL candidate is UNEXECUTED. Source-level test proves only function/version/domain/bigint ceil changes versus the historical pure calculator. It does not prove PostgreSQL execution, ACL, public writer persistence, concurrency or accounting integration.

Latest Satellite label correction browserPASS320/390/1440 at100/200% text: exact `1-in-# (Custom)` onlySatellite, presets hideinput, QEqualpreserved, invalidCustomgates andexactretainedretry unchanged. Taskserver exited23596. UIonlycheckpoint mustremainseparate fromnewcandidatefiles/SQL.

Release dependencies and unfinished boundaries are explicit in docs/decisions/2026-11-04-custom-ratio-integration-plan.md. CustomN is NOT yet end-to-end in the app. The old UI still blocks unsupported fresh custom values, truthfully. Do not claim funded final accounting, publication, or current database authority from a supplied source digest.
Final combined `pnpm verify` PASS:1450 application tests,8workspace, productionbuild,TypeScript,lint,providerchecks andaudit. Explicit handoff6/6PASS. No database/provider runtime acceptance was performed.

## Persistence/accounting follow-up checkpoint
- Added exact full-setup/envelope recovery and bidirectional Custom intent coverage, including whitespace-normalized core-storage behavior without rewriting retained bytes. Six envelope groups PASS.
- Added unpaid Q accounting bridge: re-evaluate current plans, require separately supplied current allocation buckets, one identical whole-event source observation, exact budget/award conservation, and no duplicate pool/policy. Three accounting groups PASS.
- Independent final source review9/9 combined groups PASS; source consistency and intent coverage P2 findings closed, no remainingP1/P2 in this bounded slice.
- Final `pnpm verify`:1459 application tests,8workspace, build/TypeScript/lint/audit/providerchecks PASS. Explicit handoff6/6PASS.
- Private journalSQLproposal is unexecuted, storage-only, no publicwrapper or insertgrant. It is not a transactional writer, source/receipt validator or operating/financial authority.
- Future ACC playoff-series source distinctions and Daron's local implementation authorization are recorded separately; no series code bundled.

Still incomplete: guarded transactional save/amendment/activation and policy/source/award accounting integration for customN. Future writer must bind the entire new envelope atomically, preserve old exact replays, refuse old-client intent loss, and obtain database/role/concurrency/rollback proof in a separately authorized disposable local database. Satellite allocation policy remains undecided. No hosted action or new database fixture occurred.
