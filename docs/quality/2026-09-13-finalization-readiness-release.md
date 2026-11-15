# Event finalization readiness production release

Date: 2026-09-13 (Pacific/Honolulu)

## Reproduction

The stable production release returned HTTP 200 for `/register`, HTTP 400 for
an invalid tournament on registration-link management and setup activation,
but HTTP 404 for the same invalid-scope probe of event finalization readiness.
Because each route validates its release state before UUID input, this proved
the first three October capabilities were live and the finalization-readiness
reader was still hidden by configuration.

## Repair

- Removed the deployment switch only from the protected readiness reader.
- Preserved verified-session authentication, database-enforced director or
  co-director scope, server-only RPC access, exact response validation, and
  fail-closed incomplete results.
- Added all four release-state probes to `pnpm verify:live-demo`.
- Left online payments, SMS, and OCR under their independent default-off
  provider controls.

## Evidence

- Focused finalization/live-check contracts: 6/6 passed.
- ESLint: passed.
- Next.js production build and TypeScript validation: passed.
- `pnpm verify`: passed with 454/454 application tests, provider-fallback
  preflight, production build, and workspace checks.
- `pnpm verify:handoff`: 6/6 passed.
- `git diff --check`: passed.

The live production probe is expected to remain red until this reviewed change
is deployed. After deployment, `pnpm verify:live-demo` must pass before the
release is accepted.
