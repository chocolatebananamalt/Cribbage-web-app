# Cross-checker assignment release evidence

Date: 2026-09-12 (Pacific/Honolulu)

## Scope

This slice closes the missing director workflow for assigning an already-linked
tournament account as an independent cross-checker. It does not create fake
October users, revoke roles, or broaden general role administration.

## Acceptance and implementation evidence

- Protected page: `/tournament/[tournamentId]/cross-checkers`.
- Protected same-origin mutation: `/api/v1/tournaments/[id]/cross-checkers`.
- Database migration: `0161_cross_checker_assignment`.
- The workspace is limited to current director/co-director actors and same-
  tournament linked roster candidates.
- Self, unlinked, foreign-tournament, already-assigned, director, co-director,
  judge, and cross-checker targets are excluded or rejected.
- Accepted assignment, exact replay, changed-request conflict, and current-
  authority business rejections are receipt/audit bound.
- Duplicate display names receive an ACC-or-masked-email hint and a full unique
  roster UUID. Full contact data is not returned.

## Automated checks

- Focused Node contract tests: 4/4 passed after the full-reference repair.
- TypeScript no-emit check: passed.
- Full repository gate: `pnpm verify` passed with 450/450 application tests,
  provider preflight, production build, and workspace checks.
- Private handoff gate: `pnpm verify:handoff` passed 6/6.
- Independent high-risk review: GO, no P0/P1 blockers. Its one P2 short-reference
  observation was repaired before pilot migration.

## Hosted database checks

- Disposable project: migration plus repair applied; final rollback-only SQL
  fixture passed after the full unique-reference repair.
- Approved pilot: migration `0161_cross_checker_assignment` applied; identical
  rollback-only SQL fixture passed.
- Pilot grants: both new RPCs are denied to `anon` and `authenticated` and
  executable by `service_role` only.
- Pilot advisor: no new function-execution warning. The new private history
  tables appear only in the expected RLS/no-direct-policy informational list;
  their fresh indexes appear in the expected unused-index informational list.

## Remaining release evidence

- Merge and Vercel production deployment of the application page/route.
- Responsive production browser and anonymous route-boundary checks.
- Real director links the intended accounts, assigns at least two independent
  cross-checkers, and completes the documented multi-session rehearsal. The
  October tournament currently has zero cross-checkers by design; no real role
  was fabricated for testing.
