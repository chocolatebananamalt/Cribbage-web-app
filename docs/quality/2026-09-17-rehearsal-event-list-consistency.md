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

## Remaining verification

- Deploy through the reviewed Production path, then verify in an authorized
  director browser session that Genesis Rehearsal displays only its four
  active events and the retired Doubles event has no visible Setup card.
- The independent-device rehearsal remains a separate physical acceptance
  gate for scoring, cross-checking, offline recovery, finances, and results.
