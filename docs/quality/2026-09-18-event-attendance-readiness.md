# Event Attendance Readiness Evidence — 2026-09-18

## Acceptance criteria

- Closing one event's check-in fails until every active enrolled player is
  checked in or marked no-show.
- Check-in, no-show, and reset use the latest event/player disposition rather
  than any historical row.
- No-show/reset is reasoned, immutable, idempotent, audited, and locked after
  Start Play.
- One roster identity cannot be checked into two events whose play is not yet
  completed/finalized.
- The director desk shows current payment evidence without letting attendance
  manufacture a receipt or enrollment.
- Browser roles cannot execute the new database writer directly.

## Evidence

- `pnpm verify`: PASS, including audit, lint, **596/596** application tests,
  provider readiness, optimized Production build, and workspace integrity.
- Migration `0217_event_attendance_readiness.sql`: applied successfully to
  disposable Supabase project `donfxulkliuyteiannir`.
- Hosted rollback fixture: PASS. It proved unresolved attendance rejects
  closure; reasoned no-show changes the participant projection to absent;
  complete attendance permits closure; and a reasoned correction restores the
  unresolved state. The transaction rolled back all fixture data.
- Hosted initial-window fixture: PASS. A previously unseen event opens at
  version 1 (the earlier empty-row version calculation was corrected before
  release).
- Hosted privilege check: `anon=false`, `authenticated=false`,
  `service_role=true` for `set_event_attendance_v1`.
- PR #100 passed both GitHub verification jobs and Vercel preview, then merged
  as `9b079e983f462497c483f595503068013d8aa740`. Production deployment
  `dpl_CS1ZqvfRxL8FB4YtcNNRvfHW4wd1` reached READY.
- Migration 0217 is applied to the rehearsal project. Its read-only postflight
  retained three tournaments and seven historical/current event rows, with
  browser execution denied and service-role execution retained.
- Signed-in Production inspection loaded the Genesis Rehearsal Event Check-In
  desk successfully and exposed the new checked-in/no-show/unresolved summary,
  desk request area, payment-safe attendance explanation, and current actions.
- That inspection found the retired Paper Team Doubles event still projected
  by the check-in reader. Migration 0218 now filters the workspace, desk
  requests, and participant projection to active events and rejects direct
  reopen attempts for retired/replaced events.
- PR #101 passed both GitHub verification jobs and Vercel preview, then merged
  as `329bbb033f07e0eb588a06c9daf517db4e874998`. Production deployment
  `dpl_GVdQRKUmBcAfNbJ72t5UnQNTma1P` reached READY. Migration 0218 is applied
  to disposable and rehearsal Supabase projects.
- A second signed-in Production read proved exactly four active rehearsal
  choices—Main, Consolation, Satellite Event -C.D., and Canadian Doubles
  Practice. The retired Paper Team Doubles event is no longer offered. No
  check-in window or attendance record was changed during browser proof.
- PR #102 passed both GitHub verification jobs and Vercel preview, then merged
  as `eee68a6fb1a0551630a200c73c12c7b717c202aa`. Production deployment
  `dpl_5dgT7Mnx5CvN4YQNkkeGk6CX1S3H` reached READY.
- Signed-in visual proof at the normal desktop viewport and an explicit
  390-by-844 phone viewport passed. The Event label remains intact above its
  full-width selector, all controls stay within the phone card, and the active
  event list remains four. The viewport override was reset afterward.
- Stable Production smoke: `/` and `/register` returned 200. A signed-out
  request to the protected check-in route returned the expected 307 sign-in
  redirect, while the existing authenticated Director session rendered the
  protected page. The deployment error/fatal runtime scan returned no entries.

## Remaining rehearsal proof

- A separate Co-director session is still required before claiming the
  multi-session rehearsal proof complete.
