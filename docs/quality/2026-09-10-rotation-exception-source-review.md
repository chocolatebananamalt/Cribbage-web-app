# Rotation exception source review — 2026-09-10

## Question reviewed

The Seating/Table Plan area must not invent instructions when the final table
cannot play normally, including an odd-player condition after a player leaves.

## Authoritative public evidence

The ACC Tournament Director's Manual says that when a qualifying-round
departure leaves an odd number at a table, play continues until all players
have completed at least the required number of qualifying games. Some players
may play an extra game; that extra game does **not** count in their score, but
is recorded on the back of the scorecard for cross-checking. The Manual also
says a director may need to modify rotation after a departure and should seek
a fair resolution for a mixed-up rotation with judges and others who have
relevant insight.

Sources:

- [ACC Tournament Director's Manual](https://www.cribbage.org/sched/Directors%20Manual%20-%202015%20book.pdf)
- [ACC Director Resources](https://www.cribbage.org/NewSite/sched/tournament_dir.asp)

## Safe product consequence

The application may show a clearly labeled **director exception review** for
an affected last table. It must show the affected players, required qualifying
game count, the fact that any extra game is excluded from standings, and an
audit field for the director's chosen resolution. It must not automatically
publish a substitute, rotation change, sit-out, anchor, late-entry rule, or
official schedule without a dated approved fixture for that exact event.

No rotation algorithm, standings calculation, or official schedule behavior
was enabled by this review.

## Remaining gate

ACC/director confirmation and executable fixtures are still required for the
normal table-rotation algorithm, last-table transfers, anchors/sit-outs,
substitution handling, and event-specific exception policy. This remains a
Step 3 release requirement rather than a prototype-only choice.
