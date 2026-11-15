# Scoped-secret RPC authority repair verification

Date: 2026-09-12
Environment: local Windows worktree, approved Supabase pilot, Vercel Production

## Reproduced failure

After production deployment `dpl_9da4TD7pjVyaTXtMZWWgmcGyrpPA` reached READY,
the authenticated October Main Event Results screen loaded, but its Event
Dispute Register link returned HTTP 404. Direct database execution returned a
valid empty dispute workspace for the same actor, tournament, and event.

## Root cause and repair

Migrations `0138` and `0141` added a secondary check for the legacy
`request.jwt.claim.role` setting. Supabase scoped secret API keys authorize the
request through the `service_role` database role and function EXECUTE grant,
but do not populate that legacy setting. The check therefore returned null in
the deployed application even though the caller already held the only allowed
database role.

Migration `0142_secret_key_rpc_authority_repair.sql` removes the obsolete GUC
check from only the affected RPCs. It preserves and reapplies the existing
database boundary: EXECUTE remains revoked from `public`, `anon`, and
`authenticated`, and granted only to `service_role`. All passed-actor staff
role checks, tournament/event scope checks, non-self constraints, advisory
locks, immutable evidence, audit records, and idempotency checks remain.

## Evidence

- Migration `0142` applied and is recorded in the approved Supabase pilot.
- Hosted privilege query: `service_role=true`, `authenticated=false`,
  `anon=false` for `get_event_dispute_workspace_v1`.
- A hosted transaction using `SET LOCAL ROLE service_role` with no legacy
  per-claim GUC reached the normal request validators for dispute creation,
  qualification finalization, and settlement-v3 saving; all three returned the
  expected `invalid_request` code instead of an authority failure, then rolled
  back.
- Authenticated external-Chrome production retest: the Event Dispute Register
  loads and reports no published game eligible and no open disputes for the
  current October Main Event.
- `pnpm verify`: PASS — dependency audit, lint, 365/365 application tests,
  Next.js 16.3.4 production build, workspace and handoff-safety checks.
- `pnpm verify:handoff`: PASS — 6/6.
- `git diff --check`: PASS with line-ending notices only.

## Release limitation retained

Rule 12 correction UI remains closed pending separate independent-session
browser proof. This compatibility repair does not enable that feature flag.
