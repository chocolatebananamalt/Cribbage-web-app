# Standard Singles settlement draft verification

**Date:** 2026-09-11
**Scope:** migrations 0133/0135, director application workflow, and rollback-only hosted fixture

## Acceptance criteria

- Exact qualification version, activated event revision, director role,
  expected draft version, and idempotency are enforced server-side.
- Placements are sequential unique qualifier claims with winner and runner-up;
  awards are qualifier-bound and Q-pool references cannot cross setup scope.
- Active manual receipts and expenses are copied into immutable source rows.
- Every response remains unreconciled and cannot claim official MRP, payout,
  publication, approval, or export authority.
- Exact replay, changed retry, stale version, unsupported MRP, and unconfigured
  Q-pool behavior are covered.

## Executed checks

- `pnpm verify` — pass: audit, lint, 319/319 application tests, production build, and workspace checks.
- `pnpm verify:handoff` — pass, 6/6.
- Independent Sol high-risk review — GO; no remaining P0/P1.
- Hosted migrations 0133 and 0135 — applied successfully to the approved pilot.
- Hosted rollback fixture — pass after adding the required synthetic setup-official row; no fixture data retained.
- Supabase performance advisor — zero unindexed foreign keys after migration 0135.

## Remaining proof

The hosted fixture rolled back all data and asserted accepted save, exact replay, version-2
supersession, role-scoped reader, server totals, stale-version rejection,
changed-retry conflict preservation, MRP rejection, same-event Q-pool binding,
and service-only grants. Production browser proof remains pending deployment;
the pilot currently has no finalized qualification snapshot, so the settlement
page must remain unavailable there until an event is actually completed.
