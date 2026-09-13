# Deterministic client timestamps — 2026-09-11

## Acceptance criteria

- Server-rendered client workspaces must render the same timestamp text before
  and after browser hydration, regardless of server or device time zone.
- Registration review, registration-link management, and roster-account
  activation must not use environment-local date formatting for initial data.

## Change

Added one deterministic UTC formatter and applied it to all three October
workflows. It emits `YYYY-MM-DD HH:MM UTC`, retains the original value when an
invalid string reaches the presentation boundary, and avoids locale/time-zone
differences during hydration.

## Verification

- Direct formatter and source-bound regression checks pass.
- The complete `pnpm verify` gate passes with 331/331 application tests,
  dependency audit, lint, production build, and workspace checks.
- Independent Sol high-risk re-review is GO with no P0/P1 findings; its focused
  checks confirm the locale-free formatter removes the identified divergence.
- The corrected registration review page was already verified in Production
  with no React console error; registration-link and account-activation browser
  checks follow after this consolidated release is deployed.
