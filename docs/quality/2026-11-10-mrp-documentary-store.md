# MRP Documentary Store Candidate

Local SQL source only: database/proposals/mrp-event-determinations-v1.sql. Unexecuted, not a migration; all functions revoked, gate false, table RLS forced. No official points saved.

Implemented immutable per-event/roster documentary review records, current journal and qualifying/playoff head pins, separate actual-play dates and document intervals/references, actor/session/reason audit, exact actor/operation receipt namespace, compare-and-swap head and a private current/stale recovery reader. Existing auth helper enforces the actual primary Director under ordinary session claims. Coarse table locks deliberately cover concurrent source inserts as well as rows; runtime behavior/performance is unverified.

Authority boundary: these records remain Review Pending. An entered reference, interval and Director confirmation is documentary review, not verified ACC status. No auto-promotion from this store, journal, absence or current public lookup. Existing verified website-error correction policy still requires matched identity, current correction lineage and genuine documentary status/date coverage. No renewal grace policy encoded.

Verification: four source guard tests and focused ESLint passed. These check default-off/revoked/immutable boundaries, scoped references and source-pin/idempotency clauses; they do not parse or execute PL/pgSQL. No database fixture was made and no denied operation retried. Independent source review pending.

Remaining implementation blocked by source-authority acceptance: the verified-evidence RPC must be fed a record establishing matched roster/ACC identity, definitive membership status and effective interval covering actual play. Current journal/reference fields do not establish those facts, so the RPC and actual SQL award adapter remain missing. The existing TypeScript writer protocol cannot yet save real official points. Do not solve this with a generic TD historical certification shortcut. Native SQL runtime/ACL/concurrency/rollback/provider checks also remain unverified.

Review found a repeatable-read stale-snapshot risk; both current-head functions now explicitly require READ COMMITTED before authorization/source collection. A focused source guard verifies both clauses; runtime isolation remains unproven.
Independent documentary-store source re-review GO after isolation correction; no remaining concrete source defect found. SQL syntax/runtime, installation, concurrency/rollback still unverified; no authority promotion.
