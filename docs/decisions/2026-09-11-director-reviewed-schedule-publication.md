# Director-reviewed schedule publication — 2026-09-11

## Decision

Until a dated, approved ACC rotation fixture is available, the October pilot
uses a director-entered or imported Standard Singles schedule. The director
identifies players by their permanent tournament Verification ID and supplies
the actual Table/Seat occupied for each game. Publication creates the event's
rounds and canonical games atomically.

The server, not the browser, maps Verification IDs to event participants. It
rejects a schedule unless every enrolled participant appears exactly once in
every configured game, every game has two distinct participants, every
Table/Seat is unique within its game number, and the schedule has exactly the
configured event game count. An event must have an even number of checked-in
participants for this first supported import format.

Publication is append-only and one-time for an event. The interface previews
and validates the imported rows before the director confirms publication.
Once published, changes use a future audited schedule-correction workflow;
neither SQL edits nor silent replacement are an operational option.

## CSV contract

The supported header is:

`Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat`

Rows use values such as `1,A-1,A-2,A-1,A-2`. Names and account identifiers are
not accepted in the publication request. This keeps the import reviewable and
avoids transferring player contact data.

## Acceptance conditions

- A director or co-director can preview and publish a complete schedule for an
  activated digital Standard Singles event.
- An exact retry returns the original receipt without duplicate rounds/games.
- Missing players, duplicate players or seats in a game number, out-of-range
  game numbers, wrong event counts, paper/manual events, stale roles, and a
  second publication are rejected atomically.
- A linked digital participant can open a scheduled game with a paper-only
  opponent. Paper-only and paper/paper games receive canonical game records;
  converting their paper evidence into authoritative scorelines remains part
  of the separate cross-check completion gate.
- No authenticated client receives table access or direct RPC execution.

## Deferred

Automatic rotation, odd-player sit-outs, anchors, family restrictions,
schedule corrections, and ACC schedule export remain unavailable until their
authoritative fixtures and operational workflow are approved.
