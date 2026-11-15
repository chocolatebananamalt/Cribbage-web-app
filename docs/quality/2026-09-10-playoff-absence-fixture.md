# Rule 13.1 playoff-absence fixture — 2026-09-10

## Acceptance criteria

- Keep the full five-minute grace period before the first game forfeit.
- Calculate the initial forfeit and one additional forfeit each fifteen minutes.
- Never exceed the configured match-game count or duplicate a recorded forfeit.
- Preserve the rule that a nonappearing qualifier remains entitled to the
  round-loser prize money and MRPs.

## Source

Cached *ACC Official Tournament Rules 2025*, Rule 13.1, page 50 (PDF page 51),
SHA-256 `DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`.
It says a scheduled playoff qualifier has five minutes before the first game
is forfeited, with additional forfeitures every fifteen minutes until the
match completes or the qualifier appears. It expressly preserves round-loser
prize-money and MRP entitlement for a nonappearing qualifier.

## Implemented boundary

`src/lib/playoff-absence.ts` is a pure timing and count fixture. It requires a
separately authoritative match length and the count already recorded, caps the
due result at that match length, and reports only the additional forfeits that
could need a decision. It exposes no automatic bracket, money, MRP, role, or
database authority.

## Verification

`tests/playoff-absence.test.mjs` covers the grace boundary, 15-minute
increments, idempotent recorded counts, match cap, entitlement preservation,
and malformed-input rejection. Full project verification remains required
before merge/release.

## Remaining gate

An authorized, auditable playoff-bracket workflow must still bind real start
times, appearances, opponent, match format, standings, prize/MRP tables, and
results export before this can become an operational action.
