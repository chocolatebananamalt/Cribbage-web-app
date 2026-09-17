# Youth ACC number identity

**Date:** 2026-09-17

## Decision

The app accepts adult ACC numbers such as `HI296` and youth ACC numbers such
as `HI296Y`. The final uppercase `Y` is a youth-status suffix, not a different
member identity. All new input validates `^[A-Z]{2}\d+Y?$`.

The supplied uppercase value remains the player-facing and audit value. An
internal identity key strips one terminal `Y`; therefore `HI296Y` and `HI296`
match for roster duplication, check-in, and directory lookup.

## Safeguards

- Historic roster and registration history is immutable and is not rewritten.
- New rows receive a stored internal key; historic rows derive it at read time.
- The migration fails rather than merges people if existing active youth/adult
  forms collide in one tournament.
- Inputs remain uppercase-only at server boundaries; form entry normalizes
  typed or pasted values before submission.
