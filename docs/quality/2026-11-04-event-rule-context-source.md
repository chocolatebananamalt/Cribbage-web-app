# Event-rule context and activation backstop: local source checkpoint

No SQL execution, database fixture, hosted access, publication, invitation or money movement occurred. All new SQL is an **unexecuted private proposal**. Previous archives remain preserved.

## Implemented

- `event-rule-review-v1.ts` models an append-only, source-bound review history. A new explicit review can bind a new settings generation without overwriting prior rows. Only the latest review matching all current source IDs and the opaque server digest can supply a setup-review plan. Context kind must match the separately loaded event kind; original entrant count must remain null at setup.
- `event-rule-context-v1.sql` proposes immutable Director-declared context versions and full actor/operation/request receipts, optimistic prior-review checks, exact retry and historical readback. It derives setup-event identity and draft digest from stored current settings. It freezes review edits to an activated setup revision. Approval-reference text is metadata and cannot establish external approval.
- `event-rule-assessment-v1.sql` proposes private numeric-format resolution and bounded assessment corresponding to existing one/two-day setup rules. RC exceptions, unsupported custom formats/durations and unresolved ratio paid-place policy remain blocked. SQL/TypeScript parity has **not** been executed.
- `event-settings-activation-guard-v1.sql` proposes a current reviewed-source reader, immutable preparation intents and a BEFORE INSERT activation backstop. It checks current actor/reviewer roles, exact settings/association hashes, latest context pins and existing legacy declaration coverage. It retains all existing prize and association guards and never calls an operational activation core.
- A setup-eligible deferred original-field-size check is retained with its before-playoffs obligation. The new intent preparation deliberately rejects it until the native pre-playoff gate exists. It never treats a checkbox or pasted reference as a waiver.

## Independent review

Two concrete source findings were fixed: the backstop now recomputes the full V4 digest including both legacy arrays, and it rejects non-READ-COMMITTED transactions before any source-dependent legacy early return. No remaining P1/P2 was found in the reviewed source. This is not PostgreSQL parsing, installation or concurrency proof.

The isolation guard is a compatibility consideration: all new activation inserts passing this trigger would require READ COMMITTED, including legacy inserts. Historical records and receipt replay are not rewritten. Source-table SHARE NOWAIT reservations deliberately prioritize consistency over cross-tournament write concurrency; contention must return retry rather than silently weaken the locks.

## Tests and limits

Focused source/model checks passed 21 tests. They cover historical prefix preservation, stale IDs, event-kind mismatch, unknown setup field counts, reason bounds, non-waivable rule issues, current review assembly, hash coverage, private functions and early isolation rejection. Static SQL inventory tests do not prove executable SQL or provider behavior.

Full gate logs: `test-results/event-rule-context-final-verify.log` and `event-rule-context-handoff.log`.

Still required: separately authorized isolated PostgreSQL installation and SQL/TS assessment matrix; actual-role ACL rejection; accepted/rejected exact replay; concurrent review/settings changes; lock contention; rollback; native activation backstop tests; and cleanup. No new fixture is authorized in this checkpoint.

An actual operational activation writer and verified transport adapter remain unfinished. They must bind reviewed settings and context atomically while preserving legacy declarations and associations. The native before-playoff field-size backstop is also unfinished. Nothing here removes the old declaration interface or enables setup finalization, registration, game play, financial allocation or payouts.

## Completed local gate

Passed 1601 application tests, six provider checks, audit, ESLint, production build and eight workspace checks; six handoff tests passed. Final SQL-only intent-readback addition passed eight focused source inventory checks after the broad run. SQL was not executed.
