# Tournament setup input repair evidence

Date: 2026-09-13
Environment: Windows development worktree, Node 24, Chrome via
`playwright-core`; Vercel preview/Production evidence is appended during
release.

## Acceptance criteria

- Every draft tournament, event, date/time, fee, Q Pool, and note control is
  visibly full-size and editable at phone and desktop widths.
- Entered text, local date/time, and dollar strings remain present after focus
  moves away; money parsing retains the established exact-cent behavior.
- Fee-includes examples remain visible after a value is entered.
- Main, Consolation, Satellite, and up to two Main/Consolation Q Pools remain
  exposed by the existing buttons; activation continues to lock the original
  setup and later events continue through the append-only workflow.
- Shared-device sign-out retains the unsynchronized-score confirmation and
  explains the exact local browser state removed without claiming that hosted
  tournament records or unrelated device/browser data are deleted.
- No schema, hosted record, role, API, setup revision, event activation, or
  feature-gate change occurs.

## Executed checks

| Check | Result |
| --- | --- |
| `node --test tests/setup-workspace-ui.test.mjs` through the application runner | Pass; setup controls and guidance regression covered. |
| `node scripts/check-setup-input-layout.mjs` | Pass at 375px and 1280px: all inputs at least 150×44px, typed text/date/money values retained after blur/focus change, helper remained visible, and no horizontal overflow, console error, or page error occurred. The first run exposed the late mobile-grid override; the bottom media rule was corrected and the check passed on rerun. |
| `pnpm verify` | Pass: no production dependency vulnerability, lint pass, 465/465 application tests, provider fallback preflight, Next.js 16.3.4 Production build, and 7/7 workspace checks. |
| `pnpm verify:handoff` | Pass: 6/6 private handoff checks. |
| `git diff --check` | Pass; line-ending conversion notices only. |

## Scope review

The diff is presentation/guidance-only plus tests and documentation. Existing
controlled inputs, exact-cent parser, draft-save recovery, activation state,
append-event path, offline queue deletion warning, and server sign-out route
are unchanged. `tmp/` and `tsconfig.tsbuildinfo` remain untracked owner files
and are excluded from the release.

## Release evidence

Pending preview and Production deployment verification.
