# October integration-plan release evidence

Date: 2026-09-13 (Pacific/Honolulu)

## Acceptance boundary

- October payment methods are cash and check only, configurable per tournament.
- Registration retains the intended method; finance retains owed, received,
  remaining, status, and optional check details. Only director-confirmed receipt
  evidence affects the ledger.
- Cash App Pay, Apple Pay, Google Pay, Venmo, and Venmo Tap to Pay are catalogued
  but disabled until provider setup and live evidence are complete.
- Private paper-card capture/storage, manual transcription, offline replay,
  failed-device recovery, and dynamic table capacity remain available. OCR is a
  non-authoritative, human-reviewed structured draft and remains default-off.

## Code and automated evidence

- `pnpm verify`: passed, including dependency audit, lint, 453/453 application
  tests, optional-provider preflight, production build, and workspace checks.
- `pnpm verify:handoff`: passed 6/6.
- `git diff --check`: passed.
- Independent review of the CSP repair: GO with no P0/P1/P2 findings.
- Pull request 16 preserved nonce-bound scripts and stylesheet elements while
  allowing only framework-required style attributes.
- Pull request 17 corrected the flyer-preview cascade so its desktop two-column
  grid collapses to one bounded column on narrow phones.

## Production evidence

- Final merge: `e9480b7521dc37871825731434b15aeca3c23d81`.
- Vercel deployment: `dpl_FyYMjjuoEJfE3x2mPwGJ2qnJnwHP`, `READY`, stable alias
  attached, no alias error.
- Live browser audit at 320×900 and 1280×900 operated 20 distinct screens:
  score entry, result review/submission, pending scorecard, Operations, setup,
  import preview, player search, seating, dynamic six-table/120-seat plan,
  last-table review, cross-check/photo aid, events/flyer screens, finance,
  results, event details, qualifiers, satellite boundary, Rulebook, and quick
  search.
- Both runs reported zero document overflow, CSP violations, failed HTTP
  responses, console errors, and page errors.
- Vercel runtime-error query for the final release window returned no clusters.

## Remaining human evidence

The implementation plan is released, but the pilot is not represented as fully
accepted until real people complete the documented independent player/official,
offline/reconnect, failed-device reconstruction, director, and private-record
backup/content-restore rehearsals. OCR and online payments remain optional and
do not block cash/check plus manual paper-card operation.
