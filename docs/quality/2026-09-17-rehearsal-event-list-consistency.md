# Rehearsal event-list consistency — 2026-09-17

## Acceptance criteria

- An activated/open tournament renders event controls and the visible event
  list only from the authoritative activation-state response.
- A retired event preserved in an older setup revision cannot appear as an
  editable card, a fifth active event, or an enrollment option.
- Each active event list entry identifies event type, event name, and style.
- The correction is presentation-only: it does not modify the rehearsal,
  roles, registration, active events, payments, seating, schedules, scores,
  or audit history.

## Executed evidence

- Focused setup activation and Side Pool regression checks: **15/15 pass**.
- `pnpm exec tsc --noEmit` — pass.
- `pnpm verify` — pass: production dependency audit, lint, **530/530**
  application checks, provider readiness, Production build, and workspace
  verification.
- `pnpm verify:handoff` — pass.
- `git diff --check` — pass.
- Pull request #77 merged as `8047b3c6b9cde94a84d25d9102f64189a4610da9`.
  GitHub Verify passed for both push and pull-request runs, and Vercel reported
  the Production deployment READY.
- In a signed-in external Chrome session on Production, Genesis Rehearsal
  displayed exactly four finalized events with `Event type: Event name - Style`
  labels. The retired Paper team Doubles event had no visible Setup card,
  enrollment option, or editable removal control.

## Remaining verification

- The independent-device rehearsal remains a separate physical acceptance
  gate for scoring, cross-checking, offline recovery, finances, and results.
