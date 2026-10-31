# No-Q unpaid accounting v7 component verification

Local app work only. The backend migration and real SQL integration are separately owned and verified by the root task; this note does not substitute mocked browser checks for persistence evidence.

## Implemented

- Separate no-Q workspace/API/page and financial recovery envelope. No Q review ID, fake Q policy, membership record or Q obligation is constructed. Facts must have zero Q income.
- Draft and final requests bind the exact source, structured schedule, expense evidence, actor and operation identity through the backend contract. Full retained requests accompany reconciliation. No automatic retry, payment, paid flag or executed refund is added.
- Existing shared classification/facts validators are reused. The shared schedule validator was only renamed/exported as `isQAccountingSchedule`, with its old internal call updated; its behavior was not changed by this component.
- A validated existing pool-membership read selects no-Q accounting for explicit zero pools, Q accounting for supported one/two named pools, and no route for unknown or cross-event data. The five-qualifier page no longer assumes Q accounting. Common settlement entry checks and preserves legacy history first; failed legacy-history reads do not count as absence.
- The v4 API now compares UUID identity case-insensitively where PostgreSQL normalization can differ from an exact retained request. It still hashes/preserves the actual request content in the database; case normalization does not create a new retry payload.

## Actual checks

- Eight combined focused v7/v4 API tests pass. V7 cases cover zero-Q facts, five-player bye/MRP awards, cash conservation, 85% review, matching schedule/source IDs, malformed/paid/Q fields, full reconciliation requests and correct route selection. The v4 regression covers a retained uppercase qualification UUID and lowercase PostgreSQL identity.
- TypeScript `--noEmit --incremental false` passes: `test-results/no-q-accounting-v7-types-final.log`.
- No-Q browser run1 passes eight grouped checks at390/1440: complete classified draft/final flow, dollar display, no Q review submitted, repeated-click single-flight, interrupted request/reload/exact retry, lost-response reconciliation without another POST, wrong-source receipt retention, identity conflict retention/blocking, stale-source review and unavailable-source blocking.
- Browser uses actual React/recovery components with fictional local API interception. It does not contact hosted Supabase, user sessions or external services.
- `test-results/no-q-accounting-v7-browser-results.json` and `no-q-accounting-v7-browser-run1.log` retain the executed result. Both phone/desktop screenshots were visually inspected; no horizontal overflow.
- Temporary server PID11864 is absent and port3255 has zero listeners, verified2026-10-30T00:04:44.8225754Z in `test-results/no-q-accounting-v7-browser-cleanup.json`. No unrelated process was stopped.

The browser fixture has17 synthetic $30 entries: $510.00 receipts, $228.00 expenses, $282.00 total regular prizes, $0 retained, $435.00 participant return against a $433.50 minimum. Its director-selected weights give $94.00/$70.50/$47.00/$47.00/$23.50. These are test choices, not a new ACC-mandated formula. Qualifying score totals and MRP are not rescaled for currency formatting.

Full repository verification, fresh independent review, real SQL concurrency/immutability evidence, future hosted acceptance and publication approvals remain separate gates owned by the root task. Nothing in this component constitutes deployment or production readiness.

## Actual SQL response rendering smoke

An additional read-only smoke uses `accounting.workspace` from the root's actual disposable SQL artifact `test-results/no-q-seventeen-main-sql-result.json`. It validates the response with `isNoQAccountingWorkspace`, renders the actual React component at390/1440, then serves the same exact response through an intercepted local GET refresh. Both viewport groups pass; the prior eight browser recovery groups remain separate and unchanged.

Actual displayed values: $510.00 base/total receipts, $229.50 expenses, $280.50 regular prizes, $433.50 minimum and participant return, and five unpaid awards $93.51/$70.12/$46.75/$46.75/$23.37. Final draft/final buttons remain disabled, no Q review is rendered, and no cent-unit labels or horizontal overflow appear. Both screenshots were visually inspected.

- Result: `test-results/no-q-accounting-v7-real-sql-browser-result.json`; final execution `no-q-accounting-v7-real-sql-browser-run4.log`.
- Exact input artifact SHA256: `c2ee6fee8e832a427ffe89df8360362fdd4687969cdc9b972ad202d2cbe8435e`.
- Frozen rendered workspace: `test-results/no-q-accounting-v7-real-sql-browser-workspace.json`; canonical JSON SHA256 `ee90ed8f8cabc8ea8e39bf1281ad7366c5c5986c17eba9b076581ae8d2d309e7`, independently matched to the result after execution.
- Two GET refreshes and **zero mutation requests** across both isolated contexts. No hosted service or live browser-to-database connection was used; this proves actual SQL serialization -> strict app DTO -> React rendering, not a live authenticated transport.
- Screenshots: `test-results/no-q-accounting-v7-real-sql-390.png` and `no-q-accounting-v7-real-sql-1440.png`.
- Cleanup: PID8880 absent, port3255 listener count0, verified2026-10-30T00:16:59.5252806Z in `test-results/no-q-accounting-v7-real-sql-browser-cleanup.json`.

Earlier smoke attempts failed only on test text assertions: the existing UI uses typographic en/em dashes for the3–4 band and unpaid label while the initial small harness expected ASCII punctuation. The final harness uses semantic matching. All money was already rendered correctly; no application source or database data was changed to satisfy these assertions.
