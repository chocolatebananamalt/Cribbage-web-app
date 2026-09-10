# Pilot live advisor and migration recheck — 2026-09-10

## Scope

Read-only review of the connected Supabase pilot
`ACC Tournament Pilot Integration` (`fnjkwymxpnsqvxtpronk`) after the current
local security hardening changes.

## Authoritative live evidence

- Migration history reaches `20260910072735_foreign_key_coverage`, matching
  the local `0089_foreign_key_coverage.sql` repair.
- The security advisor reports 43 `app`-schema tables with RLS enabled and no
  policy. This is expected for private tables: direct `anon` and
  `authenticated` table access has been revoked and narrowly role-checked RPC
  functions are the intended surface. Adding broad RLS policies merely to
  clear this advisory would weaken the private-table design.
- The advisor reports 29 authenticated `SECURITY DEFINER` RPCs. These are the
  currently supported authenticated, role-checked RPC boundary and were
  previously catalog-audited. The review found no new anonymous/PUBLIC
  execution finding.
- The sole remaining security warning is `auth_leaked_password_protection`.
  The user has declined the paid add-on. It remains non-blocking only if the
  hosted Email/Password provider itself is disabled, because the app supports
  magic-link authentication only.
- The performance advisor reports only unused-index notices on the empty
  pilot. It reports no unindexed foreign-key finding. The indexes support
  foreign keys, immutable receipts, and future scoped reads; they must not be
  removed before representative-load evidence exists.

## Outcome

No database change was made. The recheck found no new P0/P1 schema exposure or
index gap. It does not prove real authenticated roles, independent sessions,
account activation, backup/restore, or production authentication settings;
those remain explicit release gates.
