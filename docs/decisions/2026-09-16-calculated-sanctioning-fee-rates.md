# Calculated ACC sanctioning-fee rates

## Decision

The application does not accept a tournament-wide ACC Sanctioning Fee total.
It calculates a visible running estimate from eligible Main and Consolation
participation at configurable per-person rates. Defaults are `$3.00` for Main
and `$1.00` for Consolation. Satellite rates are intentionally absent until a
dated authoritative ACC source defines one.

## Controls

- A non-default setup rate requires a reason and ACC source/reference.
- After event finalization but before Start Play, an authorized director or
  co-director may record an immutable rate override through the server-only
  endpoint with the same evidence.
- Start Play writes one immutable event snapshot containing the effective rate,
  eligible participant count, total, and rate source.
- Receipts, payment status, and legacy free-form totals are not calculation
  inputs. Legacy totals remain historical evidence only.

## UI clarity

The finalization dialog alone exposes Cancel and **Yes, Finalize & Open
Registration** while it is pending. Its event lines use `Type: name - style`.
The setup screen labels selected phone/email fields as required on one
unbroken line, places the player-visible mailing-address note above the input,
and keeps ordinary sign out separate from safe local-data clearing. The
running estimate refreshes from the read-only setup workspace every fifteen
seconds while visible and on browser focus; it updates only the derived count,
never an unsaved setup draft. It displays a last-updated time and a manual
refresh control. The post-finalization rate control is named **ACC Sanctioning
Fee Rate Adjustment Tool** and states that it is only for ACC Board-approved
changes.
