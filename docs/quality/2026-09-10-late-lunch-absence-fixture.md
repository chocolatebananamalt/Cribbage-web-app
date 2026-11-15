# Rule 11.4 late-lunch absence fixture — 2026-09-10

## Acceptance criteria

- Preserve the exact five-minute grace period before any automatic result.
- After that grace period, model only the first post-lunch result: opponent
  2 game points/+10 spread and late player 0 game points/-10 spread.
- Preserve the late player's next-opponent-in-rotation direction.
- Never automatically issue a second 2/+10, disqualify a player, assign a
  substitute, floating sit-out, or general rotation result.

## Source

Cached *ACC Official Tournament Rules 2025*, Rule 11.4, page 47 (PDF page 48),
SHA-256 `DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`:
the director allows five minutes; the opponent receives a 10-spread win and
the late player a 10-spread loss; the late player resumes the next opponent in
rotation; after the second game starts the player may be disqualified and
replaced by a substitute or floating sit-out; only one 2/+10 is ever given.

## Implemented boundary

`src/lib/late-lunch-absence.ts` is a pure fixture. It keeps minutes zero
through five in the grace period and recommends the documented first-game
2/+10 and 0/-10 result only after that interval. It refers a repeated award or
second post-lunch game to a director rather than fabricating a disqualification
or seating decision.

## Verification

`tests/late-lunch-absence.test.mjs` covers the grace boundary, exact scores,
rotation continuation, repeated-award rejection, later-game review, and
invalid input rejection. Full project verification remains required before
merge/release.

## Remaining gate

No authorized attendance event, server mutation, audit entry, schedule update,
substitute selection, or real-session workflow is enabled by this fixture.
Those require the still-open `R-OPS-01` operational lifecycle and dated ACC
fixtures for general rotation and replacements.
