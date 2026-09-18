# Transient two-Judge Calls and operational workspace phases

**Date:** 2026-09-17

## Decision

The Tournament workspace is grouped in the normal operating order: setup;
registration and payments; check-in and seating; cross-check/recovery; then
results and reporting. This is a navigation change only; it does not combine
the independently protected lifecycle transitions.

A live Judge Call is an ephemeral request for in-person help on one current,
started game. The first two Judges who are not playing in that game may accept.
Once two accept, the remaining Judge alerts show that the two judges have
accepted. Either assigned Judge can clear the call with **Situation Resolved**.
The app neither records the decision nor changes a score. If a third Judge is
needed, the tournament staff find that person verbally.

## Consequences

- A player retains responsibility for the ordinary final score submission after
  the physical peg-board situation is settled.
- The existing immutable event-dispute/correction workflows remain the only
  place for a separately recorded dispute or corrective evidence.
- Calls are scoped to one tournament, event, and current game; server checks
  event play state, player participation, Judge role, and judge/player
  conflict before accepting an action.
- The transient row is deleted at resolution. It intentionally creates neither
  an operation receipt nor an audit event because the owner does not want an
  ordinary Judge Call represented as a recorded ruling.

## Non-goals

- No automatic third-Judge assignment or head-Judge routing.
- No score-entry, score-correction, result-finalization, or financial action.
- No replacement for the permanent dispute register.
