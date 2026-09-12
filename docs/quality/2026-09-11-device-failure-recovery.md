# Failed-device recovery evidence

Date: 2026-09-11
Scope: `R-OFFLINE-01`, `R-VERIFY-01`, failed-device recovery portion
Environment: local Windows worktree and shared Supabase pilot

## Observable acceptance criteria

- A non-self cross checker can preserve one to four opponent-device or paper-card evidence claims for an unresolved Standard Singles game.
- Matching evidence creates an immutable `pending_review` case; conflicting evidence creates an immutable `disputed` case and cannot be approved.
- Only a different non-self cross checker, director, or co-director can approve or reject a case.
- Approval creates two reciprocal recovery projections and preserves the actors, evidence, receipts, timestamps, and before/after scorecard totals.
- Recovery never creates a player submission or confirmation and never changes the canonical game state.
- Only an approved projection appears once in the player scorecard, preliminary standings, and completed My Games list. Pending, disputed, rejected, and stale cases do not affect totals.
- Ordinary score submissions, confirmations, and canonical scoreline insertion are rejected after recovery approval.
- Mutation endpoints require same-origin POST, a verified session, bounded exact input, server-only database execution, and database role/self checks.

## Executed checks

| Check | Result |
|---|---|
| `node --test tests/device-failure-recovery.test.mjs` | Pass, 5/5 |
| `node --test tests/device-failure-recovery.test.mjs tests/my-games-navigation.test.mjs` | Pass, 8/8 |
| `pnpm exec tsc --noEmit` | Pass |
| Focused ESLint over recovery API, page, client, and adapters | Pass |
| `git diff --check` over recovery files | Pass |
| Hosted `tests/device-failure-recovery.sql` rollback fixture | Pass after migration 0129; no synthetic data retained |
| Supabase performance advisor | Pass for this slice; migration 0132 removed all 29 recent unindexed-foreign-key notices |
| Independent Sol review | Pass; no remaining P0/P1 finding after unresolved-participant and retry-persistence repairs |
| `pnpm verify` | Pass: audit, lint, 298/298 application tests, production build, and workspace checks |
| `pnpm verify:handoff` | Pass, 6/6 |

## Remaining required proof

- Exercise proposal and approval with two independent real sessions, then
  verify scorecard, standings, and My Games in desktop and phone browser sizes.
- Run the complete physical recovery drill using a deliberately unavailable
  scoring device and surviving opponent/paper evidence.

Until those independent-session and physical checks pass, this slice is
implemented and hosted but not pilot-certified.
