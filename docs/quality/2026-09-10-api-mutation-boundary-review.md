# API mutation-boundary review — 2026-09-10

## Acceptance criteria

- Every `/api/v1` state-changing route is covered by the shared Proxy origin
  gateway before its route handler executes.
- No API route reaches an application table directly; routes use narrow RPC or
  server-only command boundaries instead.
- Every POST route preserves the standard private no-store failure boundary.

## Review result

The route inventory contains 27 API routes. The score submission and
confirmation routes rely on the shared Proxy gateway rather than a duplicated
per-route origin check. `src/proxy.ts` applies the gateway to
`/api/v1/:path*` before session refresh or any route handler; its decision
rejects unsafe non-safe methods with an origin mismatch or explicit cross-site
fetch metadata.

Added a repository-wide regression that enumerates all API routes and rejects
direct database-client `.from(...)` table access. It also requires every POST
route to retain the project’s private unavailable-operation failure boundary
and asserts that the Proxy keeps the API matcher and origin-gate call. This is
a static regression, not a replacement for an independent authenticated
browser CSRF test.
