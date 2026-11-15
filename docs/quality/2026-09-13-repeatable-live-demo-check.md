# Repeatable live demonstration release check

Date: 2026-09-13 (Pacific/Honolulu)

## Acceptance criteria

- A repository command operates the stable production demonstration at a true
  320-pixel phone width, a 640-pixel accessibility/zoom width, and a 1280-pixel
  desktop width.
- It covers score entry/review/submission, scorecard pending state, setup and
  import preview, player search, dynamic seating capacity and last-table review,
  cross-check/photo aid, flyer screens, finance, results/qualifiers, the
  satellite fail-closed boundary, and Rulebook quick search.
- It fails on incorrect critical state, disabled/missing controls, horizontal
  document overflow, CSP violations, HTTP failures, console errors, or page
  errors.
- It renders the seating assignment under print CSS, verifies both printed
  columns repeat their headings, and parses both that output and the sample
  qualification summary as non-empty PDF documents.
- It exercises only the synthetic public demonstration and does not mutate a
  live tournament.

## Implementation

- Added `scripts/check-live-demo.mjs` and `pnpm verify:live-demo`.
- Added `playwright-core` without downloading a bundled browser; the script
  locates installed Chrome/Chromium or uses
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
- Added a static regression contract confirming the required viewport,
  printable-artifact, failure-signal, interaction, and non-API-mutation
  boundaries.

## Evidence

- `node --test tests/live-demo-check.test.mjs`: 1/1 passed.
- `pnpm verify:live-demo`: passed against the stable production URL.
  - 320 px: 21 visits, 20 distinct screens, no overflow or browser failures.
  - 640 px: 21 visits, 20 distinct screens, no overflow or browser failures.
  - 1280 px: 21 visits, 20 distinct screens, no overflow or browser failures.
  - Seating print CSS produced a readable Letter-size PDF with two headed
    columns; the sample qualification summary returned and parsed as a
    non-empty PDF.
- `pnpm verify`: passed with 454/454 application tests, optional-provider
  preflight, production build, and workspace checks.
- `pnpm verify:handoff`: 6/6 passed.
- `git diff --check`: passed.

## Limitation

This repeatable check proves the synthetic public interface and its browser
failure signals. It does not replace the required independent authenticated
player/official, offline/reconnect, failed-device reconstruction, private-data
restore, or director physical rehearsals.
