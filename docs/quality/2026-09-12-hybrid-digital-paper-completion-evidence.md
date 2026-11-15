# Hybrid digital-and-paper completion evidence

## Acceptance conditions

- Exactly one existing immutable digital-player submission and one explicit
  paper-scorecard participant are required.
- The first cross checker can create only a matching, non-authoritative case.
- A second distinct and independent official must re-enter/confirm both source
  records before two reciprocal authoritative scorelines exist.
- Mismatch, self-review, stale binding/preference/game, future game, concurrent
  completion paths, and changed retry fail closed.
- Exact lost-response retries and actor-scoped reconciliation survive removal
  from the live workspace.

## Local evidence

- `node --conditions=react-server --test tests/hybrid-digital-paper-completion.test.mjs tests/paper-game-completion.test.mjs tests/supabase-auth-semantics.test.mjs`: 57/57 passed after the final review repairs; the hybrid slice itself is 11/11. This includes a static global lock-order assertion across the 0144/0148 official flows and every roster-link/event-enrollment writer that reaches the shared identity trigger, plus a regression check that the game lookup does not rely on `FOUND` after an intervening advisory-lock call.
- Focused TypeScript and ESLint checks: passed.
- `pnpm verify`: passed, including 404/404 application tests and the
  Next.js 16.3.4 production build.
- `pnpm verify:handoff`: passed 6/6.
- `git diff --check`: passed (line-ending notices only).
- Fresh independent Sol review approved migration hashes `0144=479C7282…`
  and `0148=075C7627…` with no P0, P1, or P2 findings. The reviewer confirmed
  the canonical lock hierarchy, exact replay before lifecycle gating, and
  compatibility with every known identity-trigger caller.

## Limitations

Migration 0148 is intentionally not applied from this worktree. The
self-contained rollback-only SQL fixture now exercises unscheduled-game
rejection, pending authority, mutual exclusions, exact approval/rejection,
role revocation, stale rejection response binding, closed-tournament retry,
reconciliation, reciprocal scorelines, and grants. It could not be executed
locally because this worktree has neither the Supabase CLI nor a local database;
it must run after the controlled pilot apply. Two independent authenticated
browser sessions, phone/desktop rendering, and live lost-response refresh also
require that controlled backend.
