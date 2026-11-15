# Isolated real-identity score-flow check — 2026-09-10

## Purpose

Static tests can prove that a score RPC contains an authorization clause, but
they cannot prove that PostgreSQL evaluates the clause under different signed-in
identities. This disposable test exercised the installed RPCs against the
separate synthetic validation database. It did not use the shared pilot,
production project, or any real player identity.

## Acceptance criteria

1. A checked-in assigned player can submit only their assigned side.
2. The other checked-in assigned player can submit the matching independent
   result and each player can confirm their own submission.
3. A nonparticipant cannot read the assigned-game context.
4. Matching dual submissions and confirmations create exactly two scorelines
   and verify the game with derived 3/0 points for a margin of 31.
5. The disposable transaction leaves no fixture accounts, profiles, or
   tournament records behind.

## Executed evidence

Inside one explicit transaction, the test created two synthetic `auth.users`
identities, their profiles, a scoped open tournament, approved digital Standard
Singles event, checked-in participants, and one pending game. It switched
`request.jwt.claim.sub` before each RPC call, then forced deferred constraints
before reading the final state. The transaction rolled back.

| Attempt | Actual result |
| --- | --- |
| Assigned player A submits side A, winner A, margin 31 | `submitted` |
| Player A tries to submit side B | controlled `not_assigned` rejection |
| Assigned player B submits matching side B | `confirmation_pending` |
| Player A confirms their own submission | `confirmation_pending` |
| Player B confirms their own submission | `verified` |
| Unassigned synthetic identity reads the game context | `null` |
| Final canonical state | `verified`, two scorelines, game points `[3, 0]` |

The post-rollback catalog check returned zero matching synthetic users,
profiles, and tournaments. This establishes actual database identity scoping
for the narrow Standard Singles score path, not an all-feature pilot approval.

## Still required

This one-connection database exercise does not substitute for separate browser
sessions, real magic-link authentication, network retry/reconnect behavior,
paper/hybrid handling, corrections, standings, finance, or director-led
tournament simulation. Those remain release gates in the working outline.
