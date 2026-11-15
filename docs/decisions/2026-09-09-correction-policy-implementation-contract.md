# Configurable correction-policy implementation contract — 2026-09-09

## Why this contract exists

The current correction foundation safely implements the user-approved default:
immediate authority with an optional reason. It does **not** yet implement the
director options to require a reason or require independent approval. This is a
release-blocking `R-CORR-01` gap, not a UI-only preference.

## Required database design

- Store correction policy as immutable, append-only `app.correction_policy_versions`
  rows. A row contains tournament, monotonically increasing policy version,
  `reason_required`, zero-or-one required approvals, creator, and timestamp.
  The highest version is active; there is no mutable `current` flag.
- Seed policy version 0 for existing tournaments as optional reason/no approval;
  provision it for new tournaments. Each correction snapshots its exact policy
  through `(tournament_id, policy_version)`.
- Only a director or co-director can append a policy version through a narrowly
  granted, idempotent SECURITY DEFINER RPC. The client never selects a version.
- `propose_game_correction` must lock game and tournament, load the current
  policy, and enforce a bounded nonblank reason when required. It retains all
  existing authenticated, Standard Singles, non-self, version, and open-event
  guards.
- A zero-approval policy appends `applied` and atomically updates both reciprocal
  scorelines plus the canonical game exactly once. A one-approval policy appends
  only `pending`; it must leave canonical score, scorelines, standings,
  publication, and export unchanged.
- A separate authenticated `review_game_correction` RPC may approve or reject a
  pending correction. The reviewer must be an eligible cross checker, director,
  or co-director, must not be the correction editor or either player, and must
  be authorized at decision time. Approval rechecks the stored policy, game
  version, source result, tournament/event/ruleset eligibility, and publication
  state before atomically appending `approved`/`applied` and updating projections.
  Rejection appends `rejected` only.
- Add a private deferred correction lifecycle invariant: immediate corrections
  have one applied event; approval-required corrections are pending, pending then
  rejected, or pending then approved then applied. No correction can be both
  applied and rejected, and only one unresolved correction may exist per game.
- Published-result corrections fail closed until immutable result versions and
  supersession exist. Both proposal and approval recheck publication so a
  publication race cannot alter a published result in place.

## Required proof before release

1. Immediate default and required-reason rejection tests.
2. Pending correction leaves game, scorelines, standings inputs, and export
   inputs byte-for-byte unchanged.
3. Eligible independent cross-checker/director approval; editor, player,
   unauthorized, revoked-role, stale, and cross-tournament rejection tests.
4. Policy snapshot survives later policy changes.
5. Concurrent proposal/review, exact replay, changed replay, and fault rollback
   tests.
6. Direct-table mutation and illegal lifecycle-state rejection tests.
7. Original submissions, confirmations, verification receipt, and verification
   audit remain unchanged after a correction.

## Sources

- User correction decisions, 2026-09-06.
- `docs/product/production-requirements.md` R-CORR-01 and section 5.4.
- Focused Sol scoring/security design review, 2026-09-09.
