# Proposed production architecture

Status: proposed, not implemented. This is the structural guardrail for the full sanctioned-tournament suite and must remain aligned with the stable IDs in `docs/product/production-requirements.md`.

## Boundaries and modules

- `src/features/registration/`: roster identity, registration, check-in, shared-device clearing, roles, and seating (`R-REG-01`, `R-ROLE-01`).
- `src/features/events/`: tournament/event lifecycle, templates, rotation configuration, finalization, and format/scoring-method declarations (`R-OPS-01`, `R-FINAL-01`, `R-BOUND-01`).
- `src/features/scoring/`: Standard Singles score entry and paper-card presentation only; no single-margin-only model (`R-SCORE-01`).
- `src/features/verification/`: independent submissions, confirmations, hybrid/paper pending states, mismatch handling, offline replay, and concurrency (`R-VERIFY-01`, `R-OFFLINE-01`).
- `src/features/officials/`: judge/cross-check assignment, rulebook reference/cache permission, disputes, corrections, and audit (`R-RULE-01`, `R-CORR-01`).
- `src/features/flyers/`: Main, Consolation/Consy, Satellites, custom events, Muggins disclosure, and manual/imported format labels (`R-FLYER-01`).
- `src/features/results/`: standings inputs, qualification/high-non-qualifier fixtures, paid placement amounts, versioned publication, and scoring-method labels.
- `src/features/finance/`: fees, ACC Sanctioning Fee, Q-pools, payouts, expenses, reimbursements, attachments/classification, reconciliation, and reporting (`R-FIN-01`, `R-ATTACH-01`).
- `src/domain/`: pure calculations and versioned rulesets/fixtures. Every official calculation has a source/effective date.
- `src/server/`: authenticated mutations, tournament-scoped authorization, transaction boundaries, idempotency, and audit writes (`R-ROLE-01`, `R-OFFLINE-01`).
- `src/components/`: accessible controls/tables; no security decisions in UI code.
- `database/migrations/`: schema, RLS/policies, constraints, and indexes.
- `tests/unit/`, `tests/integration/`, `tests/e2e/`: map test names to the stable requirement IDs.

## Canonical data model

The canonical chain is:

`tournament → event → round → canonical_game → card_scoreline(player/card side) → independent_submission → confirmation → verification/correction audit → result_version → export_artifact`.

`canonical_game` is the single identity for one played game between two card sides. Each side has its own `card_scoreline` linked to the same game, including game points, plus, minus, player, opponent, Table/Seat, and source/method. Matching digital verification initially produces reciprocal projections, but the canonical game must never erase independent card claims. ACC Rule 12.2 may require adjudicated projections that are not reciprocal between the two cards; corrections must preserve the original claim, per-card adjudicated value, source case, and all affected derived totals atomically while retaining the audit record (`R-SCORE-01`, `R-CORR-01`). The preliminary shared winner/margin correction writer is suspended pending that replacement design.

Separate entities include: `profiles`, `tournaments`, `tournament_roles`, `registrations`, `shared_device_sessions`, `events`, `rounds`, `seat_assignments`, `canonical_games`, `card_scorelines`, `independent_submissions`, `confirmations`, `offline_operations`, `disputes`, `judge_assignments`, `cross_checks`, `corrections`, `audit_events`, `result_versions`, `ledger_entries`, `attachments`, `ruleset_versions`, `export_artifacts`, and `publication_versions`.

Templates reference configuration only. Duplication must never copy registrations, identities, scores, payments, corrections, attachments, or private notes.

## Verification, roles, and offline security

Server transactions and a normalized side-pair assignment key—`(event_id, round_id, match_instance, min(side_a_player_id, side_b_player_id), max(side_a_player_id, side_b_player_id))`—prevent duplicate official games for one event/round assignment. A legitimate rematch or corrected assignment gets an explicit `match_instance`/assignment version; it never bypasses the uniqueness constraint by replaying the same client operation. Offline/client retries use an authenticated operation ID and idempotency record: a replay returns the original outcome, while a stale/conflicting version is quarantined for review rather than creating a second game. Independent submissions remain hidden from the other actor until comparison. Every query and mutation is scoped to an authorized tournament/event and server-enforced role. A context-only four-digit PIN is restricted to the approved check-in/shared-device/player-confirmation context; it is not account access or a role grant.

Offline operations carry authenticated actor/session binding, tournament/event/card scope, client operation ID, schema version, timestamp, and integrity protection. The server reauthorizes, validates, idempotently applies or quarantines each operation, detects stale/conflicting canonical state, and records the outcome. `PendingSync` and `Conflict` are local/server workflow states, never verification states. A local success message cannot change standings or publication.

## Results, finance, and export

`result_versions` are immutable publication snapshots. Corrections to published results create a new version with a supersedes link. `export_artifacts` are internal, director-assisted, versioned artifacts (`acc-results-v1` pending ACC golden contract), never implied portal imports. Finance remains private and reconciles against the approved result version; attachments are classified and access-controlled before finalization.

Non-singles events are represented with `scoring_method = manual|imported` until a separately approved ruleset exists. They must never be presented as digitally scored or verified by the Standard Singles engine.

## Local schema contract

`database/migrations/0001_vertical_slice_core.sql` is an unapplied first draft in private schema `app`. Profiles reference `auth.users`; core/history records use restrictive foreign keys with no destructive cascades. Tournament/event/ruleset/round/game relationships are composite-scoped, games have exactly two assigned sides and table/seat snapshots, and normalized side-pair uniqueness prevents duplicates. Immutable submissions store each assigned player’s winner/margin in one of two slots. A game supports exactly two distinct confirmation actors, including a player confirming their own submission; each confirmation binds one exact submission. Game state/version covers pending, submitted, mismatch, confirmation-pending, verified, and corrected; deferred checks prevent pending games from having canonical scorelines and require matching submissions, two reciprocal scorelines, and two confirmations before initial digital verification. The draft's corrected-state reciprocal constraint is not a complete Rule 12.2 model and may not be used for paper-card discrepancy correction; see the 2026-09-10 Rule 12.2 decision. Idempotency is unique only by actor/client operation; future RPCs must compare request hashes. Every table is RLS-enabled/forced and direct `anon`/`authenticated` DML is revoked; no broad policies or public RPCs exist yet. The contract is validated statically by `tests/schema-contract.test.mjs`. Applying it to Supabase remains gated on auth, role policies, transaction tests, and recovery procedures.
