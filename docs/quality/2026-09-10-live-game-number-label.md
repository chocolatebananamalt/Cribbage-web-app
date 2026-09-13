# Live game-number label correction — 2026-09-10

## Finding and correction

The scorecard uses `roundNumber` as its sequential game number. The live
entry/review screen instead displayed the internal `matchInstance` under the
word `Game`, which can be `1` for more than one tournament game. That would
misidentify the game a player is entering.

Both live views now label `roundNumber` as `Game N`, matching the scorecard.
The match instance remains in the protected data contract for scheduling and
does not masquerade as the player-facing game number.

## Acceptance evidence

- Regression coverage rejects `Game {context.matchInstance}` and requires
  `Game {context.roundNumber}` in the live entry source.
- `pnpm test` passed: 117 tests.
- `pnpm lint`, `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and
  `git diff --check` passed locally.

## Remaining limitation

This is a source and build check. Signed-in phone/desktop visual testing must
still verify the label with a multi-game live fixture.
