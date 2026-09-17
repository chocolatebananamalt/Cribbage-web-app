# Rotating Event QR Check-In — Verification Record

Date: 2026-09-17

## Observable acceptance criteria

- A director/co-director can open one finalized event check-in window and
  obtain an opaque, fragment-only QR URL expiring in 60 seconds.
- A public scan cannot expose roster/payment/seating/results data. It either
  records an exact paid-and-enrolled event check-in once or directs the person
  to the desk.
- Wrong/expired/closed QR credentials and cross-site requests fail closed.
- Consolation cannot open before Main qualification finalization.
- The desk writer requires an active roster record, open event window, paid
  obligation, and event enrollment; it cannot manufacture either prerequisite.

## Executed checks

- Applied `rotating_event_qr_check_in` and `event_check_in_desk_completion`
  to the approved pilot Supabase project `fnjkwymxpnsqvxtpronk`.
- Read-only database check confirmed all five core event-check-in RPCs exist.
- `node --conditions=react-server --experimental-strip-types --test
  tests/event-check-in.test.mjs`: **4/4 passed**.
- `pnpm verify`: **passed** — audit, lint, **545 application tests**, provider
  readiness, Production build, and workspace integrity.
- `pnpm verify:handoff`: **6/6 passed**.
- TypeScript `pnpm exec tsc --noEmit`: passed before the full verification.

## Remaining release evidence

- Local browser automation was unavailable on this workstation and Chrome
  blocked the local loopback preview, so phone/desktop visual proof remains
  pending a deployed preview/Production check.
- The real multi-device QR rotation/expiry/wrong-event and paid/unpaid desk
  rehearsal remains pending.
- Resend/Supabase Auth email delivery, callback-to-roster linking, failure
  retries, and 600 invitations in 45 minutes are external configuration and
  load-test gates; email access is not represented as live or delivered.
