# Tournament setup official-choice bootstrap — pilot evidence

Date: 2026-09-09
Environment: connected Supabase pilot `fnjkwymxpnsqvxtpronk`; local Node 24 / pnpm workspace.

## Scope

Focused UI review found that a co-director could not create setup version 1:
the empty configuration reader had no director identity, while the writer
correctly requires the canonical director in every official snapshot. Migration
`0056` provides a narrow, current-role-gated official-choice bootstrap RPC.

## Evidence

- A rollback-only fixture with a current director received the canonical
  `directorProfileId` and current co-director choices. A non-member claim
  received `NULL`; the fixture was rolled back.
- The RPC is `SECURITY DEFINER` with empty search path, has no writes, denies
  `public` and `anon`, and is executable by `authenticated` only.
- Returned identifiers are choices only. The setup writer remains authoritative
  and independently verifies every official still holds the same current role.

## Remaining limits

The protected UI/API is not built yet. It must fetch this bootstrap data only
for a current official and surface a server-side stale-role rejection rather
than trusting a previously displayed choice.
