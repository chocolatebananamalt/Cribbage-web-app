# Qualification preview boundary

**Date:** 2026-09-10
**Status:** Accepted for the server-authoritative results foundation; not an
event-finalization authorization.

## Decision

The app ranks qualifying candidates by these public ACC numeric fields, in
this exact order:

1. total game points;
2. games won;
3. net spread points;
4. positive spread points.

It calculates the qualifying field as `ceil(entrants / 4)`, then calculates
the next power-of-two bracket and gives first-round byes only to the highest
qualifiers. It never rounds the qualifier count up to a bracket size.

If the numeric fields are exactly tied, the result is a non-final preview. A
tie that crosses the cutoff is explicitly marked `cutoff_tie`; no stable input
order, player name, ID, or implementation detail may choose the official
qualifier. A director-approved resolution process and dated fixture remain
required before event finalization.

## Sources checked on 2026-09-10

- [ACC Play-off Brackets and Byes](https://www.cribbage.org/NewSite/rules/playoffbracket.asp)
  states one in four qualifies, fractions round up, and byes equal the next
  full bracket minus the qualifying count.
- [ACC Tournament Director's Manual, 2019](https://www.cribbage.org/NewSite/sched/Directors%20Manual%20-%202019.pdf)
  lists game points, games won, net spread points, then positive spread points
  as the qualifying-card tie-break sequence.
- [ACC Point Scoring System](https://cribbage.org/NewSite/about/scoring.asp)
  currently describes ranking by total game points with wins and point
  differential as tie-breakers and links current Main/Consolation schedules.

## Consequences

- The reusable preview is pure and has no database access, payout calculation,
  result publication, or ACC export ability.
- Event finalization remains blocked by reviewed standing fixtures, MRP/Q-pool
  schedules, reconciliation, and the unresolved-tie workflow.
