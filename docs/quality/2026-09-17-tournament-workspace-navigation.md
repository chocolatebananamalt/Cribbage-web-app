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
- The reviewed change was merged through pull request #75 as Production commit
  `667bcbf5461b0fa5ea92343b378b69c7ea945e0d`. GitHub Verify passed; Vercel
  reported the Production deployment successful.
- In a signed-in external Chrome session, the Production **Pilot Tournament**
  workspace showed its name, **Co-director** role, and both return controls.
  Keyboard activation of each control returned to **Your tournaments**.
- In the same signed-in session, **Genesis Rehearsal** showed its saved name,
  **Director** role, the top control, and the lower control. The chooser still
  listed only the account's authorized October 3 Pilot Tournament, Genesis
  Rehearsal, and Pilot Tournament cards.
- HTTP smoke probes returned `200` for the stable root and `307` to sign-in
  for an anonymous protected workspace, as expected.
- The signed-in external-browser desktop check is complete. A separate
  physical phone-width review remains a rehearsal usability observation; the
  controls themselves use the tested full-width, 52-pixel CSS contract.
