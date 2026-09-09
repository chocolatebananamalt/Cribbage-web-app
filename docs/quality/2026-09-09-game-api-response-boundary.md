# Game API response-boundary hardening — 2026-09-09

## Scope

The two server-authoritative Standard Singles scoring mutations now share a
failure boundary. A claims-service error or thrown client/RPC failure produces a
generic, private, non-cacheable `503`; a successful claims lookup with no
verified subject produces `401`. Every explicit response is private and
non-cacheable.

The routes no longer accept arbitrary non-rejected RPC output as a successful
submission or confirmation. Submission responses must bind both the requested
game and submission identifiers; confirmation and rejected responses must bind
the requested game and use an allowlisted status shape. Malformed, array,
null, cross-bound, or unexpected responses fail closed as `503`.

The shared request proxy also contains an auth-refresh exception rather than
allowing it to become a framework error before the route boundary runs.

## Evidence

- Focused Sol API review identified the permissive scoring response and
  auth-failure handling as P1 risks.
- `pnpm lint` — pass.
- `pnpm test` — pass, 60 tests, including executable acceptance/rejection
  tests for response binding.
- `pnpm build` — pass.
- `git diff --check` — pass.

## Deliberate limit

This closes only the scoring-route and shared-proxy portion of the wider API
review. Registration, correction, payment, policy, and roster-promotion routes
still require the same systematic failure/DTO/reconciliation hardening before
the broader finding is closed. Real two-account browser/database assertions
remain a separate production release gate.
