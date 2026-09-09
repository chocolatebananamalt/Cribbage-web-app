# API mutation origin gateway — 2026-09-09

## Scope

The shared Next request gateway now rejects cross-origin mutation requests to every
`/api/v1/` route before the route handler, Supabase client, or RPC runs.  This
closes a consistency gap in which newer mutation routes could accidentally omit
their own same-origin check.

## Acceptance criteria

1. Every non-`GET`/`HEAD`/`OPTIONS` request under `/api/v1/` must have an
   `Origin` header exactly matching the request origin before it reaches a route
   handler.
2. A rejected request returns only a generic `403 invalid_origin` response with
   `Cache-Control: private, no-store`.
3. Read and preflight methods retain their existing behavior.
4. This defense does not replace route-level authentication, authorization,
   input validation, idempotency, or database-RPC enforcement.

## Evidence

On the local Windows workspace after the gateway and its static regression
checks were added:

- `pnpm lint` — pass.
- `pnpm test` — pass, 58 tests.
- `pnpm build` — pass.
- `git diff --check` — pass.

The regression test asserts that the gateway scopes to API v1, compares the
incoming origin to the effective request origin, returns the generic error, and
sets the non-cacheable header.

## Limitation / remaining release evidence

The automated check is source-level.  A real browser test must still demonstrate
that same-origin authenticated mutations succeed and a cross-origin POST is
rejected against a disposable authenticated backend.  That evidence remains
within the existing multi-session release gate.
