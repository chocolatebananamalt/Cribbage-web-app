# Roster freeze, hybrid scorecards, and preliminary qualification

**Decision date:** 2026-09-11

## Decision

- An approved setup activation opens registration on the initial `draft` to
  `open` transition. Registration closure freezes roster membership before
  check-in, seating, enrollment, and schedule publication.
- Exact accepted roster-operation retries remain readable after closure; new
  identities do not.
- A verified digital player's scorecard resolves a paper-only opponent from
  the tournament roster and uses the latest **applied** correction projection.
  Pending or rejected corrections do not alter scorecard lines or totals.
- Preliminary standings include roster-only participants and expose schedule
  and scorecard-completion evidence. Qualification remains a visibly
  provisional preview. It does not establish playoff winners, MRPs, Q-pool
  awards, payouts, or final publication authority.

## Why

The pilot must not create a player who cannot subsequently be checked in, must
not lose a verified hybrid game because one participant lacks an account, and
must not show different corrected totals on a scorecard and in standings.
Money and official award outputs stay closed until their current authoritative
inputs and end-to-end fixtures are complete.

## Implementation

- `0124_registration_roster_freeze.sql`
- `0125_hybrid_scorecard_reconstruction_repair.sql`
- `0126_paper_inclusive_qualification_preview.sql`

