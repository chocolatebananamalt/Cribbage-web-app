# Two-device technical rehearsal: exact setup boundary

The approved rehearsal is `3c58ef91-010c-4769-af20-5cfa2ffe98a9`. Its staged
simulation-link mode is enabled on verified commit
`f183d395bf75df9648871d6eb870ffdd6ce4fb9e`. Daron operates both devices. A helper
is NOT needed for the first technical stage. This investigation made no hosted
business writes, account switches, credential changes or scoring/outage actions.

## Verified concrete blocker

The normal setup UI shows saved revision 2: one Standard Singles Main, 12 games,
explicit $3 fee, no Q or Side Pools, and the existing player-facing text:
**Device scoring rehearsal only; no prizes or settlement. Timing pending.**
B is Registered & Approved as fixture-only co-director; laptop is Director.

However, this paid Main requires a structured regular prize declaration before
activation. The live `app.bind_prize_schedule_on_activation_v1()` still has
`if require_current then raise exception 'schedule_revision_required'`. The
current editor and validator accept only four or five qualifiers. Both Finalize
All Events / Open Registration and Save All Events Draft are disabled while the
required declaration is missing. No schedule was invented or saved.

Executed local production-function probe:

```json
{"twoEntrantQualifierCount":1,"oneQualifierSchedule":null,"twoQualifierSchedule":null,"supportedFourQualifierSchedule":true}
```

Source: `src/lib/qualification.ts`,
`src/lib/results/prize-schedule-setup.ts`, setup `prize-schedule-client.tsx`,
and migration 0268's active activation trigger. A four/five-qualifier award
declaration would not describe this two-player no-prize technical exercise.

The normal roster page was actually opened. It says **Registration has not
opened. Save the tournament details and all event drafts, then choose Finalize
All Events / Open Registration in Setup before adding or importing players.**
Add Player and Import Players are disabled. Thus neither roster nor link issuance
can proceed through the supported UI yet. No direct RPC was used to evade it.

## Downstream check made before proposing a repair

Event attendance also requires a settled explicit obligation via
`app.event_qr_player_is_paid_and_enrolled`. The live outer desk check-in RPC delegates
to `desk_check_in_event_v1_before_start_guard`, which retains that condition.
An explicit $0 owed/comped obligation can normally settle without a receipt
(migrations 0219/0221); that is different from pretending $3 was collected. No
waiver was assumed or recorded. A paid $3 obligation would require actual receipt
evidence, which this rehearsal must not fabricate.

The technical schedule implementation itself accepts at least two participants
(migration 0114), not seventeen. This does NOT claim ACC sanction eligibility or
change official minimum-player rules. The actual blocker is the paid-Main prize
and attendance lifecycle, not the phone, login or lack of another human.

## Smallest proposed extension requiring review

Add an explicit, immutable **Technical rehearsal — no prizes or settlement**
declaration for this already enrolled staging fixture only. Preserve its $3
configured field and normal blank/minimum validations. Permit normal activation
without a four/five-qualifier award rule only when that exact declaration and
existing project/fixture/profile scope are valid. Keep normal prize-required
activation unchanged everywhere else; block qualification/award/settlement use
for this declared technical-only fixture. Represent any permitted attendance
exception as explicit no-charge test obligation/provenance, never a receipt or
paid flag. Prefer the existing explicit zero-owed path after its use is confirmed,
rather than a new payment bypass.

Local implementation/test and an additive staging migration/publication scope
must be reviewed before applying this extension. Test normal paid activation
still rejects missing policy, exact fixture/no-pool/two-account limits, zero
fabricated receipts, truthful attendance, canonical game/submission/confirmation
guards, stale/replayed/concurrent actions and forbidden monetary finalization.
Do not change this fixture to Free/Satellite, add dummy entrants or invent a
four/five-qualifier schedule just to get past the guard.

## Current state and human step

No new prize schedule, roster, operational event, activation credential, link,
payment or score was created. Both sessions and completed finals remain intact.
The laptop's single preserved tab is on this rehearsal's roster page, displaying
the precise prerequisite. Phone stays B. There is no useful phone action yet;
do not ask Daron to sign in or accept the invitation again. Resolve this narrow
setup gap first, then create the two roster identities and normal private links
and hand over the B redemption step. Single-operator technical success remains
the first stage; independent-person usability comes only afterward.
