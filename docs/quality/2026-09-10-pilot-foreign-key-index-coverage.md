# Pilot foreign-key index coverage — 2026-09-10

## Acceptance criteria

- Every missing foreign-key index prefix reported by the pilot Supabase
  performance advisor has a durable local migration.
- The migration changes neither records, grants, RLS, functions, nor schema
  ownership.
- The pilot applies the exact migration successfully and a fresh advisor run
  reports no `unindexed_foreign_keys` finding.

## Change

Migration `0089_foreign_key_coverage.sql` adds 24 non-destructive B-tree
indexes for the reported foreign-key prefixes. It includes composite indexes
where a single-column index cannot cover a composite reference. This protects
referenced-row checks and expected joins as registration, seating, audit, and
setup histories grow.

## Pilot evidence

On 2026-09-10, the Supabase migration was applied successfully to pilot
project `fnjkwymxpnsqvxtpronk`. A direct catalog query confirmed representative
indexes exist. A fresh Supabase performance-advisor run had no
`unindexed_foreign_keys` finding. Its remaining `unused_index` notices reflect
the intentionally low-traffic pilot and include both existing and newly added
indexes; they are not evidence that a constraint-coverage index is redundant.

The security advisor also confirms the reviewed browser-callable RPCs have no
anonymous or PUBLIC execute grant, retain explicit authenticated execution,
and set an empty function `search_path`. The advisor continues to flag their
intentional `SECURITY DEFINER` status, which remains subject to the existing
per-function authorization and independent-session release evidence.

## Local evidence

```text
pnpm test              PASS — 124 tests
pnpm lint              PASS
git diff --check       PASS
```

The first new local test failed because it referred to a nonexistent test
helper. It was corrected before the successful run and before the pilot
migration was applied.

## Limitations

The index repair does not establish workload capacity. It must still be
exercised through a realistic tournament simulation, and the separate
authentication-provider, independent-session, backup/restore, and release
gates remain open.
