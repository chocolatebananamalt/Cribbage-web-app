# Score-confirmation retry repair — 2026-09-10

## Acceptance criteria

Digital Standard Singles score verification must require two matching assigned
player submissions and two distinct player confirmations before it creates
canonical scorelines or marks a game verified. A duplicate confirmation must
never alter that state; a repeat caused by a new client operation ID must also
return a controlled, auditable rejection rather than a raw database error.

## Finding and repair

The live disposable execution of `confirm_game_score` found that the database
uniquely prevented a second confirmation from the same player, but a new
operation ID surfaced PostgreSQL constraint error `23505` directly. The score
remained safe, but the client could not reliably classify the expected retry.

Migration `0085_duplicate_confirmation_conflict_repair.sql` replaces only the
confirmation RPC. It catches solely the known
`score_confirmations_canonical_game_id_confirmation_actor_id_key` constraint,
checks that the existing confirmation belongs to that exact game and actor,
and converts it to `duplicate_confirmation`. The pre-existing controlled
rejection path then records the immutable operation receipt and linked audit
event. The application response validator explicitly recognizes that exact
code and sends the normal `409` response, allowing the client retry envelope
to retire the failed duplicate action. Unrelated unique violations still
rethrow.

## Executed evidence

- Disposable synthetic database `donfxulkliuyteiannir`: migration applied
  before the pilot. An assigned second player submitted the same result for an
  existing one-submission game, producing `confirmation_pending`. The first
  assigned player confirmed their own submission and the game remained pending
  with one confirmation and no scorelines.
- A fresh duplicate confirmation from that same player returned the durable
  response `{ status: "rejected", code: "duplicate_confirmation" }`; it left
  the game `confirmation_pending`, with one confirmation and zero scorelines.
  The matching rejection receipt and `confirmation_rejected` audit event each
  exist exactly once.
- The other assigned player then confirmed their own distinct submission. The
  same game returned `verified`, proving the repair does not interfere with the
  two-submission/two-confirmation completion path.
- Pilot database `fnjkwymxpnsqvxtpronk`: the identical migration was applied.
  Catalog verification confirms `SECURITY DEFINER`, empty search path, no
  anonymous execute grant, and authenticated-only execution guarded by
  `auth.uid()` and assigned-player checks.
- `pnpm test` passes: **114** tests, including a regression that checks the
  narrowly caught unique constraint, stable code, durable receipt/audit path,
  and rethrow behavior for unrelated unique violations.

## Remaining release evidence

This proves a controlled synthetic database sequence, not the full live
tournament workflow. Independent signed-in browser sessions, concurrent
submission/confirmation races, mismatch and reconnect handling, and
director-approved ACC fixtures remain release gates under
`docs/quality/VERIFICATION.md`.
