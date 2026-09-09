# Private API failure-boundary hardening

## Acceptance criteria

For private payment, correction-policy, and roster-promotion mutations:

- a verified-claims service failure is not treated as an anonymous request;
- an unexpected request, auth, or RPC exception returns a generic `503` response;
- every route outcome is marked `Cache-Control: private, no-store`;
- existing same-origin enforcement for payment mutations, RPC authorization, request validators, idempotency, and accepted-response validators remain in force.

## Change

The three manual-payment routes, the correction-policy writer, and the roster-promotion writer now use the shared `route-boundary` helpers. The helpers obtain a verified subject through claims, distinguish a missing subject from a claims outage, apply private no-store headers to all JSON outcomes, and contain unexpected external failures.

Focused independent review found and this change repaired two additional response-contract gaps: correction-policy outcomes are now exact, request-bound objects (including the expected next version), and roster-promotion outcomes reject mixed, extra, or success-shaped rejection fields. The claims decision is isolated in a framework-independent module so its successful, missing-session, and outage cases execute in the normal test runner.

This does not add payment, roster, correction, role, or score authority. Server-side RPCs remain authoritative.

## Local evidence

Environment: Windows local workspace, Node/pnpm project configuration.

- `pnpm lint` — passed.
- `pnpm test` — 63 passed, 0 failed.
- `pnpm build` — passed.
- `git diff --check` — passed.
- `pnpm verify` — passed.
- `pnpm verify:handoff` — passed.

The regression tests execute verified-claims success, missing-session, and outage behavior; execute strict roster outcome rejection behavior; and continue to require every private route to call the shared guard and response boundary.

## Remaining limits

This is request-boundary evidence, not end-to-end production authorization evidence. Real independent authenticated browser sessions, database assertions, financial reconciliation fixtures, and the broader release gates remain required.
