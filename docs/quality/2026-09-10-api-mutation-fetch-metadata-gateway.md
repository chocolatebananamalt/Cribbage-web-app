# API mutation Fetch-Metadata gateway hardening — 2026-09-10

## Acceptance criterion

Every unsafe `/api/v1` request must be rejected at the shared proxy boundary
when either its `Origin` is not the application origin or the browser
explicitly identifies it as `Sec-Fetch-Site: cross-site`. Safe methods and
older clients without the optional Fetch-Metadata header must retain their
intended behavior.

## Change

`src/lib/api/mutation-origin-gateway.ts` now receives the optional Fetch
Metadata value and rejects an explicit cross-site unsafe request after the
existing exact-Origin check. `src/proxy.ts` supplies the browser header at the
single `/api/v1/:path*` gateway. Individual route guards remain compatible
defense in depth; this closes the gap in their coverage by enforcing the same
decision before every API handler.

## Regression evidence

`tests/supabase-auth-semantics.test.mjs` proves that the gateway:

- rejects missing or foreign Origins for unsafe API writes;
- accepts the exact Origin with no Fetch-Metadata header or `same-origin`;
- rejects the exact Origin when the browser explicitly reports `cross-site`;
- leaves API reads and non-v1 paths outside this write-only decision.

Executed locally in the repository on 2026-09-10:

```text
pnpm test                 PASS — 124 tests
pnpm lint                 PASS
pnpm build                PASS
pnpm verify               PASS
pnpm verify:handoff       PASS
git diff --check          PASS
```

## Limitations

These are code-level and local build checks. A real signed-in browser test
against the pilot remains a release gate, as does hosted deployment evidence
while Vercel has rate-limited new preview builds.
