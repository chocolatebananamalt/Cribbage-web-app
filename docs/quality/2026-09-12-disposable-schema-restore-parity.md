# Disposable schema restore parity — 2026-09-12

## Acceptance criteria

- Reconstruct the current database schema in the owner-approved disposable
  Supabase project without copying pilot or private player records.
- Match the pilot's structural catalog counts through the current migration.
- Leave both environments with no advisor-reported unindexed foreign key.
- Record any repair as an idempotent repository migration and verify it through
  the normal application gate.

## Executed evidence

- Applied migrations `0111` through `0151` sequentially to disposable project
  `donfxulkliuyteiannir`; all 41 operations succeeded.
- The first comparison found matching table, column, constraint, and function
  counts but 24 fewer relationship indexes in the older restore lineage. The
  disposable performance advisor independently reported 24 unindexed foreign
  keys.
- Added `0152_restore_parity_foreign_key_indexes.sql` with exactly those 24
  idempotent indexes. Applied it to both the pilot and disposable projects.
- Final catalog counts match in both environments: 105 `app` tables, 1,091
  `app` columns, 959 `app` constraints, 599 `app` indexes, and 212
  `app`/`public` functions.
- Both Supabase performance advisors report zero unindexed foreign keys. Their
  remaining findings are unused-index information expected in a low-volume
  validation database.

## Boundary

This proves current schema reconstruction and relationship-index parity. It
does not copy or restore private pilot rows. The final private-record backup,
content checksums, and isolated content restore remain a supervised rehearsal
under `docs/operations/OCTOBER_PILOT_REHEARSAL.md`.
