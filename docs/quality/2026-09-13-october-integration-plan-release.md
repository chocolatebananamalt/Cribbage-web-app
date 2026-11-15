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

- `pnpm verify`: passed, including dependency audit, lint, 459/459 application
  tests, optional-provider preflight, production build, and workspace checks.
- `pnpm verify:handoff`: passed 6/6.
- `git diff --check`: passed.
- Independent review of the CSP repair: GO with no P0/P1/P2 findings.
- Pull requests 16 and 17 preserved the hardened browser policy and narrow-phone
  flyer layout. Pull request 28 completed the missing independent-official
  readback path for private paper-card images; pull requests 29–32 recorded the
  release evidence and protected current production guidance from regression.

## Production evidence

- Feature merge: `f6442851e3797658d168b657bee81e2e84d86804`.
- Verified feature deployment: `dpl_HCGNoHJwfdEVYwe75fgSLdxLRH8z`, `READY`,
  stable alias attached, no alias error.
- Live browser audit at 320×900 and 1280×900 operated 20 distinct screens:
  score entry, result review/submission, pending scorecard, Operations, setup,
  import preview, player search, seating, dynamic six-table/120-seat plan,
  last-table review, cross-check/photo aid, events/flyer screens, finance,
  results, event details, qualifiers, satellite boundary, Rulebook, and quick
  search.
- Both runs reported zero document overflow, CSP violations, failed HTTP
  responses, console errors, and page errors.
- The protected paper-card review-image route returns 401 anonymously. Its
  migration-0162 hosted lifecycle accepts a different eligible official,
  rejects uploader and outsider access, records an immutable access
  authorization, and leaves no fixture rows on either database.
- Vercel runtime-error query for the final release window returned no clusters.

## Remaining human evidence

The implementation plan is released, but the pilot is not represented as fully
accepted until real people complete the documented independent player/official,
two-device paper-photo upload/readback, offline/reconnect, failed-device
reconstruction, director, and private-record backup/content-restore rehearsals.
OCR and online payments remain optional and do not block cash/check plus manual
paper-card operation.
