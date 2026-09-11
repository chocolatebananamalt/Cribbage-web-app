# Rule 12.2(b) correction lifecycle evidence

Date: 2026-09-10
Commit inspected before the change: `98deb422feee601d65db4fafd96eb64dd3af3581`
Environment: Windows, Node `v24.19.0`, pnpm `11.19.0`, Next.js `16.3.4`, disposable Supabase PostgreSQL `17.6.1.063`

## Observable acceptance criteria

- Only a server-side call naming a current cross checker may create the dated
  Rule 12.2(b) 17-point-win/16-point-loss disposition for another player's
  verified digital Standard Singles game.
- The correction retains both supplied original card claims and derives the
  respective 16-point win and 17-point loss without rewriting the reciprocal
  canonical scorelines.
- The latest versioned tournament policy determines whether the correction is
  immediately authoritative or remains pending for one independent review,
  and whether a reason is required. A supplied reason is optional by default,
  trimmed, capped at 500 characters, and retained.
- Every accepted create/review operation has an immutable receipt, audit event,
  actor, timestamp, policy snapshot, and sequenced state history. Exact retry
  returns the prior receipt; changed reuse records an immutable conflict.
- The server-only reader returns the exact two original/adjudicated projections
  only to a current director, co-director, or cross checker who is not a player
  in that game.

## Observable rejection criteria

- Reject browser-role execution, missing or malformed input, a non-12.2(b)
  claim shape, a qualification-changing correction while notification is
  unavailable, a non-cross-checker editor, editing one's own game, stale game
  or correction versions, legacy/incomplete/pending correction history,
  ineligible event/ruleset, non-draft publication, closed tournament, missing
  required reason, non-independent reviewer, altered policy snapshot, or stale
  review source.
- An unexpected database response, malformed projection arithmetic, uncrossed
  12.2(b) projection, or policy/status mismatch fails closed in the server
  adapter.
- The old authenticated correction and correction-policy functions stay
  revoked and the application correction release switch stays hard-disabled.

## Checks and results

| Check | Result | Evidence |
| --- | --- | --- |
| Focused contracts | PASS | `node --conditions=react-server --experimental-strip-types --test tests/rule12-correction-lifecycle.test.mjs tests/rule12-discrepancy.test.mjs`; 15/15 passed. |
| Disposable migration | PASS | Migration 0106 applied successfully to the isolated synthetic Supabase project before its later reviewed shared-pilot application. |
| Rollback-only database lifecycle | PASS | `tests/rule12b-correction-lifecycle.sql` forced all deferred constraints and returned `rule12b_correction_lifecycle_passed`: 3 corrections, 6 state events, and 1 changed-retry conflict. It exercised default immediate authority, optional reason, review-required/required-reason policy, approval and rejection lifecycles, editor/player self-review denials, qualification-change denial, exact create/review replay, authorized/participant reads, audit retention, and unchanged canonical scorelines. Postflight found 0 fixture users and 0 fixture corrections. |
| Supabase security advisor | PASS for this slice | No 0106 function appears in the authenticated-security-definer warning. The three new tables appear only in the expected informational `RLS enabled, no policy` list because they are intentionally force-RLS deny-all tables accessed through service-only functions. The project-wide leaked-password warning and 22 older authenticated functions predate and are outside this slice. [Supabase database linter reference](https://supabase.com/docs/guides/database/database-linter) |
| Supabase performance advisor | PASS for this slice | The initial run identified two correction-foundation composite foreign keys. Migration 0106 now adds both covering indexes; the rerun removed those two unindexed-FK findings (31 to 29). New indexes are reported unused because the database is synthetic and empty after rollback. [Supabase unindexed-FK guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| Full repository verification | PASS | `pnpm verify`: production audit reported no known vulnerabilities; lint passed; 214/214 application tests passed; production build passed; handoff and workspace safety checks passed. |
| Private handoff verification | PASS | `pnpm verify:handoff`; 6/6 passed. |
| Patch whitespace | PASS | `git diff --check`; no whitespace errors (Git emitted line-ending notices only). |

## Data and release impact

- No credentials, private player data, payments, ACC portal data, or private
  handoff source was used. Test addresses use the reserved `.invalid` domain.
- Migration 0106 is applied to the shared pilot but remains undeployed and
  disabled at the application boundary.
- Create and review lock the canonical game, tournament, event publication, and
  current exact role in a consistent order. Accepted and rejected exact retries
  remain deterministic after the tournament or publication state changes, but
  still require the actor's current role.
- No application route or browser grant was added, no standing or result was
  updated, and no correction feature switch was enabled.

## Remaining release evidence and external dependencies

- Independent high-risk review completed with no remaining P0/P1, and the
  owner-approved ordered shared-pilot application plus grant checks passed.
- Real protected sessions for two players, an independent cross checker, and an
  independent director/co-director reviewer are still required before release.
- Rule 12.2(a), (c)-(i), correction-aware standings/totals/results/export,
  qualification-change notification, result supersession, and finalization
  integration remain separate source-backed blockers. This slice must not be
  treated as Rule 12 completion.
