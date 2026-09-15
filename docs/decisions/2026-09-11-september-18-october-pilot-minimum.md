# September 18 October-pilot minimum

Date: 2026-09-11

Status: accepted product scope; implementation and release evidence remain in progress

## Decision

> **Supersession note (2026-09-14):** This dated decision remains historical,
> but its Standard-Singles-only and paper-team boundary is superseded by
> `2026-09-14-october-team-scoring-seating-and-six-side-pools.md`. The current
> September 18 gate includes supported two-person Traditional/Canadian Doubles
> Digital/Paper scoring, participant seating lookup, and six Side Pools.

The release target for director onboarding is September 18, 2026, followed by
a supervised tournament on October 3, 2026. The pilot is Standard Singles
only for digital scoring. A tournament remains one tournament record with
separate Main, Consolation, and zero-or-more Satellite event records so the
director does not switch tournaments when operating simultaneous events.

The September 18 pilot minimum must provide working, server-backed:

- tournament setup for event type, game count, entry fees, Q-pools, table
  capacity, and any supported payout inputs;
- player registration/manual import, director roster review, payment status,
  check-in, registration closure, and initial Table/Seat assignment;
- table planning and initial seating, with a director-entered or imported game
  schedule when an approved automatic-rotation fixture is unavailable;
- two independent submissions plus two distinct eligible confirmations,
  verified scorecards, durable offline capture/replay, and non-self
  cross-check/correction;
- a minimum authorized paper/digital and paper/paper evidence path plus
  server-audited dispute intake, status, and non-self resolution;
- event-scoped standings, qualifier/high-non-qualifier calculation, playoff
  results, Q-pool/MRP fields that are backed by approved fixtures, and exports;
- the private financial ledger, expenses, sanctioning fee, Q-pools, payouts,
  and reconciliation needed by those results.

Production integration of the Rulebook/quick-reference functionality, the
Judge Desk, digital team scoring, flyer generation/import, online payments,
SMS, OCR, and automatic ACC portal submission are explicitly deferred and do
not block this pilot. The existing demonstration may retain a clearly
non-operational Rulebook/reference preview for format review; it is not pilot
functionality or release evidence. Team events use paper scorecards.
Tournament Events and Flyer remains an event-summary
screen for configured Main, Consolation, and Satellite events; its flyer
portion is preview-only until the deferred builder is delivered.

## Release boundary

The narrowed scope does not weaken score integrity. A score is never verified
from one paper record, one submission, pending offline data, or one staff
action; unresolved disputes block finalization and self-resolution is denied.
Automatic schedules are rejected unless an approved rotation fixture is
configured. A director-entered/imported schedule must be visibly labeled and
pass uniqueness, capacity, and approval checks. Qualifying and money outputs
remain configuration/draft and cannot be official wherever a dated ACC fixture
is absent. “Ready” requires
real independent-device, offline/reconnect, database, phone/desktop, backup and
director rehearsal evidence—not merely an interactive demonstration.

## Schedule risk

September 18 is a target, not evidence of completion. MRP, Q-pool, payout, and
export confirmations are required by September 16 for the September 17
results/finance gate; otherwise those outputs remain draft and the October 3
live-use gate stays blocked. As of September 11, the
database contains substantial protected foundations, while durable offline
operation, complete operational wiring, authoritative results/finance, and the
full real-user release rehearsal remain open. Any unresolved scoring,
qualification, payout, data-loss, or multi-user defect blocks live use even if
the calendar target is reached.
