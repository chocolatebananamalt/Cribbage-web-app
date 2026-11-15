# Five-qualifier playoff v4 component verification

Local implementation only; no commit, push, deployment, hosted migration or tournament mutation.

## Contract and preservation

`0251_five_qualifier_playoff_v4.sql` adds one private, forced-RLS immutable table and three service-role-only RPCs. The server derives three first-round bye credits and exactly four actual series from the source-reviewed eight-slot chart (1v8,4v5,3v6,2v7), not from client win/bye claims. Five qualifying cards retain their original scores. Same-round semifinal losers share the3–4 band; the first-round loser has band5. Published playoff MRP credits are70/42/21/21/7 for the reviewed seed1-champion example. A lower-seeded champion wins three played series and receives no bye.

Writes carry the exact qualification version, server source digest, reviewed reason and four played series. Reconciliation carries the full retained request. Current role is checked before replay/reconciliation. Same-source duplicate records, stale versions, source changes, mixed v3/legacy domains and post-accounting changes are blocked. Canonical MRP/current-source readers dispatch only the new tagged domain through preserved legacy implementations. No direct table grants or payment writer is added.

## Completed component checks

- `node --experimental-strip-types --test tests/five-playoff-api.test.mjs`:4/4PASS, including independently recomputed wins/byes/cohorts/MRP, strict request/receipt/source validation, semantic JSON field ordering and rejection/recovery contracts.
- TypeScript `--noEmit --incremental false`:PASS in `test-results/five-playoff-types.log`.
- Scoped ESLint on new API/routes/page/client:PASS, zero errors/warnings.
- `node --experimental-strip-types tests/five-playoff-browser.mjs`: final run3PASS,9 grouped checks at390/1440. Actual React/recovery boundary with fictional local API interception; this is separate from real SQL persistence proof.
- Browser checks: four played series/three visible byes/unchanged qualifying cards and MRP; repeated clicks single-flight; interruption/reload/exact explicit retry; server-success/lost-response reconciliation without new POST; wrong-source receipt retention; full-request identity conflict; stale rejection requiring fresh review; unknown retained envelope fail-closed; unavailable/blocked service without legacy fallback.
- Final screenshots `test-results/five-playoff-390.png` and `five-playoff-1440.png` inspected. A global flex override initially crowded desktop series headings; the responsible fieldset now explicitly uses a one-column grid. Final harness checks computed grid display and no page overflow. Earlier functional passes did not prove this visual correction.
- Temporary server PID36704 absent and localhost3253 has zero listeners, verified2026-10-29T23:56:11.1298409Z; `test-results/five-playoff-browser-cleanup.json`. No unrelated process was stopped.

## Integration boundary

`tests/five-qualifier-playoff-sql-acceptance.mjs` consumes the root's real finalized17-player fixture; it does not fabricate immutable qualification rows. Its optional race adapter observes two independent writer connections waiting on the shared event lock. It also supports the canonical v6 draft/final writer race names, with an explicit whitelist. Root owns actual integrated SQL execution, full verification and independent final review. This component note does not claim those gates passed.

New source work is not covered by an older backup merely because that older archive exists. A later verified snapshot must identify the precise included milestone.
