# Dependency security and event-start recovery — local candidate

> Historical implementation checkpoint. Current verification and release limits are in
> [completed local database execution](2026-10-23-local-database-execution.md).
> Earlier audit, environment and approval states below are superseded.

This supplements the director setup evidence from the same date. Work remains on
`codex/director-setup-journey`, based on rechecked remote main
`7b318e64ef15f769f7ac2219a3324da07ed3e8dd`. The separate OneDrive checkout is
untouched. No push, PR, deployment, shared database changes, emails or payments.
`git ls-remote origin refs/heads/main` rechecked this SHA again after final UI
verification; the remote had not advanced.

## Dependencies

Production audit changed from **13** findings (1 low, 5 moderate, 4 high,
3 critical) to **0**. Full audit changed from **20** (1 low, 7 moderate,
9 high, 3 critical) to **1 high development-only** finding.

`next` and `eslint-config-next` are pinned to stable 16.4.2. Lockfile updates
also remove vulnerable runtime `source-map-js` and optional `sharp` artifacts.
The pnpm workspace overrides vulnerable brace-expansion 5.x with 5.0.12 within
the parent dependency's declared major range; 1.x resolves to patched 1.1.21.
No audit suppression or weakened verification was introduced.

The remaining advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
`eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`.
The registry publishes only braces 3.0.3 and the upstream advisory says no patched
version. npm audit's suggested 3.0.4 is unpublished; an attempted resolution
failed and the unusable override was removed. This is development tooling
exposure, absent from the production dependency audit. It remains unresolved.
ESLint 9 also reports an upstream end-of-support/deprecation warning; moving
major lint tooling is separate compatibility work.

Sources: [Next 16.4.2 release](https://github.com/vercel/next.js/releases/tag/v16.4.2),
trusted npm registry metadata/integrities and the upstream advisory above.

## Additional reliability repairs

Event-start requests retain their exact actor-scoped envelope across refresh,
uncertain/malformed responses, changed event status and retired/missing events.
Pending selection is locked, accepted starts latch locally against stale props,
and the existing explicit `event_retired` rejection is recognized. Creation's
strict accepted receipt supplies name/date only when the server seed is absent;
saved setup wins. Shared-device cleanup removes both new recovery namespaces.
The checklist distinguishes team-event starts and names empty event enrollment.
Team enrollment/payment coverage comes from validated Team Scorecards member
projections. Missing team reads remain unknown. The day-attendance step applies
to Standard Singles; Doubles retains its existing team readiness rules because
its members are not represented by the Singles attendance projection.

## Executed evidence

- Frozen-lockfile install: passed.
- Unchanged `pnpm verify`: passed; production audit zero, lint zero errors/two
  pre-existing warnings, **771/771 application tests**, provider checks,
  Next 16.4.2 production build, workspace **7 passed/1 private-handoff skip**.
- Focused recovery/checklist tests: **21/21 passed** initially; final checklist,
  enrollment and migration source-contract group **28/28 passed** independently.
- Explicit TypeScript `tsc --noEmit --incremental false`: passed; the final
  aggregate build also typechecks the last setup-helper change.
- Synthetic Chrome browser: **16/16 scenarios passed**, 390px and 1440px,
  including twelve-game schedule publication, uncertain/malformed/repeated
  starts, refreshed In Progress, retired-event recovery and creation seed fallback.
  Includes terminal started-event enrollment rejection and pending cleanup.
  Final evidence: local-only browser evidence (not published);
  `browser-final.log` records the executed run.
- Raw audit/install/check logs: ignored `test-results/dependency-security/`.
  The final repeated aggregate run is `verify-release-candidate.log` (exit 0).
  Earlier `verify-final.log` passed758 tests before the SQL/team follow-up.
  A restricted
  network attempt was interrupted while waiting for registry audit, then rerun
  with approved network access. `git diff --check` passed.

The browser uses localhost, synthetic actors/players and mocked responses;
external requests are blocked. It does not prove shared backend execution,
SMTP, real multi-device/offline behavior, payouts or complete final results.

Lead model substitution: active gpt-6.1-sol; bounded worker gpt-5.6-luna medium;
authentication/migration worker and independent reviewer gpt-5.6-sol high,
following repository routing. No Astra used.

Independent Sol review found no introduced source blocker after final
recovery/checklist/dependency and SQL corrections. It separately passed guard
source tests9/9, focused tests28/28, PowerShell parsing and diff checks. This is
source review, not PostgreSQL execution or release certification.

## Database guard verification boundary

Review found enrollment's historical `checked_in` status is insufficient to
prove newer event-day attendance readiness at the atomic start boundary.
The user authorized a narrow local migration and isolated fixtures. The candidate
is `database/migrations/0236_event_start_requires_closed_attendance.sql`, with
rollback fixture `tests/event-start-attendance-guard.sql` and source-contract
tests `tests/event-start-attendance-guard.test.mjs`. These source tests do not
execute SQL. No shared
backend migration is authorized or attempted. No PostgreSQL, psql, Supabase CLI,
Docker or Podman executable was found on PATH; standard PostgreSQL/Docker
installation directories are absent. Service inventory was unavailable due to
local permissions, so a nonstandard installed service cannot be ruled out.
No system software was installed. Database execution and concurrent transaction proof therefore
remain **unverified**, requiring a disposable PostgreSQL/Supabase test database
with the repository migrations and synthetic fixtures, never a production URL.

The candidate serializes Singles start with attendance window, disposition,
desk/QR completion and enrollment RPCs; it requires an actual closed window,
resolved attendance and no pending desk requests. Exact accepted operation
receipts are reconciled after current authorization and before new lifecycle
state gates. The historical start,
schedule, scoring, seating, sanctioning snapshots and audit implementations
remain delegates. Doubles start is deliberately untouched: its team members
are not represented by the Singles attendance model. `no_show` remains resolved
for attendance, while the existing stricter schedule/start rules still apply;
no automatic roster removal, rescheduling or charge change was added.

Prepared `tests/run-event-start-attendance-concurrency.ps1` and its two SQL
sessions assert the helper's mutual exclusion, not a complete concurrent
start/close integration test. They are unexecuted. Before release, the disposable
database run must also exercise actual simultaneous start/reopen, start/desk,
QR/close and start/enrollment requests, accepted replay after state changes,
authorization and cross-tournament denial. Tournament registration closure is
distinct from later event enrollment; this patch does not impose a blanket
ban on enrolling qualifiers into unstarted later events.

SQL review explicitly checked receipt authorization, target tournament scope,
obsolete QR entry points and local-only runner connection parameters. The first
aggregate run during SQL integration exposed a source-contract test that assumed
the latest desk RPC contained its original inner advisory lock. The corrected
test must retain that assertion against the delegate and additionally check the
new wrapper's lifecycle lock; moving a lock behind a wrapper is not evidence
that concurrency was tested in PostgreSQL.

Smallest safe next step: expose an **existing empty disposable local**
Supabase-compatible PostgreSQL instance (required auth schema, roles and
extensions) plus `psql`. Confirm it contains no real data, apply repository
migrations0001–0236 there, then execute:

```powershell
psql -X -h 127.0.0.1 -d <disposable_name> -v ON_ERROR_STOP=1 -f tests/event-start-attendance-guard.sql
$env:PGHOST = '127.0.0.1'
./tests/run-event-start-attendance-concurrency.ps1 -Database <disposable_name>
```

Both fixtures roll back synthetic rows. The runner refuses remote hosts and
connection strings. This database verification is **pending/unavailable**, not
an approval denial; no production fallback or software installation was used.
Follow it with actual concurrent RPC cases and isolated multi-session staging
before considering an approved draft PR or release. SMTP/admin limit verification
and real digital multi-device/offline/final-results proof remain access-dependent.

## Changed-file scope beyond the initial setup pass

`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`; schedule client and
event-schedule receipt codec; Create/Setup clients; checklist reader/derivation;
session cleanup; corresponding recovery/checklist/browser tests; this report and
`PROJECT_STATUS.md`. The initial report retains the full setup file inventory.
Also: the migration and five SQL/source/concurrency fixture files below,
`src/lib/api/event-roster-enrollment.ts`,
`src/app/tournament/[tournamentId]/participants/participants-client.tsx`,
`tests/event-roster-enrollment.test.mjs`, and the guided-setup decision addendum.
The existing `tests/no-locking-clause-on-aggregate.test.mjs` now verifies both
the wrapper's lifecycle lock and the delegate's original target lock.

SQL deliverable inventory:

- `database/migrations/0236_event_start_requires_closed_attendance.sql`
- `tests/event-start-attendance-guard.sql`
- `tests/event-start-attendance-guard.test.mjs`
- `tests/event-start-attendance-lock-session-a.sql`
- `tests/event-start-attendance-lock-session-b.sql`
- `tests/run-event-start-attendance-concurrency.ps1`
