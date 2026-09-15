# Event play and tournament-operations boundary

Date: 2026-09-14

## Decision

Registration closure, seating publication, schedule publication, and event start are separate server operations. Each Main, Consolation, or Satellite event has a derived state of Preparing, Ready to Start, In Progress, Completed, or Finalized. Only a director or co-director may start an event, against the exact published schedule and participant snapshot. Start evidence is immutable and idempotent.

All online submissions, confirmations, paper completions, failed-device recoveries, and offline capability issuance fail closed before the event starts. Existing events with score evidence are backfilled as started; a published schedule without score evidence remains Ready to Start.

Live Preliminary Standings use authoritative verified or officially corrected scorelines only. They refresh every ten seconds and after a locally accepted result, and disclose freshness, connectivity, resolved games, and unresolved ties.

Side Pools are event-specific and separate from the existing two Q Pools. The four customary Side Pool categories are repeatable across events but unique within one event. Definitions, elections, and payouts use append-only records. Team identity is normalized as a team plus individual members and contributions; digital team scoring remains structurally impossible until separately approved and tested.

Participant absence, withdrawal, disqualification, substitution status, and reinstatement are audited and event-scoped. A status change never manufactures blanket wins or rewrites authoritative games. The 2019 ACC Tournament Director's Manual and 2025 ACC Rulebook are sufficient authority for the defined late-player, sit-out/makeup, early-departure, substitute, final-game, excluded-extra-game, refund, and playoff-absence outcomes. Mixed-up rotations are the one director-discretion case: the app validates conflicts and preserves a complete before/after version, but the director—not an invented automatic algorithm—chooses the corrected pairing.

## Consequences

- Starting one event never starts another event in the same tournament.
- Scheduled time alone never authorizes play.
- Late or missed-player amendments must preserve unaffected Verification IDs and schedules.
- Satellite results never award MRPs or qualify a player for Main or Consolation.
- Automatic ACC submission remains unavailable without an approved interface.

