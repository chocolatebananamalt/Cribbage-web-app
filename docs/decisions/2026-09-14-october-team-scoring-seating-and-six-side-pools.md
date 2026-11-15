# October team scoring, seating directory, and six Side Pools

**Date:** 2026-09-14  
**Status:** Approved release requirement; implementation and verification in progress  
**Supersedes:** the 2026-09-11 pilot-minimum decision's Standard-Singles-only and paper-team boundary, and the 2026-09-14 four-customary-Side-Pools limit.

## Decision

The October standard includes two-person Traditional Doubles and Canadian
Doubles. A captain creates the team and selects one shared scorecard mode,
Digital or Paper. Both players remain individual roster identities with their
own full name, ACC number, account, payment contribution, and personal
preference. The displayed team name contains both full names. The captain is
the default designated scorer; the scorer may be changed before play. A
Digital team scorer must have a linked account. Missing linkage is a director
resolution flag, never an automatic conversion to Paper. Generic/custom team
formats remain paper-only until separately defined.

Digital team games are team-entry records that preserve both teams, all four
members, team Verification IDs, current Table/Seat snapshots, winner, spread,
derived 0/2/3 game points, reciprocal scorecard lines, audit/version history,
and the authenticated idempotent offline queue. Each team submits once through
its designated scorer; the opposing team independently confirms. Winner and
spread must match, confirmations must be distinct, and the creator cannot
confirm their own submission. Mixed and paper games use the existing
independent-official cross-check principles adapted to one shared card/team.

Every singles player and team receives a published event-scoped starting
Table/Seat and permanent Verification ID. All signed-in participants,
including paper users, can view their own assignment and current-game
assignment. After publication, a signed-in participant in the selected
tournament can search a seating directory by partial name or exact normalized
ACC number. Results expose only name, applicable team name, scorecard type, and
Table/Seat; director filters add paper/digital, singles/team, and Table/Seat.

Each event supports up to six active Side Pools. Directors configure unique
normalized names and arbitrary entry fees; $10/$20/$50/$100 remain quick-add
presets only, and equal fees are permitted when names differ. Existing
elections, collections, corrections/voids, payout policy, cross-checked
placements, cent reconciliation, finance/results, CSV, PDF, and audit behavior
apply to all six pools and remain separate from the two Q Pools. A seventh pool
is rejected. Add a dedicated event report and combined tournament report.

## Release gate

Completed team scoring and six-pool behavior are blockers for the September 18
release gate. This decision records scope and interfaces; it does not claim
that implementation, deployment, or physical independent-session verification
is complete.
