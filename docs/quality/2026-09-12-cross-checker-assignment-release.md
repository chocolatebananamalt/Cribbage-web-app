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

- Real director links the intended accounts, assigns at least two independent
  cross-checkers, and completes the documented multi-session rehearsal. The
  October tournament currently has zero cross-checkers by design; no real role
  was fabricated for testing.

## Production release evidence

- The assignment slice merged through pull request 13 as `main` commit
  `b2ea2c514cb2fbe9bb563991451ab7f195561b72`. Vercel Production deployment
  `dpl_9Ad9gqKer6iR6cYmFmijCfqFH9gp` reached `READY`, received the stable alias,
  and reported no alias error.
- A production browser check exposed a narrow-phone access-card overflow. Pull
  requests 14 and 15 corrected containment and word-boundary readability; PR
  15 merged as `9562e51c606b5de3d25c9a69d49e37687fb828c5` and Production deployment
  `dpl_4PWfNKXoQSyycxhEtk8xzZKr8gV5` reached `READY`.
- The remaining console signal was traced to a missing browser icon rather
  than application code. Commit `0e72fe75251c9fcf324f42dcf8cf2382126573df`
  added the app icon and was fast-forwarded to `main` after GitHub's pull-
  request API repeatedly returned 502/GraphQL failures. Production deployment
  `dpl_7SH1ANC2ooQahRfUodNGsapQNrFm` is `READY`, owns the stable alias, and
  reports no alias error.
- Final local verification: `pnpm verify` passes 452/452 application tests,
  provider fallback checks, the production build, and workspace checks;
  `pnpm verify:handoff` passes 6/6.
- Final live Playwright verification at 320×900 and 1280×900: HTTP 200,
  meaningful signed-out content, document width equal to viewport width, no
  failed resources, console/page errors, or framework overlay, and a resolved
  `/icon.svg` browser icon.
- Anonymous production API proof: `GET` assignment workspace returns 401;
  malformed same-origin `POST` returns 400. Vercel reports no runtime-error
  clusters and no production 5xx logs during the release window.
