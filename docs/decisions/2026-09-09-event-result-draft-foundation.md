# Event result-draft foundation — 2026-09-09

## Decision

The first results implementation is an immutable, private **draft snapshot**,
not an export, qualifier calculation, payout, or publication mechanism.

One director/co-director operation may create an `event_result_draft` only by
locking a single event and copying its server-held source facts. The draft must
include an immutable source manifest with every included canonical-game ID,
its version/state, both reciprocal scorelines, source ruleset identity, and
scoring method. A canonical manifest hash detects any later divergence from
the live source. No browser supplies source game IDs, score data, ruleset,
scoring method, placement, qualifier, payout, or blocker state.

The draft must store explicit blocker evidence. Missing approved rules,
unverified games, unresolved corrections/disputes, finance reconciliation, or
export mapping make a draft non-authoritative. They do not permit guessed
results.

## Deliberate exclusions

- No `export_artifact`, PDF, public result read, placement, qualifier, MRP,
  Q-pool, payout, or finalization fields are created in this foundation.
- Existing immutable `event_publication_states` remains untouched. A future
  lifecycle requires append-only transition events and an atomic replacement
  of every correction publication guard; running a second lifecycle in
  parallel would allow a post-publication correction race.
- The draft is never a published result and never proof that a tournament is
  complete.

## Required integrity design

- Serialize creation per event; use a locked, ordered version allocation,
  exact actor/key receipt replay, and conflict evidence for changed retries.
- Bind the selected event, source ruleset version, and scoring method in one
  server-derived composite identity; a same-tournament but different ruleset
  or scoring method is invalid. Use composite tournament/event/game foreign
  keys for every child. Forced RLS and revoked direct privileges remain
  mandatory.
- Seal the header, complete source-game/scoreline set, canonicalization
  algorithm version, lowercase-hex manifest hash, blockers, receipt, and
  audit evidence in one private transaction. Child rows have no independently
  callable insert path, and the database must reject late, missing, extra, or
  cross-game rows.
- Snapshot each game’s two server-held participant identities and enforce the
  matching live invariants: exactly two reciprocal sides for verified or
  corrected games, and no result scorelines for unresolved states. A source
  scoreline must name the same canonical game as its source-game record.
- The writer is director/co-director scoped, rechecks current role in the
  transaction and at receipt lookup, uses empty `search_path`, and returns
  only opaque draft metadata/counts/blockers.
- A correction racing creation must yield either a coherent before or after
  manifest, never mixed rows. Any failed receipt/audit write rolls back the
  draft and all children.

## Proof required before pilot application

Executed database tests must cover cross-tournament and same-tournament
wrong-ruleset/method denial, non-role and revoked-role denial, exact/changed
retry, concurrent ordered drafts, correction race coherence, stale-source
detection, blocker-only behavior, no public reads/calculations/artifacts, and
rollback fault injection. They must also reject malformed hashes, late child
appends, omitted/extra source rows, cross-game scorelines, unrelated
participants, duplicate sides, and inconsistent verified or unresolved source
facts.
