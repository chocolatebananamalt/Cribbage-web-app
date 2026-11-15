# Local Consolation four-qualifier playoff evidence — 2026-11-03

Scope: local proposal only. Migration 0278 adds a separate immutable outcome
stream for four Standard Consolation qualifiers, a source-bound derivation,
service-only writer/workspace/reconciliation, and a separate owner-prepared
synthetic artifact with false physical-play and human-review provenance. It
does not add accounting dispatch, payouts, UI wiring, publication, or a hosted
migration. The physical path requires an explicit physical-play attestation;
the synthetic path cannot make that claim.

Acceptance: the current Main and Consolation qualification snapshots and score
fingerprints must agree with current evidence. Every Consolation entrant must
map by roster entry to one Main nonqualifier; a nonqualifier may opt out. Four
seeds play 1–4, 2–3, then the two winners. The semifinal losers share the 3–4
band. MRP thresholds and scales match the reviewed ACC Consolation reference
effective 2016-08-01; the bracket source is the ACC 2025 rulebook. The writer
records the source identifiers and preserves earlier result domains.

Executed `node --experimental-strip-types tests/run-consolation-0278-container.mjs`
on the reviewed no-network/no-mount disposable PostgreSQL image
`sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`,
with the reviewed empty post-0236 baseline, migrations 0237–0277 in order,
then 0278. Passed. The exact task-created container and temporary database
were removed. Qualification was finalized by the normal RPC for a fictional
20-person Main and 14 of its 15 nonqualifiers entering Consolation. Seven-,
eight-, nine-, and ten-game source and MRP cases passed. The fictional $10
Consolation fee and 14 entrants are local fixture assumptions only.

The suite exercised current-source and cross-event rejection, Main qualifier
and missing-roster rejection on separately finalized current snapshots,
12-player/three-qualifier rejection, no Main opt-out requirement, malformed
brackets, source changes, service and director boundaries, audited artifact
mismatch, exact replay, changed-key conflicts, stale versions, duplicates,
source-bound synthetic provenance, and unchanged qualification/score hashes.
It observed both financial-first and outcome-first tournament-lock orderings,
an attempted post-final Main correction/dispute followed by the waiting writer,
and competing outcome revisions with one accepted and one stale. A rollback-only
existing v8 draft blocked the writer, and attempted legacy and v6–v9 same-event
draft/final inserts were rejected after an outcome. The post-final correction and dispute were rejected by the existing
qualification freeze; no actual stale score correction was applied.

The score rows predate the synthetic fixture enrollment in this disposable
test; they are unstructured synthetic fixture data, not structured paper-card
proof or independent-human verification. The 13–16 field-size defense was not
independently isolated using a fabricated four-qualifier/12-player historical
snapshot. No populated historic v1–v9 final was replayed through this fixture.
Existing v9 tournament-wide finalization guards may block qualifying a later
Consolation after a Main final; this test qualifies both events before a final.
Whole-workspace verification and integration into accounting remain the lead's
separate gates. Independent focused review found no outstanding P1/P2 in this
scoped slice after correcting a financial lock inversion and adding audited
synthetic mismatch handling; it did not clear accounting or production use.
