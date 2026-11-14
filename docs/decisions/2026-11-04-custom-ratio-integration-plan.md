# Custom 1-in-N integration — unpublished candidate, 2026-11-04

## Implemented local candidate

- `custom-payout-intent-v1.ts`: explicit versioned Q/Side/Satellite numeric intent, canonical source-bound serialization and recovery, actor/operation conflict checks and exact legacy adapters. Equal Q and Top4 are never inferred from a number.
- `custom-graduated-amounts-v3.ts`: separate new amount version, original exact fund-conserving algorithm and $5 units, positive ratio through2147483647. The ceiling is existing PostgreSQL integer storage, not an ACC or business maximum. Count/fee limits remain engine limits. v1/v2 methods are not widened.
- `q-custom-policy-v5.ts`: new strict request/reconciliation/workspace contract, numeric ratio and amount-method version; old v4 request stays restricted. Duplicate participant/roster membership identities rejected.
- `q-custom-operating-preview-v5.ts`: current-source pin and event binding, full/preplay/acknowledged paid contributions, all-paid-card graduated ranking and nonqualifier backfill, unresolved cash ties blocked. Retained unpaid plan is recomputed against current source; changing amounts, ratio or source invalidates it. A supplied digest is a pin, not independent authorization/freshness proof.
- Existing operating Side engine already handles ratio7; added explicit roundtrip/historical-amount regression. Its setup-intent bridge is still missing.
- `database/proposals/custom-graduated-amounts-v3.sql`: pure, owner-only, UNEXECUTED amount candidate; no wrapper/grant/table/dispatcher changes. Addition is widened to bigint before computing ceil(count/N), avoiding integer overflow at maximum N.

## Not yet end-to-end / release dependencies

1. A new versioned setup/save/amendment contract must persist numeric intents transactionally with the exact revision and stable event/pool identity. Do not encode arbitrary N by silently overwriting an old preset string or make the UI save succeed before all bindings succeed. Existing source-bound exact replay must cover the entire new request.
2. Side:0275 has preset-only column constraint, trigger and persistence guards. Extend through a new immutable intent/version contract, preserving existing rows and retained operations; bind activated Side definitions to that intent.
3. Q:0137 amendment Q whitelist,0259 operating policy schema/writer/reconciliation and amount/obligation manifests require a separate new namespace/method dispatch. Existing v4 exact requests and historical calculations remain unchanged. Source read models must include event/setup/pool/intent version pins.
4. Multi-event synthetic workflow:0277 disclosure constraint/writer,0281 preview validation/manifest and corresponding API/selector codecs are preset-restricted. New custom method must be propagated through elections, receipts, source currentness, award review, final accounting and disclosure. Do not globally relax historic validators or alter old awards.
5. Satellite: number of recipients alone does not establish distribution weights, eligible event stage, ties or payout basis. Main/Consolation/Satellite event payout decisions were tabled. Preserve existing Top4/1-in presets and advertised Custom intent, but block calculated/final award authority until the event method is chosen. Do not copy a Q/Side algorithm into Satellite merely because both use1-in-N.
6. Actor/current-role checks, tournament/event locks, compare-and-swap current setup, exact idempotent request and immutable audit remain server/database responsibilities. Pure codecs/previews grant no access.
7. Database concurrency/rollback/ACL and actual public-path persistence are NOT verified: no new disposable database is authorized in this task. No hosted migration or publishing authorized. After the candidate writers exist, isolated database verification and independent review are required before a release proposal.

## UI preservation

The separately archived UI-only checkpoint remains reviewable. Its fresh saves intentionally reject noncanonical custom values until the new transactional contract is integrated. Q Equal remains unchanged. Latest Satellite option is `1-in-# (Custom)`; Q/Side use `Graduated 1-in-# (Custom)`. Q heading `Pool Type`; Side/Satellite `Payout`. Only Custom exposes the empty numeric input.

No staging/production records were read or changed, no fixture created, no invitation sent, no payment moved, no publication or migration applied.

## Next persistence/accounting checkpoint

- `custom-payout-setup-v2.ts` now implements the exact full-request envelope and retained recovery: request+event links+custom intents, actor/operation, canonical base source/version and event/slot mapping. Custom-looking nonpreset Q/Satellite advertisements require matching intents; new protocol Side rows require an explicit recognized preset or Side intent. Unchanged untyped historical Side rows need a future baseline-bound exception before using this NEW protocol; old historical endpoints are not changed or silently upgraded.
- `custom-q-accounting-preview-v1.ts` recomputes retained plans against one identical whole-event source observation, checks separate current funding buckets and exact fund/award balance, and blocks duplicates, stale sources, mixed snapshots and under/overfunding. It remains an UNPAID preview requiring normal review, not a ledger or payout writer.
- `database/proposals/custom-payout-intent-journal-v2.sql` adds only an UNEXECUTED private append-only storage candidate, scoped foreign keys, request hash and scope/ratio checks. All app roles revoked, forcedRLS, no public endpoint or insert grant. It does NOT implement a save transaction or establish that an envelope is authorized/current. Future writer must validate all mappings, role/source locks, full request, CAS and accepted receipt atomically; it cannot merely insert a journal after an unrelated old save.
- Satellite option is exactly `1-in-# (Custom)`, while Q/Side retain `Graduated 1-in-# (Custom)`. Only Custom reveals the empty field. Latest browser regression passed.
- Approved playoff series work is recorded separately for after custom-ratio integration; no series implementation has been bundled into this checkpoint.
