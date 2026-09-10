# Live pilot security and migration-parity review — 2026-09-10

## Scope

Read-only review of the shared pilot Supabase project. No data, authentication
setting, grant, function, or migration was changed.

## Security result

The live security advisor reported private `app`-schema tables with RLS and no
browser-table policies. That is intentional: direct browser table access is
revoked and application operations use narrowly granted RPCs.

A catalog query inspected every `public` `SECURITY DEFINER` function:

- no function was executable by `anon`;
- every function executable by `authenticated` had an empty configured search
  path and an explicit `auth.uid()` identity check;
- older administrative functions remain non-executable by `authenticated`.

The advisor’s signed-in-function warning is therefore an expected inventory
notice, not a permission finding. It must be rechecked after every migration
or grant change.

## Migration-parity result

The shared pilot’s latest migration is `0089_foreign_key_coverage`; source
contains migrations `0090` through `0103` not yet applied there. In particular
`0103_assigned_game_context_actor_scoped_retry.sql` adds the `actorId` response
field required by current score retry isolation. The deployed app now detects
that incompatibility and renders no scoring controls; see
`2026-09-10-assigned-game-context-contract-gate.md`.

This review does not authorize applying the missing migrations to the shared
pilot. They include unfinished-feature safety suspensions and activation/
correction foundations, so release migration selection requires a separately
reviewed, explicitly authorized pilot-change window.
