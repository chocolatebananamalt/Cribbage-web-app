# Random seating and voluntary anchors: recovered design and bounded local planner

## Owner intent
Eighteen-player mock: six real Digital people, twelve fictional Paper people,12qualifying games, no sit-outs or repeat opponents. Draw actual random seats after registration closes; do not engineer positions to force the six real people to meet. Friendly missed pairings are outside the tournament. The fixed Tournament ID is the starting table/seat and persists through movement. Current physical seat is a separate value.

Recovered v1.1 source lines21-22,33,38-39,279-284 requires volunteer stationary/anchor requests, director-configured per-table layout/capacity, odd seats on one side and even seats opposite, approved anchors and verified family restrictions, and surfaced conflicts before release. Exact movement formula was Needs confirmation. Source: docs/product/source-documents/ACC_Digital_Tournament_System_Specification_v1.1_EXTRACTED_TEXT.txt. Do not infer family restrictions from surnames or invent their duration/meaning; use only verified recorded constraints.

## Small coherent next slice
1. Director enters each table's physical seat layout/capacity, not one uniform capacity for the entire room. Show usable paired seats and unused capacity explicitly. Check capacity against the closed checked-in roster. No automatic reassignment of existing permanent IDs.
2. Show requested stationary seats privately to officials; director approves suitable anchors and sees unresolved requests/conflicts. A request is not silently discarded. A requested stationary preference is distinct from an anchor slot required by the selected movement plan. If the plan needs an anchor and there are no volunteers, surface that assignment decision for the director rather than silently rejecting the roster, silently assigning an unwilling player or inventing a universal volunteer-only ACC rule. No medical reason needs to be collected.
3. Choose a versioned movement plan independently of who occupies the slots. Candidate18-player circle plan already proves12rounds,108unique pairs,12distinct opponents each, no byes, one fixed logical anchor. It is not yet proof of the physical rightward/odd-even/cross-end room movement or universal ACC certification.
4. Generate an unbiased draw with server cryptographic randomness over the feasible, approved assignments. Persist the exact roster/version, table geometry, constraint versions, algorithm/version, actual draw outcome and an audit record. Browser animation or roster-order autofill must not substitute for the draw. Repeated preview must not quietly redraw favorable opponents. A deliberate redraw before publication needs its own recorded reason and invalidates the previous preview.
5. Before publication, independently validate every game's distinct participants, current room slots, one game/person/round,12games each, unordered opponent uniqueness, initial TournamentID=firstgameSeat, anchor immobility and all approved constraints. On impossibility, explain the constraint conflict and stop; never relax constraints silently or fall back to roster order.
6. After explicit publication, use the existing supported seat/schedule writers with expected versions, exact replay and audit. Distribute each player's own seat through authenticated My Games; no new access link or credential follows from drawing. Post-start correction is the separate audited revision policy; do not relabel historical Tournament IDs.

## Authoritative limits
Current Grass Roots Manual v8.1(Aug2026), sectionX printed8-9, describes traditional even fields with an odd number of anchors (one simplest) and odd fields with an even number including zero. Source: https://www.cribbage.org/grassroots/docs/General_GR_Docs/Manual/GR_Manual_Ver_8.1_FINAL_08102026.pdf, printed8-9. This is Grass Roots guidance, not a blanket certification of all national tournament layouts. The recovered specification still leaves exact room movement confirmation open. A general multi-anchor room solver and an exact transparent constrained-draw distribution need separate reviewed implementation; none is claimed here.

## Tests required before release
Use varying table capacities (including one18-seat physical table and multiple tables totaling18), insufficient/odd unused capacity, zero/one/multiple requested anchors, approved/impossible constraints, stable reproducible recorded outcomes, no accidental redraw on refresh, closure/currentness/version races, unauthorized/public leakage, exact retries and rollback. Check every pair and stationary slot across all12rounds. Run multiple random draws without constraining human positions; compare against an independent schedule oracle. Actual room walkthrough and director review remain necessary before promising rightward movement instructions.

No schema proposal, hosted draw, fixture enrollment, publication or user-form modification is included in this design document. Current manual seating/import and roster-order autofill are not the finished random seating feature.


Independent review found no P1/P2 in this bounded design. It is a grounded implementation plan, not a working random draw or physical seating acceptance.


## November4 local implementation boundary
A separate anonymous loopback planner implements physical chair/pair controls, requested-preference decisions, server-crypto random logical candidates and protected local replay. It is default-off, has no live roster/DB/publication connection, and always returns publishable:false. See docs/quality/2026-11-04-local-random-seating-planner.md. The native draw, audited durable geometry/constraints and verified physical walking instructions remain unfinished. Existing family restrictions and Tournament IDs are untouched; anonymous avoidance is only an explicit planning assumption, not a new official family rule.


## Later November4 single-table display proof
The published GR8.1Figures1/2nowvisuallychecked; exactone-table18/Seat1anchor rightward extension is independently validated for allsavedcandidate transitions and displayedlocally. See one-table-movement-local quality report. This narrows the previous movement gap only for this case; it is not generalmulti-anchor/multi-table/physical-room certification. Source generator and SQL unchanged; no IDs rewritten or publication. Unsupported actual movement blocksdisplay ratherthanreordering candidates.
