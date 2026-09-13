# Event result-draft acceptance — 2026-09-09

The pilot currently contains none of the result-draft, source-manifest,
blocker, or export-artifact tables. The next migration must prove the following
before it is applied outside a disposable database:

- The writer creates an immutable event-scoped source manifest and blocker
  evidence in one transaction, with no placement, qualifier, payout,
  finalization, publication, or export fields.
- It derives event, ruleset, scoring method, canonical games, scorelines, and
  unresolved state only from locked server rows, and binds the derived event,
  ruleset, and scoring method together so no same-tournament substitution is
  possible.
- It rejects unauthenticated, cross-tournament, non-official, revoked-role,
  malformed, changed-idempotency, and stale-scope requests.
- Same-key replay returns the exact stored receipt. Concurrent creates receive
  distinct ordered versions; no unlocked `max(version)+1` allocation is used.
- A correction concurrent with snapshot creation produces a coherent before or
  after manifest, never mixed source facts. A later correction leaves a draft
  immutable and makes its current-source comparison fail.
- Failure to record any child, receipt, or audit record rolls back all draft
  rows. The canonicalized lowercase-hex hash, complete expected child set,
  and blocker evidence are sealed atomically; direct `anon` and
  `authenticated` table access is denied.
- Database rejection tests prove that no child can be appended after sealing;
  that each scoreline names its source game and one of its exact participants;
  and that source-game state, winner, margin, sides, game points, and
  Plus/Minus facts remain reciprocal and coherent.
- Missing approved rules, unresolved verification/correction, finance
  reconciliation, or export mapping produce blocker evidence only. They never
  cause official calculation, artifact generation, or publication.
