# Preview browser smoke evidence — 2026-09-09

## Scope

This is narrow browser evidence for the public review prototype and its
protected current-branch Preview boundary. It is not authenticated game,
database, offline, or multi-user verification.

## Observed prototype behavior

Using the existing public review preview in Chrome, the score-entry screen
initially showed no selected winner and a disabled **Review Result** button.
Selecting Barb Stevens and entering `99` through the large keypad produced:

- `Barb Stevens won by 99`, `3` game points, and `+99` spread points;
- reciprocal `Steve Hall lost by 99`, `0` game points, and `-99` spread
  points;
- the three-skunk indicator; and
- an enabled **Review Result** control.

The review screen then displayed the same Game 3/Table A seat context and the
same reciprocal result before the separate **Submit My Entry** control. No
submission was pressed and no player, financial, or production data was sent.

## Current branch boundary

Vercel reports deployment `dpl_3J8SjUFwH3EQzkWyHBLfnd6BfzkP` for commit
`570b66b` as `READY`, using the explicit Next.js framework. Opening its
current branch alias without a Vercel session reached the Vercel login page,
which confirms Preview protection is active. No login was attempted.

## Limit

This does not prove the score-retry repair in a browser because the protected
authenticated game route needs a real synthetic player session and a
controlled lost-response/session-expiry scenario. Phone-size, zoom,
screen-reader, two-user, persisted-database, and offline evidence remain
open production gates.
