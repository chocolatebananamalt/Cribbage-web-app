# Preliminary event standings reader

## Acceptance criteria

- Every signed-in tournament role may read preliminary standings for an
  approved digital Standard Singles event in that tournament.
- Only scorelines whose canonical game is `verified` or `corrected` contribute,
  with the latest applied independent-card correction projected per card.
- Ordering uses game points, games won, net spread, then plus points. Exact
  numeric ties remain marked as ties rather than receiving a fabricated result.
- The page cannot claim qualification, eligibility, MRP, Q-pool, payout, or
  final-result authority.
- Anonymous and cross-tournament reads are denied at the database boundary.

## Implementation

Migration 0107 adds one stable read-only RPC over private tables. It requires a
current tournament role and an approved Standard Singles ruleset. The server
adapter validates every returned field and exact tournament/event scope. The
protected results page labels the output preliminary and links from the current
player scorecard.

## Non-goals and remaining proof

This slice does not calculate qualifiers, finalize results, make payouts,
create PDFs, or apply unconfirmed ACC rules. It is not applied to the shared
pilot until the complete new migration range has passed source, database, and
deployment review. Real multi-session browser and database denial evidence
remain required before the workstream can be closed.

## Disposable-database verification — 2026-09-10

- Environment: synthetic Supabase project `donfxulkliuyteiannir`; no shared-pilot mutation.
- The first migration attempt failed closed and exposed a malformed aggregate
  subquery. The source was corrected before any migration was recorded.
- Migration 0107 then applied successfully.
- After independent review found that the first reader ignored applied Rule
  12.2(b) projections, the reader was repaired before shared-pilot use. The
  final fixture forces deferred game invariants against two matching player
  submissions and two confirmations for each verified game. It then proves an
  applied 20/19 card discrepancy contributes adjudicated 19/20 card values,
  while pending and rejected corrections leave the canonical totals in place.
- `tests/preliminary-event-standings.sql` passed inside a transaction that
  rolled back all synthetic accounts and tournament records. It also proves
  competition ranking for an exact two-player tie with a skipped following
  rank, denies an authenticated outsider, and checks function grants.
- A deliberately position-based fixture assertion initially failed because
  the valid standings order placed the losing card after the unplayed card.
  The fixture now selects participants by stable ID, so it tests the intended
  scoring scope without assuming an incorrect row position.
- The server response validator now rejects extra fields, inconsistent totals,
  impossible game-points/win counts, duplicate participants, false ordering,
  false ranks, and false tie flags. Focused validator tests pass 3/3.
- The complete integrated verification suite remains required before the
  shared pilot receives migration 0107.
