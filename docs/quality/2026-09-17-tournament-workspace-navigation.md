# Tournament workspace navigation verification

**Date:** 2026-09-17
**Scope:** provide every authorized tournament workspace with an in-app,
phone-friendly return to the signed-in tournament chooser and clear current
tournament context.

## Acceptance criteria

- The workspace has two **Back to Your Tournaments** links that use the
  authenticated chooser route (`/`) rather than browser history.
- The opened tournament name and a human-readable role appear before the
  workspace actions.
- The return controls are full-width, at least 52 pixels high, keyboard
  focusable, and preserve sign-in and local recovery data.
- Existing subpage **Back to Tournament** and **Previous Screen** paths remain
  unchanged.

## Local evidence

| Check | Result |
| --- | --- |
| Focused workspace/chooser regression test | Passed: 4/4 |
| TypeScript | Passed: `pnpm exec tsc --noEmit` |
| Lint | Passed: `pnpm lint` |
| Full release verification | Passed: `pnpm verify`, including audit, lint, 529/529 application tests, provider readiness, Production build, and workspace checks |
| Diff whitespace | Passed: `git diff --check` |

## Visual evidence and limitation

- Before this release, the signed-in Production workspace was observed to have
  neither a chooser-return action nor the tournament name; it showed only the
  internal `co_director` role token.
- A local production server started successfully, but its unauthenticated root
  returned the expected `operation_unavailable` response because the local
  shell does not carry the deployed Supabase connection values. The isolated
  browser check therefore confirms no local horizontal overflow or framework
  overlay, but cannot render an authenticated workspace locally.
- A signed-in Production phone and desktop check of the deployed change remains
  required after the reviewed release. It will verify both return links, the
  selected tournament name, role label, and no horizontal overflow.
