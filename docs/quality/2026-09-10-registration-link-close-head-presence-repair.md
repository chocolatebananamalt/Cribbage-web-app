# Registration-link close head-presence repair — 2026-09-10

## Finding

The compare-and-swap close transaction in migration `0078` read the link head
and then the expected link. PostgreSQL's `FOUND` flag represented only the
second query. If a malformed historical state had a matching link but no link
head, nullable composite comparisons could evaluate to NULL and skip the
rejection branch.

## Repair

Migration `0079_registration_link_close_head_presence_repair.sql` records the
outcome of both reads in `v_head_found` and `v_link_found`, then rejects unless
both are present. It retains the existing service-only function signature,
advisory lock, authorization, immutable receipt behavior, and audit trail.

## Evidence

- Applied first to disposable synthetic project `donfxulkliuyteiannir`.
- Applied to pilot `fnjkwymxpnsqvxtpronk` after the disposable catalog check.
- Both catalogs confirm: anon execute `false`, authenticated execute `false`,
  service-role execute `true`, and the deployed function contains both
  explicit presence checks.
- Regression assertions cover both flags and the fail-closed predicate.

## Remaining gate

This is source/catalog evidence, not the required seeded multi-session
concurrency matrix. The public-registration release switch remains disabled.
