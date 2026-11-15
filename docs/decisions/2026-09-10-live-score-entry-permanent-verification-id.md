# Live score-entry permanent verification ID

**Date:** 2026-09-10

## Decision

The live game context exposes the already-assigned permanent verification ID
for only the two players assigned to that game. It does not create a second ID
or reuse the changing current Table/Seat snapshot.

## Why

The user's approved workflow distinguishes a permanent tournament verification
ID from the player’s changing Table/Seat. The existing initial-seating model
already derives `verification_id` from the one immutable initial Table/Seat
assignment published after registration closes. Returning that field through
the existing, assignment-scoped game reader preserves one source of truth.

## Security boundary

`get_assigned_game_context` remains a `SECURITY DEFINER` function with an
empty `search_path`; its own-player assignment check remains intact. It joins
the private roster-account and initial-seating records internally, returns only
the two display IDs, and continues to revoke anonymous execution. It does not
return roster-entry IDs, profile IDs, or seating-workspace data.

## Consequence

The score-entry screen shows each player’s permanent `ID#` beside their name
and their current game Table/Seat separately. If a linked player does not have
a published initial assignment, the scoped context returns no game rather than
displaying an invented or stale verification ID. Dynamic rotation remains a
separate, unimplemented server workflow and is not implied by this change.
