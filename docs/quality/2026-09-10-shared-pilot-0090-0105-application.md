# Shared-pilot 0090–0105 application evidence

**Date:** 2026-09-10 Hawaii time (database history recorded 2026-09-11 UTC)

## Authority and scope

The project owner explicitly approved the controlled shared-pilot update. The
named target was Supabase project `fnjkwymxpnsqvxtpronk`, ACC Tournament Pilot
Integration. The authorized scope was the exact ordered migration range 0090
through 0105. No feature switch, user fixture, score, role, correction, payment,
or tournament record was authorized for mutation.

## Acceptance criteria

- The pilot starts at logical migration 0089 and receives 0090–0105 once, in
  order.
- All seven suspended Rule 12 functions lose `authenticated`, `anon`, and
  `public` execution.
- The assigned-game context retains its caller-bound `actorId` contract.
- No direct browser table access or enabled unfinished correction workflow is
  introduced.

## Preflight

- Project status was `ACTIVE_HEALTHY` on PostgreSQL 17.6.1.166.
- Migration history ended at `0089_foreign_key_coverage`.
- The seven suspended correction functions were executable by
  `authenticated`; none was executable by `anon` or `public`.
- `tournament_roles` and the new activation/correction foundation tables had
  no role or workflow fixtures requiring preservation.
- The exact source checksums were already protected by the repository packet
  test and synthetic validation evidence.

## Application and postflight

- Applied 0090, 0091, 0092, 0093, 0094, 0095, 0096, 0097, 0098, 0099, 0100,
  0101, 0102, 0103, 0104, and 0105 sequentially through the connected Supabase
  management interface. Every application returned success.
- Migration history now records all 16 entries, from UTC timestamp
  `20260911011329` through `20260911011422`.
- A catalog grant audit reports `false` for `authenticated`, `anon`, and
  `public` execution on all seven suspended functions.
- The `get_assigned_game_context` definition contains the required `actorId`
  response contract.
- The security advisor reports only expected informational
  `rls_enabled_no_policy` notices for private `app` tables with no direct
  browser grants. The performance advisor identified seven unindexed foreign
  keys in disabled foundation workflows; those are tracked performance work,
  not an access or connected-release blocker.

## Result and limitations

The shared-pilot containment gap is closed and no database-access integration
is missing. No feature switch was enabled. A real-player authenticated score
mutation was deliberately not created as migration proof; independent-session
workflow evidence remains a separate release gate. Vercel Production values,
live deployment, and real-address magic-link delivery also remain separate
hosting/authentication checks.
