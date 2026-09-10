# Disposable score verification and duplicate-race evidence — 2026-09-10

## Defect found by independent review

The original `submit_game_score` writer preserved the unique score row when a
player submitted twice concurrently with different operation IDs, but its
losing insert raised an unhandled unique-violation. The API could therefore
return a generic failure with no controlled rejection receipt or audit conflict.

## Repair

Migration `0069_score_submission_duplicate_conflict_repair.sql` replaces only
the score-submission writer. It converts only the three known
`score_submissions` duplicate constraints (primary key, game/slot, and
game/player) into the existing `P0001` rejection path after re-reading the
committed conflicting row. All other uniqueness failures are rethrown. The
existing rejection path creates an immutable `operation_conflicts` record,
rejected receipt, and audit event with `duplicate_submission`.

Only the browser score-submission API recognises that exact three-field
rejection shape for the requested game and returns it as a private, no-store
HTTP 409 response. A confirmation route cannot accept `duplicate_submission`.
The pending submission-retry envelope for that same game is then cleared
because the server has conclusively rejected the second submission; malformed,
extra-field, other-game, or wrong-operation payloads remain unavailable rather
than being trusted as a terminal result.

## Disposable database evidence

All testing used the approved separate synthetic test project, never the pilot.
It contained four `@test.invalid` synthetic identities, two synthetic open
tournaments, and no real player, payment, or tournament data.

1. An outsider assigned only to the other tournament received `not_assigned`
   and created no score submission.
2. Player A submitted a 31-point win; Player B independently submitted the
   matching result. Player A could not confirm Player B’s entry
   (`not_submission_owner`). Each player confirmed their own entry, producing
   `verified`, two submissions, two confirmations, two reciprocal scorelines,
   and 3/0 game points with +31/-31 spread.
3. A same-player second submission with a distinct operation/submission ID
   returned controlled `duplicate_submission`, with one conflict record and
   one rejected receipt.
4. Two simultaneous separate database requests from Player A against a fresh
   synthetic game returned one `submitted` and one `duplicate_submission`.
   Persisted postconditions were exactly one score submission, one accepted
   receipt, one rejected receipt, one duplicate conflict, and game state
   `submitted`.

## Checks and limitations

- Local test suite: 80 passing tests after the database and API-contract
  regression tests.
- The migration applied successfully to the disposable database.
- These requests used controlled synthetic JWT claim context through the
  database test interface. They prove the database transaction and audit
  boundary, but do not replace later independent browser sessions with real
  Supabase access tokens, Next.js route evidence, mobile capture, or a
  complete simulated tournament.
