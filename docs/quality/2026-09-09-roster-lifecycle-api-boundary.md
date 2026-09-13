# Roster lifecycle API boundary — 2026-09-09

## Scope and acceptance criteria

This historical pass made two pre-existing private transitions callable through
the application. A later identity review found that the roster-link endpoint
accepted a raw profile ID and conflicted with the approved witnessed
activation ceremony. Applied pilot migration
`revoke_browser_roster_account_link` removes its browser execution and the
application route is deleted pending that safer server-only implementation.
Event enrollment remains separately bounded.

Acceptance required:

1. The application accepts only same-origin, claim-verified request shapes with UUID identifiers and one idempotency key.
2. Accepted or rejected browser envelopes must match the exact underlying operation and be backed by a current-official, actor/tournament/operation/target/idempotency/request-hash scoped receipt.
3. Missing, unreceipted, malformed, wrong-operation, or revoked-role results fail closed as generic private `503` responses.
4. No route accesses tables directly or uses a service-role secret; database operations remain authoritative for roles, identity independence, check-in, lifecycle, digital-event approval, enrollment uniqueness, receipts, and audit history.

## Implementation

- Applied pilot migration `0065_roster_lifecycle_operation_response_binding`.
- Added authenticated, empty-search-path `SECURITY DEFINER` wrappers for the existing link/enrollment writers. Each requires the current director/co-director role before invocation and in the receipt lookup, recomputes the legacy writer's exact request hash, and returns SQL `null` if no current authoritative receipt proves the response.
- Added the private event-enrollment route:
  - `POST /api/v1/tournaments/:id/event-enrollments`
- Added strict request/response validators and regression coverage for extra fields, malformed IDs, cross-operation codes, wrong operation/tournament identifiers, and forbidden direct data access.

## Executed evidence

- Before migration, the pilot had no receipts for either underlying operation type.
- `pnpm lint` — pass.
- `pnpm test` — pass, 70 tests.
- `pnpm build` — pass; both routes are present as dynamic application routes.
- `pnpm verify` and `pnpm verify:handoff` — pass.
- Focused independent Sol review — no P0/P1 findings after the regression suite was strengthened to pin the full canonical SHA-256 receipt fingerprint, every request-bound identity, and the stored-receipt-only return paths.
- Pilot database catalog audit — both v2 wrappers are `SECURITY DEFINER` with an empty search path, executable by `authenticated` but not `anon`, and retain the post-write current-official-role predicate. Calls without a current official role returned SQL `null` for both wrappers.
- Follow-up identity decommission — applied the additional `0068` revoke
  before source deployment. Live catalog privilege checks now prove that both
  roster-link signatures deny `anon` and `authenticated`, while
  `service_role` retains internal execution and the separate event-enrollment
  v2 wrapper remains available to `authenticated` and `service_role` but not
  `anon`.
- Focused Sol review — no P0/P1 code defect. It required the live revoke and
  catalog proof before treating the decommission as integrated; both are now
  present.

## Limitations

- Real independent director/player sessions, the witnessed account-link
  activation protocol, event selection UI, concurrent role-revocation test,
  and persisted lifecycle assertions are not yet available and remain release
  evidence requirements.
- No browser route accepts a profile ID for linking. The future activation flow
  must learn it from verified server claims; the app must never discover
  profiles by player-name or email inference.
- A disposable fresh-chain execution and real authenticated browser denial
  remain release evidence requirements. The existing pilot’s effective ACL is
  verified, but static migration coverage does not replace those checks.
- This does not complete registration, check-in, seating, rotation, or scoring. It closes only the missing private application boundary between existing database transitions.
