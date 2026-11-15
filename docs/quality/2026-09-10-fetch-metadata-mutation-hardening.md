# Fetch-Metadata mutation hardening — 2026-09-10

## Finding

All implemented API mutations already required an exact `Origin` match. They
did not additionally reject an explicit browser Fetch-Metadata signal stating
that the request was cross-site.

## Repair

The shared `isSameOriginRequest` helper now requires the exact origin and, if
`Sec-Fetch-Site` is present, requires `same-origin`. Missing Fetch-Metadata is
accepted for compatibility with older clients; it does not weaken the existing
exact-Origin requirement. An explicit `cross-site` request fails closed.

This defense applies uniformly to the existing same-origin mutation routes and
sets the required baseline for the future server-authorized account-pairing
redemption route.

## Executed verification

- The regression test proves exact-origin and same-origin metadata accept,
  while cross-site metadata and a mismatched origin reject.
- `pnpm test` — 124 passed, 0 failed.
- `pnpm lint`, `pnpm build`, `pnpm verify`, `pnpm verify:handoff`, and
  `git diff --check` — passed.

Browser network evidence remains a release gate; static request-shape tests do
not replace independent browser-session verification.
