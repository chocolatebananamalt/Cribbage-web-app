# API cache-boundary regression guard — 2026-09-09

## Scope

Prevent a future API route from returning a cacheable response containing
tournament, identity, or operation information.

## Finding and resolution

Manual inspection confirmed that current API v1 routes use either `apiJson`
(which always applies `Cache-Control: private, no-store`) or the narrow
`privateNoStore` route configuration. The proxy continues to apply same-origin
rejection for all API v1 mutations before route execution.

Added an executable test that discovers every `src/app/api/v1/**/route.ts`
file and requires that private response boundary. A new route cannot silently
omit it without failing the application test suite.

## Executed evidence

- `pnpm lint` passed.
- `pnpm test` passed with 79 tests, including the route-discovery assertion.
- `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and `git diff --check`
  passed.

## Limit

This proves source-level routing conventions and the production build. It does
not replace hosted authenticated route checks or database authorization tests.
