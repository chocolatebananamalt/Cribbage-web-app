# Scorecard verification-status correction — 2026-09-10

## Finding

The protected player scorecard previously treated every non-final game state
as `Verification Pending Opponent Entry`. A schedule can contain future
`pending` games that have no player entry at all, so this could falsely claim
that settled totals were temporarily incorrect.

## Correction

`getScorecardVerificationStatus` now classifies state deliberately:

- `pending` only: `Current and Verified`; no total warning.
- `submitted`: `Verification Pending Opponent Entry` and the user-approved
  `Updated Total Calculations Pending Opponent Entry` notice.
- `confirmation_pending`: a precise player-confirmation notice.
- `mismatch`: a review-required notice.

The highest-risk state wins if more than one incomplete game exists. Verified
and corrected scoreline values still remain the only inputs to totals; this
change makes the disclosure accurate rather than changing any stored score,
authority, or rule.

## Acceptance evidence

- Unit tests cover all four states and the mismatch-over-pending precedence.
- Static route coverage confirms the protected page uses the shared status
  classifier rather than reintroducing a count-based pending decision.
- `pnpm test` passed: 117 tests.
- `pnpm lint`, `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and
  `git diff --check` passed locally.

## Remaining limitation

The semantic classification is locally tested. A real two-user browser test
must still exercise the displayed state after each score workflow transition.
