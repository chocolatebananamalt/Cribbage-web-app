# Director-reviewed schedule publication evidence — 2026-09-11

## Acceptance boundary

The October Standard Singles pilot may create scoreable rounds and games only
from a complete schedule that a current director/co-director explicitly
reviewed. The server must bind permanent Verification IDs to enrolled players,
enforce the published table plan, create all rows atomically, preserve exact
retry behavior, and prevent silent edits after publication.

## Implemented

- Migrations `0114`-`0117` add one-time event publications, canonical rounds
  and games, immutable assignment/participant guards, table-capacity and
  same-table enforcement, a service-only writer/reader, paper-opponent display
  fallback, and table-plan-aware browser preview.
- The protected schedule workspace imports an exact five-column CSV, shows
  event players by permanent Verification ID, validates complete per-game
  permutations, requires an explicit review attestation, retains one exact
  unresolved retry, and displays the published schedule by game.
- `tests/event-schedule-publication.sql` is the permanent rollback-only hosted
  fixture. No synthetic account, tournament, event, game, or receipt survives.

## Executed evidence

Environment: shared Supabase pilot `fnjkwymxpnsqvxtpronk`, rollback-only
synthetic records, and the local Windows worktree.

- Applied migrations `0114` through `0117`: **PASS**.
- Hosted SQL fixture: **PASS** after one fixture-only repair (the immutable
  game test now always writes a value different from either scheduled seat).
- Hosted fixture proves explicit review, outsider and stale-role rejection,
  same- and cross-tournament wrong-event rejection, out-of-capacity and
  duplicate/missing player/seat rejection with atomic zero-row behavior, valid
  publication, exact non-duplicating replay, changed-payload retry conflict,
  second-publication rejection, immutable canonical assignments/rounds, and
  blocking a participant move from an unpublished event into the published
  participant set.
- An earlier rollback fixture also proved a 12-game mixed digital/paper event,
  a paper-only opponent in the assigned-game reader, event-scoped workspace
  rows, post-publication participant insertion rejection, and zero retained
  synthetic rows.
- Hosted grants: anonymous writer `false`, authenticated writer `false`,
  service writer `true`, private core service execution `false`; anonymous and
  authenticated workspace reader `false`, service reader `true`.
- `pnpm test:schedule`: **5/5 PASS**.
- `pnpm verify`: **PASS** — dependency audit, lint, **244/244**
  application tests, production build, and **6/6** workspace checks.
- `pnpm verify:handoff`: **6/6 PASS**.
- Focused TypeScript, ESLint, and diff checks: **PASS**.
- Independent `gpt-5.6-sol` high review: all original P1 code defects closed;
  its participant destination-scope and preview-capacity P2 findings were then
  fixed by `0116` and `0117`.

## Advisor result

The post-migration Supabase security advisor reports the expected informational
private-schema `RLS enabled, no policy` notices. These tables are deliberately
in the unexposed `app` schema, forced-RLS, and reached through narrow functions.
No schedule publication function was newly exposed to anonymous or
authenticated callers. Performance notices are unused-index observations on a
new/low-traffic pilot and are not correctness failures.

## Remaining release proof

- A genuinely simultaneous two-connection publication race was not executable
  through the available single-query database connector. The writer takes the
  tournament row lock, uses an actor/operation advisory lock, and has a unique
  event publication constraint, but a two-connection rehearsal remains part of
  the release simulation.
- Production browser proof at desktop and phone sizes is recorded after the
  reviewed commit is deployed. The real pilot is intentionally not activated
  until its complete actual event list is entered because activation is
  irreversible.
- This slice creates canonical paper/paper and hybrid games; authoritative
  paper evidence entry/reconstruction remains the separate cross-check gate.
