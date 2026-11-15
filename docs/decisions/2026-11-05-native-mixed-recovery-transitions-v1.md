# Safe cancellation and source-bound phase advancement

Status: local source only, private/default disabled, SQL unexecuted.
No database fixture permission was received in this phase.

## Durable cancellation, not inference from absence

The previous checkpoint intentionally preserved a pending operation if a writer
rejected it before journaling. Empty lookup cannot establish that a delayed
request will not arrive. The additive cancellation proposal supplies one
immutable, private tombstone table and a separately disabled write and read
entrypoint. It does not edit the frozen publication or recovery proposals.

Cancellation serializes on the same actor/operation and event-pipeline locks,
then checks current Director access, test scope, source locks and all-domain
operation reservations. An existing committed operation is recovered as history;
it is never rewritten as cancellation. A new tombstone binds the exact original
action/request, scope, hashes and reason. Reciprocal insert guards block a late
operation in simulation, admission, funding or attendance, even if the cancel
endpoint is later disabled. The table is append-only, RLS protected, and has no
application grants. No function receives an application execute grant.

This proves only **no committed operation**, not that execution or random
sampling never occurred in an aborted transaction. An uncertain canceled draw
is therefore terminal for the event. A new draw tombstone requires its exact
accepted bound plan/digests, with no committed draw or later phase, ordinary
draw/seating/schedule or Start. Arbitrary or nonexistent plan references cannot
freeze a valid event. Current consent is not required to close an old uncertain
request; cancellation creates no attendance, draw or publication authority.

The independent tombstone getter verifies hashes and rechecks actual operation
absence under locks. Lost cancellation responses can be recovered without
repeating the cancellation. Receipts say `notCommitted:true`,
`executionNotProven:true`, and deny fresh draw, Start and current-source
authority. A generic rejection, direct write reply or missing row is insufficient
to close device work.

## Next-phase observation

The separate private, disabled, read-only transition getter requires the exact
owned accepted historical receipt plus the current lifecycle/readiness source
and exact saved plan attendance capture. It derives only plan→draw,
accepted draw→review, or accepted review→publish. A failed/canceled draw or a
published event is terminal. Existing phase results and canceled draw markers
block advancement. This is a point-in-time observation, not a write capability;
the actual writer must recheck all current sources.

The pure decoder binds scope, parent ID/digest, attendance digest, phase and a
30-second observation window. The device controller fetches it immediately
before advancement, atomically replaces the exact closed marker with the exact
next pending operation, reads it back, and rechecks identity, permission and age
before dispatch. It never clears the marker to expose an unbound fresh action.
Unknown dispatch outcomes remain pending and can only be read or explicitly
canceled, never automatically retried or redrawn.

Explicit cancellation ports are also dependency-injected and unavailable by
default. They send only after reading back the exact pending record. The write
reply itself is ignored as resolution proof; normal committed history takes
precedence over a fresh exact historical tombstone read. Archival requires
another fresh read and atomic archive/closed-marker transition. Sign-out,
session/account changes, competing tabs and unavailable storage preserve work.

## Still blocked

- SQL installation, default-off/ACL, actual concurrency/rollback and late-write
  acceptance need a separately authorized disposable database. No SQL was run.
- Real provider methods and authenticated target leases for cancellation,
  cancellation recovery and phase observation are not wired. No HTTP route,
  grant or actual UI is enabled; provider and browser/session acceptance remain.
- Cross-Director phase handoff is unsupported because historical operations are
  actor-owned. Canceled non-draw actions need a separate reviewed restart flow;
  no automatic new operation is allowed by this checkpoint.
- Broader rehearsal Start, mixed scoring/playoff/Finance integration and human
  room/movement acceptance remain independent gates. No real attendance,
  payment, disbursement, physical-layout approval or official ACC result follows.

No staging/production access, saved-draft or historical-fixture change,
credential, invitation, publication or money action occurred.
