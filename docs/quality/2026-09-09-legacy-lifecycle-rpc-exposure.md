# Legacy lifecycle RPC exposure closure — 2026-09-09

## Scope and acceptance criteria

The browser must reach check-in, initial seating, roster-account linking, and
Standard Singles event enrollment only through their v2 receipt-bound wrappers.
The older writer functions are implementation details: an authenticated browser
session must not be able to invoke their unbound response shapes directly.

Acceptance required:

1. `authenticated` cannot execute any of the four legacy lifecycle writers.
2. `authenticated` can execute their v2 wrappers; `anon` can execute neither
   generation.
3. A v2 wrapper remains fail-closed without a current eligible official.
4. No production application code calls a legacy writer RPC directly.

## Implementation

Applied pilot migration `0066_revoke_legacy_lifecycle_rpc_execute`. It revokes
only `authenticated` execution on the exact legacy check-in, seating,
roster-account-link, and event-enrollment signatures. The wrappers remain
`SECURITY DEFINER`; PostgreSQL evaluates their internal calls using the
function owner's privileges, not the caller's revoked privileges.

## Executed evidence

- Pilot catalog before the migration: all four legacy writers were callable by
  `authenticated`.
- Pilot catalog after the migration: every legacy writer is unavailable to
  `authenticated` and `anon`; every v2 wrapper is available to `authenticated`
  and unavailable to `anon`.
- Pilot unauthenticated smoke calls: all four v2 wrappers returned SQL `null`.
- `pnpm test` — pass, 71 tests.
- `pnpm lint`, `pnpm build`, `pnpm verify`, and `pnpm verify:handoff` — pass.
- Focused independent Sol review — no P0/P1 findings. It confirmed that all
  eight functions are owned by `postgres`, so the four v2 `SECURITY DEFINER`
  wrappers retain their intended internal access after the revoke.

## Limitations

This removes a direct-RPC bypass; it does not provide a real independent
authenticated browser lifecycle test, account-link UI/protocol, seating UI,
or an approved rotation policy. Those remain separate release requirements.
