# API mutation origin gateway — 2026-09-09

## Scope

The shared Next request gateway now rejects cross-origin mutation requests to every
`/api/v1/` route before the route handler, Supabase client, or RPC runs. Its
explicit API matcher includes API paths that look like static assets, so a future
unusual route suffix cannot bypass the gateway through the ordinary page/static
matcher. This closes a consistency gap in which newer mutation routes could
accidentally omit their own same-origin check.

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
- `pnpm test` — pass, 59 tests.
- `pnpm build` — pass.
- `git diff --check` — pass.

The regression test executes the extracted gateway decision for a same-origin
POST, cross-origin POST, missing-origin POST, all three safe methods, a non-v1
API path, and an API mutation path ending in `.jpg`. It also asserts the explicit
API matcher and generic non-cacheable rejection response.

## Focused review and repair

A focused Sol security review found no P0 and two P1 issues before the change was
accepted: the prior general matcher could exclude future API paths ending in a
static-looking extension, and source-text assertions would not prove the
decision. The explicit literal API matcher and executed decision/rejection
configuration coverage above close both findings. The production build also
verified the framework's requirement that exported matchers remain literal.

## Limitation / remaining release evidence

The automated check is source-level.  A real browser test must still demonstrate
that same-origin authenticated mutations succeed and a cross-origin POST is
rejected against a disposable authenticated backend.  That evidence remains
within the existing multi-session release gate.
