# Graduated pool calculator evidence

Date: 2026-09-11

## Scope and source

The protected finance workspace now provides a non-persistent graduated pool
estimate. The implementation was checked against the live ACC MRP Program Side
Pool Calculator and its Help page on 2026-09-11. The ACC page states that the
wizard rounds awards to the nearest $5, may leave a difference from the prize
fund, requires manual adjustment, and does not save the results.

## Observable acceptance criteria

- Winner count is the player count divided by the one-in-X ratio, rounded up.
- The suggested graduated awards match the live ACC calculator algorithm and
  its nearest-$5 rounding for observed examples.
- Any difference between prize fund and suggested awards is shown explicitly;
  the app never silently calls the estimate approved, official, or saved.
- Impossible counts, ratios, fees, fractional people, and over-precise money do
  not produce an estimate.
- The calculator is usable without changing any tournament, player, result, or
  financial ledger record.

## Evidence

- Live ACC example: 20 players, one-in-6, $10 fee produced
  $80/$60/$40/$20.
- Live ACC example: 25 players, one-in-4, $10 fee produced
  $60/$55/$45/$35/$25/$20/$10.
- Focused Node tests cover both observed examples, the minimum-entry-fee branch,
  rounding differences, invalid inputs, and the non-persistence wording.
- Independent high-risk review found no P0/P1 defects, matched the implementation
  to the live ACC algorithm branch-for-branch, and passed 358,800 arithmetic
  property cases.
- `pnpm verify` passed the dependency audit, lint, 303 application tests, the
  production build, and six workspace checks. `pnpm verify:handoff` passed 6/6.
- Production deployment `dpl_ADW6mV8QjXouobbhSA4eexsbufmc` serves commit
  `83f03c5` at `https://cribbage-web-app.vercel.app`.
- Live HTTP checks returned 200 for `/`, `/demo`, and `/offline-score-sw.js`.
  External Chrome rendered the protected finance workspace with the expected
  $200 fund and $80/$60/$40/$20 suggestion. Desktop and 375x812 public-demo
  checks showed no document overflow or clipped navigation. Vercel reported no
  runtime errors in the release window.

## Boundary

This closes the calculator convenience gap, not the persistent payout ledger.
Director-approved participant awards, Q-pool selections, MRP attribution,
playoff placements, and full financial reconciliation remain separate release
work. No ACC password or private member information was stored or copied.
