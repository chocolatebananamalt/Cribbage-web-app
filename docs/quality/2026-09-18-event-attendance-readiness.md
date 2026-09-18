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

- `pnpm test`: PASS, 594/594.
- `pnpm exec tsc --noEmit`: PASS.
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

## Remaining release proof

- Run full `pnpm verify` and private handoff verification if present.
- Verify the protected desk at phone and desktop widths with independent
  Director and Co-director sessions against a real test backend.
- Apply migration 0217 to the rehearsal project only after the full gate passes,
  then deploy through reviewed PR and run Production smoke/runtime checks.
