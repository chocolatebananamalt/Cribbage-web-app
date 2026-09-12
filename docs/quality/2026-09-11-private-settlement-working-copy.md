# Private settlement working-copy verification

**Date:** 2026-09-11  
**Environment:** local worktree; no hosted mutation or deployment

## Acceptance criteria

- Only a verified director/co-director with access to the existing private
  settlement reader can download the file.
- No file is generated without an immutable saved draft bound to the exact
  locked qualification-result version.
- Playoff placement claims and qualifying-round ranks are separate, with the
  High Non-Qualifier immediately after the qualifier list.
- The CSV exposes its unreconciled state and blocker codes, neutralizes
  spreadsheet-formula text, and cannot be mistaken for an ACC submission.
- It performs no MRP, Q-pool payout, reconciliation, publication, or official
  export calculation.

## Checks

- `node --test tests/settlement-working-copy.test.mjs tests/settlement-draft.test.mjs`
  — pass, 7/7.
- Focused ESLint over the generator, route, client link, and regression test —
  pass.
- `pnpm verify` — pass: dependency audit, lint, 331/331 application tests,
  production build, 6/6 workspace checks, and 6/6 embedded private-handoff
  checks.
- `pnpm verify:handoff` — pass, 6/6.
- `git diff --check` — pass (line-ending notices only).
- Independent Sol high-risk re-review — GO with no P0/P1 findings; its 56
  focused generator/draft/date/claim/activation/auth checks, focused lint,
  TypeScript, and diff validation pass.
- The route compiled and appears in the production route manifest;
  authenticated desktop/phone rendering and a real CSV download remain
  explicit release-owner checks after deployment.

## Limitations

- This is a private review aid, not `acc-results-v1` and not a portal import.
- It deliberately repeats the immutable draft's unresolved blockers. Those
  blockers still prevent reconciliation, publication, and official export.
- Hosted role/session download proof and desktop/phone rendering remain for
  the release owner after integration and deployment.
