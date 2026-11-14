# 2026-11-10 Generalized persisted playoff source and recipient readers

## Implementation

Added `verified-playoff-slots-v2.ts`, reusing the literal ACC2025 bracket arrays already reviewed in `player-playoff-display.ts`. It enumerates only competitive matches in round order, with strictly lower parent ordinals. Byes carry their qualifying seed directly into the next match and never manufacture a game/result. Scope4–64 qualifiers; smaller and>64 automatic placements remain blocked. The original4/5 slot paths and side orientations are unchanged.

`playoff-series-large-fields-v2.sql` is an UNEXECUTED transactional source upgrade: new revoked immutable SQL chart helper using those exact literal arrays; new default-false larger-field gate; guarded replacements of existing match-source generation, generation request validation and native Finance-recipient source reader. Four existing slot CHECKs broaden to1–63 (matches,generations,game operations,operation conflicts), without changing historical rows/hashes or the existing own-submission/confirmation writer. The source resolves seed or current lower-parent result through the existing current-result proof. It retains current qualification/start/context/review/role/linked-digital/preferences/format/lock checks. Unsupported size stays blocked. Exact source/constraint mismatch aborts the transaction. No grants, historical row edits or gate enablement.

The native recipient decoder now accepts bounded larger frames through64, derives chart paths/regular/semifinal/final mapping from the same helper, and retains full independent own-submission/action/confirmation replay, immutable actor-operation uniqueness, current source pins, parent result lineage, first-to-required-wins and finishing-cohort mapping. The shared player bracket projection accepts fixed Tournament IDs beyond chair20 (technical pattern1–9999, not an ACC limit). Existing normal series-game receipt/pending codecs now permit match ordinals1–63; all other bindings remain unchanged. Mixed/paper playoff protocol, legacy aggregate writers and their size guards were NOT generalized.

## Focused verification

13 topology/native-recipient tests passed: every q4..64 has q−1 competitive nodes, unique seeds exactly once, only lower parent references, exact legacy paths, and completed own-confirmed synthetic DTOs for6/7/8/10/16/17/32/64 fields. Wrong parents, missing confirmation, stale qualification and same-actor reused operation reject. Literal SQL/TS chart arrays and guarded source anchors match retained original sources. A first corruption test reused an operation UUID across different actors, which is valid by design; corrected test reuses it for the same actor. No product guard weakened.

40 focused existing bracket/series-client/offline tests passed. TypeScript/scoped ESLint exited0. Independent source review status recorded in final handoff. No UI screen changed in this slice, no browser/device acceptance claimed. Synthetic DTOs are not database persistence proof.

## Exact remaining gates

SQL NOT parsed/applied in a database. Actual constraints/installation, ACL, backward4/5 source-digest equality, larger generation/player game actions/result persistence, stale-parent rejection, retries, rollback, concurrency and SQL/TS parity still require bounded isolated runtime checks. No database test or denied operation was retried. The larger-field gate must remain false until those pass.

Native final award reconciliation still has its own five-recipient/$5 limits and normal final-provider acceptance remains separate; this slice does not claim larger final award recording or selected-rounding final accounting. Mixed/paper larger playoffs need their own provenance design; no synthetic/genuine evidence conflation. General Finance allocation/source coverage and field-specific event restrictions still apply. No hosted state, production, permissions, publication or money actions occurred.
