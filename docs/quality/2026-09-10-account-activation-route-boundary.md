# Account activation route boundary — 2026-09-10

**Historical status:** The default-off release conclusion is superseded by the
owner-approved October activation decision dated 2026-09-12. The authorization
and witnessed-ceremony requirements below remain in force.

## Acceptance criteria

- A director or co-director can reach issuance, witnessed decision, and
  cancellation commands only through a same-origin, authenticated,
  server-only route.
- A signed-in prospective player can redeem a fragment-cleared credential only
  through a bounded, same-origin route; browser code never receives the
  server-only Supabase credential.
- Exact request envelopes and exact database success receipts are required.
  Malformed input, a mismatched route identifier, a malformed database result,
  or an unavailable database all fail closed.
- The entire feature is not reachable unless an explicit release switch is
  turned on after private migrations and live multi-session evidence.

## Implemented evidence

- Added four release-gated Route Handlers for issuance, redemption, witnessed
  decision, and cancellation. Each checks the explicit release decision before
  origin, bounded JSON, verified subject, and server-only RPC execution.
- Added strict redemption input validation and server-only result adapters for
  decision/cancellation. The issuer still returns a bearer credential only at
  first issuance; replayed issuance never reconstructs it.
- Added executable rejection coverage for malformed database receipts,
  mismatched cancellation receipts, oversized redemption credentials, and the
  shared route-boundary controls. The normal suite now includes these tests.

## Commands and results

Run locally in the workspace on 2026-09-10:

```text
pnpm test     PASS — 145 tests
pnpm build    PASS — Next.js 16.3.4 production build
git diff --check    PASS
```

## Limitations and release decision

The private activation migrations `0090` through `0095` are still unapplied.
No page or QR ceremony exposes these routes, and
`ACC_ACCOUNT_ACTIVATION_ENABLED` defaults to false. This is correct: unit and
build evidence do not prove real authenticated sessions, database transaction
semantics, staff-role authorization, or a witnessed multi-device ceremony.
Do not enable the switch or describe this feature as live until those checks
are complete in a controlled pilot.
