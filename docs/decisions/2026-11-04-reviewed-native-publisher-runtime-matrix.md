# Native reviewed-draw publisher: runtime proof still required

The one previously approved candidate fixture was completed and removed. This document does NOT authorize another fixture. New code is an UNEXECUTED owner-only proposal with a hard-disabled app boundary, no public wrapper/grant/route. No fixture was created during this implementation.

## Implemented local source

- database/proposals/reviewed-draw-native-publication-v1.sql: immutable private bridge history, exact native binding reader, deterministic full108-match A18 validator, owner-only transaction core and exact owned readback.
- src/lib/seating/reviewed-draw-publication-result.ts: strict accepted/rejected/busy result and full-envelope readback codec, hardfalse enable function. It does not perform a request, persist/clear storage or authorize a publication.
- Existing pure preflight now shares exact canonical A18 pair-order restriction. Fixed IDs, draw object and publishable:false/physicalReviewRequired:true remain unchanged.

The core derives actor from auth.uid and requires authenticated claims and READ COMMITTED. Try native actor/op advisory lock, tournament UPDATE NOWAIT, defensive actor-profile KEY SHARE NOWAIT, role SHARE NOWAIT, exact historical replay, then ALL roster rows ordered UPDATE NOWAIT. No blocking lock upgrade or global table lock. Capture full source binding once; verify current latest plan, latest entropy-consuming outcome (including later failed/exhausted draws), complete stored candidate and current active activated Standard Singles/Standard12 Main. The last check is independent because old draw binding omits operational_state. Canonical A18 is required and all108 matches rederived from stored starting IDs using the literal verified single-anchor physical map.

Call unchanged native publish_initial_seating_v2 once with server-derived assignments and same actor/op; require its actual exact receipt, publication and18 stored assignments/verification IDs. Insert bridge binding in the same exception subtransaction. Any postcondition failure rolls back native IDs/receipt/audit and bridge. Busy returns retry_exact after rollback; unknown/unbound outcomes preserve retained work. Exact replay/readback requires current role and immutable native binding; historical accepted receipt is allowed after later source drift, without redraw.

No public execute grants exist for the new private routines/table. An actual authenticated wrapper is not implemented or enabled. No native/scoring/history functions are replaced. Full108 validation is a deterministic projection, not entropy consumption, resampling or reassignment. The physical guide remains bounded to one opposed odd/even A18 table with fixedA1; this does not certify a venue or general multi-anchor layout.

## Source-lock inventory

Reviewed source families all have tournament FK coordination: roster0036; check-in0047; links0048; preference events0146; lifecycle0205; setup revisions0051; activations0108; plans/draws03eb proposal. Roster UPDATE NOWAIT additionally covers mutable preference projection0149 and child KEY SHARE. Current0194 event retirement/replacement obtains tournament UPDATE. READ COMMITTED is mandatory: an older repeatable-read snapshot can miss an append committed before locks without a changed parent tuple. Native receipt/profile/assignment FKs and every lock interaction still need real database proof; source tracing is not execution.

Known reverse orders:0204 tournament then native nonce;0205 roster then tournament FK. Try nonce/NOWAIT on tournament and roster avoids intentionally waiting while holding the opposite lock. Defensive actor-profile prelock covers potential native FK contention; it is not a reproduced app profile-deletion bug. The250ms lock timeout is additional bounded protection, not proof of freedom from every nested native lock wait.

## Exact required matrix (not executed)

| Scenario | Required observable result |
|---|---|
| Same actor/op/exact full request in two sessions | At most one native publication/18 IDs/bridge; contender may return busy, exact later retry yields same receipt; no extra entropy. |
| Same actor/op, changed review/candidate | Conflict, no reuse/adoption; retained changed bytes never cleared by older ACK. |
| Different operations/directors on same draw | One publication only; loser busy or fixed-ID rejection, no second numbering. |
|0204 nonce/tournament reversed-order contention | No bridge wait-cycle; bounded busy rollback, no unrelated receipt adoption. |
|0205 roster-first lifecycle; preference/link/check-in appends | Correct NOWAIT rejection or stable postlock source; no stale roster admitted. |
| Intake/new roster/setup revision/activation while locking | FK/writer protocol prevents phantom acceptance; no mixed source snapshot. |
| Concurrent new plan/draw/failed entropy outcome | Only exact latest accepted draw publishable; earlier selected candidate rejected, never redrawn automatically. |
| Retire/replace Main without changing old draw hash | Bridge rejects current inactive/unactivated/nonstandard event. |
| Current role revocation / wrong actor / native ACL | No private replay or publication after revocation; owner core remains non-executable by ordinary authenticated/service/anon roles. Future wrapper must be separately proved. |
| READ COMMITTED versus RR/serializable | Only supported isolation admitted; old snapshots blocked before native writes/readback. |
| Native manual publication/old receipt exists | No adoption as reviewed-random provenance; exact new operation denied or busy. |
| Forced native response/receipt/publication/assignment mismatch | Entire native write/audit/bridge rollback; no partial IDs, retained request preserved. |
| Forced bridge insert/FK error | Native IDs/receipt/audit rollback in same transaction; transport reports unknown, never success. |
| Commit then response loss/readback | Same actor/full request returns same accepted binding; source drift alone does not erase history; role loss denies. |
| Late ACK with changed/newer retained bytes | Whole-request codec + exact storage comparison prevents cleanup. |
| Malformed/null/extra fields, reordered pair config, late-round corruption | Reject/no native write, no silent repair or renumbering. |
| Unrelated fixture tables and payout/score history | Full before/after fingerprints unchanged except expressly expected local bridge/native/audit rows. |
| Cleanup | Exact disposable resource identity and removal independently verified. |

Require actual PostgreSQL parse/apply, correct owner/RLS/ACL, constraints/FKs, two sessions, query/lock-state observations and forced rollback table deltas. Prior candidate tests do not cover this new core. Genuine provider/API/browser/physical-human acceptance remains later and distinct. No claim of complete runtime or hosted readiness.

## Subsequent approved runtime checkpoint

The owner later approved one additional disposable localDB. Ten main stages and five bounded source cases passed with cleanup; alias fix applied in SAMEfixture. See docs/quality/2026-11-04-reviewed-native-publisher-runtime-local.md for exact executed cases, residual limits and source hash. Earlier unexecuted statements describe the prior checkpoint. Private core remains owner-only; no authenticated transport, public wrapper/grant or UI enablement.
