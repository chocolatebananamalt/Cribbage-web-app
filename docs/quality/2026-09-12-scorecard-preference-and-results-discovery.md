# Scorecard preference and results discovery evidence

Date: 2026-09-12

## Acceptance

- Every tournament roster entry records an explicit `digital` or `paper`
  scorecard preference; account linkage never implies that preference.
- Public registration, director manual entry, CSV import, and pre-close
  director correction preserve the tournament-scoped preference and an
  append-only version history.
- Director read models expose the preference for roster review, check-in,
  seating, enrollment, and print consumers.
- Signed-in viewers, players, cross-checkers, directors, and co-directors can
  discover the tournament's result events, while settlement mutations remain
  restricted to directors and co-directors.

## Verification

- Focused roster/results/progression/API suite — PASS (82/82).
- `pnpm verify` — PASS (tests, audit, lint, production build, workspace and
  handoff-contract checks).
- `pnpm verify:handoff` — PASS (6/6).
- `git diff --check` — PASS.
- The rollback fixture covers an unauthorized preference correction,
  unauthorized results discovery, registration-closure rejection, exact and
  changed idempotency retries, and CSV preference persistence/replay/conflict.

## Limits

Migrations `0146` and `0147` were not applied to the hosted pilot from this
worktree. Their rollback fixtures therefore remain required in a controlled
test database before production promotion. Browser automation was unavailable
in this worker environment; the production build rendered all routes, but
authenticated phone/desktop and independent-session proof remains a release
verification step.

A later shared-worktree rerun after the foreign-capability and fixture additions
reached two concurrent `react-hooks/set-state-in-effect` lint errors in
`hybrid-game-client.tsx`; that file is outside this slice. The focused 0146/0147
suite, all 393 application tests, the production build, and `git diff --check`
pass with the final changes in this slice.
