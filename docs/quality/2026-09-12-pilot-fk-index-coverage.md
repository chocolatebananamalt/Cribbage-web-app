# Pilot foreign-key index coverage

Date: 2026-09-12
Environment: approved Supabase pilot

## Acceptance criteria

- Every composite foreign key newly introduced by setup amendments, Rule 12
  corrections, playoff placement, and settlement v3 has a covering index.
- The change is idempotent and changes no scoring, financial, authorization,
  or user-data behavior.
- The hosted Supabase performance advisor reports no remaining unindexed
  foreign-key finding.

## Change and evidence

- Added and applied recorded migration
  `0143_pilot_fk_index_coverage.sql`, containing 11 `CREATE INDEX IF NOT
  EXISTS` statements for the exact advisor-reported foreign-key column paths.
- `tests/pilot-fk-index-coverage.test.mjs`: PASS; all 11 expected index names
  and column sequences are present and idempotent.
- Supabase migration history records `pilot_fk_index_coverage`.
- Hosted Supabase performance advisor after the migration reports only
  `unused_index` informational observations. It reports zero
  `unindexed_foreign_keys`, warning, or error findings.

Unused-index observations are expected on a newly created pilot database and
are not grounds for removing referential-integrity indexes before realistic
tournament traffic exists.
