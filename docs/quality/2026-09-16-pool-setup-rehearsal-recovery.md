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
- A legacy upgrade appends an approved Appendix-B ruleset rather than mutating
  the original paper ruleset or setup activation history.

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
- Applied the legacy team-ruleset upgrade and its trigger repair. A first live
  attempt failed closed because the production trigger was absent; the
  transaction rolled back without changes. After the trigger repair, the
  guarded server operation succeeded for the existing Canadian Doubles event.
  It appended a dated Appendix-B ruleset and switched only that scoreless
  event to Digital/Paper scoring. The same audited lifecycle APIs retired the
  unused Traditional Doubles event and appended **Canadian Doubles Practice**;
  the guarded operation then enabled the new practice event. Main,
  Consolation, registration, payments, seats, schedules, and score evidence
  were verified unchanged.
- Pull request #59 merged as `134a7481f64f39e2f8e36706d6a3c1f15b4e2de9`.
  Production deployment `dpl_7CVtim2mBP9AdzhvnpW918HmPAKD` is READY. Root
  returned 200; the anonymous protected setup response was 401/no-store; and
  Vercel's post-release runtime scan contained no errors.
- Applied the activation-state retired-event filter. An authorized state read
  now returns exactly four active rehearsal events, and a live protected
  desktop screen confirms the retired event is absent from the current-event
  list while the two Canadian Doubles events show Digital/Paper scoring.

## Remaining verification

- A protected primary-director browser rehearsal must still check the recovered
  event list and exercise draft Side Pool add/remove at phone and desktop
  widths.
- The physical independent-device score, cross-check, offline, finance, and
  results rehearsal remains a release gate.
