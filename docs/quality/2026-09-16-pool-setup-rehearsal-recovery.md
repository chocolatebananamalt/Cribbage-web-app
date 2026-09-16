# Pool setup controls and rehearsal recovery — 2026-09-16

## Acceptance criteria

- Main and Consolation setup cards support zero through two Q Pools; Main,
  Consolation, and Satellite cards support zero through six separately named
  Side Pools, with per-row removal and visible limit state.
- A setup Side Pool is versioned, private, and materializes only into the
  existing operational Side Pool record after activation; it cannot change Q
  Pool behavior.
- An active legacy manual Canadian/Traditional Doubles event is readable as
  active state. It clears stale local finalization-retry UI and never opens
  registration a second time. A guarded, audited upgrade is available only
  for eligible unstarted supported doubles.

## Executed evidence

- `pnpm verify` — pass: production dependency audit, lint, **524/524**
  application tests, provider readiness, production build, and workspace
  verification.
- `pnpm exec tsc --noEmit` and `pnpm verify:handoff` — pass.
- Applied Supabase migration `setup_side_pool_definitions_and_recovery` to
  `fnjkwymxpnsqvxtpronk` successfully after the database rejected an initial
  missing foreign-key uniqueness constraint before any change. The corrected
  migration created the two private version/materialization tables; a
  read-only schema check confirmed both exist and that no rehearsal Side Pool
  rows were created by the migration.
- Applied `setup_side_pool_advisor_indexes` to cover the new foreign-key
  lookups. The hosted performance advisor no longer reports an unindexed
  foreign key for either new table. Its immediate “unused index” notices are
  expected for brand-new, as-yet-unused rehearsal indexes. The security
  advisor reports the two tables as RLS-enabled with no policy; that is the
  deliberate closed-by-default private-table design because direct browser
  access is revoked and only server-only RPCs are granted.

## Remaining verification

- Production deployment, protected phone/desktop review, and the primary
  director's audited retirement/upgrade/addition actions remain required
  before release evidence is complete.
- No existing registration, roster, seat, schedule, score, payment, or event
  record was altered by this work.
