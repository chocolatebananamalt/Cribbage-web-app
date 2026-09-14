# Director administration and Full Rehearsal evidence

Date: 2026-09-13  
Scope: director approval, self-service tournament creation, rehearsal bootstrap,
and rehearsal runbook

## Observable acceptance criteria

- The app owner and ACC administrators can review director applications; only
  an ACC administrator can mark an applicant ACC-verified.
- An approved director can create one named/dated draft, is assigned primary
  director, and can discover it under Your tournaments.
- Players, unapproved accounts, suspended directors, and direct browser
  database roles cannot create tournaments or approve directors.
- Every accepted application, decision, authorization change, creation, and
  role assignment has durable audit/receipt evidence and exact retry behavior.
- **Full Rehearsal — 09-16-2026** exists once, remains separate from the Pilot
  and October 3 tournaments, and is visible only through authorized roles.
- The runbook covers six fictional identities, single-device outage,
  whole-venue outage, paper/digital evidence, mismatch, correction, finance,
  results, and recovery.

## Database proof

- Applied migration `0163_director_administration_and_tournament_creation` to
  disposable project `donfxulkliuyteiannir`, then ran
  `tests/director-administration.sql` inside a rollback transaction: pass.
- Applied the same migration to approved pilot project
  `fnjkwymxpnsqvxtpronk`, then ran the same rollback fixture: pass with no
  retained fictional fixture rows.
- Read-only post-bootstrap inspection found exactly one platform administrator,
  two approved app directors, one rehearsal tournament, one primary-director
  role, one creation operation receipt, and one creation audit event.
- The rehearsal is `draft`, registration is `open`, its planned date is
  `2026-09-16`, and creator and primary-director profile IDs match.
- Existing Pilot Tournament and October 3 Pilot Tournament were not renamed,
  replaced, or reused.

## Repository proof

- `pnpm verify`: pass — dependency audit has no known high production
  vulnerability, ESLint passes, all **464/464** application tests pass,
  provider fallbacks are declared/default-off, Next.js 16.3.4 production build
  passes, and all **7/7** workspace checks pass.
- `pnpm verify:handoff`: pass — **6/6** private handoff checks.
- `tests/director-administration.test.mjs`: included in the 464-test gate and
  covers strict contracts, private projections, database authority/audit/replay,
  HTTP boundaries, and screen discovery.
- `git diff --check`: pass.

## Remaining physical evidence

The six independent authenticated sessions and actual offline network/device
exercise cannot be synthesized by a repository test. Complete the dated steps
in `docs/operations/OCTOBER_PILOT_REHEARSAL.md`; a pending offline record is not
server-verified until synchronization and the required independent evidence
complete.

## Deployment evidence

- Merged [PR #34](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/34)
  as commit `883331951cf5e0c7202113ea0603154085a96fbb` after both pull-request
  verification jobs and the Vercel preview passed.
- Vercel Production deployment `dpl_9eTGgEts1soS1xAS7uv16ob4Gzuh` is READY
  with no alias error at `https://cribbage-web-app.vercel.app/`.
- The post-merge `main` verification job passed.
- `pnpm verify:live-demo` passed at 320, 640, and 1280 pixels across 20
  distinct screens with no overflow, CSP violation, failed request, console
  error, or page error.
- Vercel reported no runtime-error clusters in the post-release interval.
- A service-bound chooser check returns the rehearsal by its exact name/date
  with the intended account's `director` role. The owner workspace reports
  platform-admin and tournament-creation authority; the rehearsal director
  reports creation authority without being mislabeled ACC-verified.
