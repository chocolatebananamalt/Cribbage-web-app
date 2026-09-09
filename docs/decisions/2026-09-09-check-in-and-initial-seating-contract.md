# Check-in and initial seating contract — 2026-09-09

## Decision

This increment creates the first server-authoritative operations boundary after
private roster promotion. It covers only director/co-director check-in state
and publication of **initial** Table/Seat and permanent verification IDs.
It does not generate round rotation, alter an event participant, create a
game, determine eligibility, or mark any scorecard as official.

Initial Table/Seat is assigned only after registration is closed. Its value is
copied as the player's permanent tournament verification ID. Later current
Table/Seat values are a separate per-round scheduling concern and remain
blocked pending the dated ACC rotation fixture required by `R-OPS-01`.

## Server model

The implementation will use append-only check-in events and an immutable
initial-seating publication rather than overwriting roster state:

- A current check-in state is derived from the latest event for each private
  roster entry: `checked_in`, `withdrawn`, `late`, or `absent`.
- Only a current director/co-director in the same tournament can record an
  event. The writer locks the tournament and roster target, records an
  operation receipt and audit event, and has exact idempotency behavior.
- A seating publication requires the tournament registration state to be
  closed, a positive table count and seats-per-table capacity, and an explicit
  nonempty list of checked-in roster entries. It assigns each listed entry one
  unique `Table-Seat` value, such as `A-7`, within the tournament.
- The verification ID is exactly the initial Table/Seat value. It is immutable
  once published; changes require a later separately-authorized, auditable
  override feature and are deliberately absent from this increment.
- Every published assignment has the publication actor and timestamp. Direct
  table access remains revoked, with forced RLS and narrow authenticated-only
  RPCs.

## Observable acceptance criteria

1. A director/co-director can record a valid check-in event for a same-
   tournament roster entry; the response is receipted/audited and a same-key,
   same-request replay returns the original response.
2. A player, revoked official, anonymous caller, cross-tournament target, or
   changed replay is rejected without creating an authorized state change.
3. An initial-seating publication is rejected while registration is open, for
   an un-checked-in/duplicate/foreign roster target, invalid capacity, duplicate
   Table/Seat, or changed replay.
4. A valid director/co-director publication creates one immutable permanent
   verification ID per included roster entry, scoped to the tournament, and
   records the exact initial Table/Seat value and publication provenance.
5. The initial read model reveals the full operational list only to
   director/co-director. No direct table grant, email, payment evidence, or
   future round schedule is exposed. Player-facing assignment delivery is
   explicitly withheld until a separately audited roster-to-account association
   exists; the current private roster identity deliberately has no Auth profile.

## Explicit non-effects and release gates

This does not establish the actual player-account association, event
participation, late-registration policy, rotation, anchors, sit-outs, family
restrictions, printed seating delivery, SMS, or any official schedule/export.
Those require their own source-backed and real-session verification work.

## Sources

- User seating/verification-ID decisions, 2026-09-06 through 2026-09-09.
- `docs/product/requirements.md`, scorecard and seating decisions.
- `docs/product/production-requirements.md`, `R-REG-01`, `R-ROLE-01`, and
  section 3.1.
