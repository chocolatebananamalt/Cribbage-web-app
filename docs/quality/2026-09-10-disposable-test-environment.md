# Disposable Supabase test environment — 2026-09-10

## Purpose and scope

The existing empty Supabase project, **chocolatebananamalt@gmail.com's
Project**, was approved by the owner as a disposable test environment. It is
separate from the ACC Tournament Pilot Integration project. No pilot data,
credentials, player records, or real tournament data were copied into it.

## Acceptance criteria

1. At the time of this evidence, the ordered `0001`–`0068` database migration
   chain applies to the test project without a migration failure. This is a
   historical baseline, not a claim that the shared pilot has that exact
   schema level today.
2. The resulting private data model has the same intentional access boundary
   as the pilot: every `app` table has RLS, no `app` table policy grants a
   browser role access, and no `app` function is executable by `anon` or
   `authenticated`.
3. Only the reviewed public RPC surface remains executable: two anonymous
   registration RPCs and 31 authenticated role-aware RPCs.
4. No change is made to the pilot project.

## Executed evidence

- Applied every migration from
  `database/migrations/0001_vertical_slice_core.sql` through
  `database/migrations/0068_revoke_browser_roster_account_link.sql`, in
  numeric order, using the Supabase migration operation against the disposable
  project. All 68 operations succeeded.
- Queried Supabase migration history: 68 recorded migrations.
- Queried PostgreSQL catalog grants and RLS state:
  - 40 `app` tables; all 40 have RLS enabled.
  - 0 `app` policies (the schema is private and RPC-mediated).
  - 0 `app` functions executable by `anon`.
  - 0 `app` functions executable by `authenticated`.
  - 2 intentionally anonymous public registration functions.
  - 31 intentionally authenticated public RPCs.
- Ran Supabase security and performance advisors. The security notices match
  the intended private-RLS/RPC-only design; the empty database naturally
  reports unused-index observations, which are not a basis for removing
  integrity indexes before representative-load testing.

## Result and limitations

The disposable database is ready for synthetic authorization, concurrency,
and transaction tests. This is schema/grant evidence only. It does not prove
real independent browser sessions, authentication provider settings, offline
recovery, ACC scoring/qualification/payout fixtures, results finalization,
backup/restore, or a simulated tournament. Later migrations and later test
evidence are tracked separately; the current shared-pilot parity position is
in `docs/quality/2026-09-10-live-pilot-security-and-parity-review.md`.
