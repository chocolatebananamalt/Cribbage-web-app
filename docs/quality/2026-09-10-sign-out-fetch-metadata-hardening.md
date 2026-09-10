# Sign-out Fetch-Metadata hardening — 2026-09-10

## Acceptance criterion

The session-clearing endpoint must reject cross-origin and explicitly
cross-site browser requests, return private non-cacheable rejection responses,
and retain its existing successful local sign-out and shared-device cleanup
behavior.

## Change

`/auth/sign-out` is outside the `/api/v1` proxy matcher, so it now uses the
shared `isSameOriginRequest` decision directly. That preserves the exact
Origin requirement and adds the Fetch-Metadata fail-closed behavior for an
explicit `Sec-Fetch-Site: cross-site` request. Its rejection is marked
`private, no-store`.

## Regression evidence

The shared helper test exercises exact-origin accepted, explicit cross-site
rejected, foreign-origin rejected, and absent-header compatibility cases.
The sign-out route semantic test proves it calls the shared guard while
retaining local-scope sign-out, cookie propagation, and `Clear-Site-Data`.

Executed locally in the repository on 2026-09-10:

```text
pnpm test                 PASS — 124 tests
pnpm lint                 PASS
pnpm build                PASS
pnpm verify               PASS
pnpm verify:handoff       PASS
git diff --check          PASS
```

## Limitation

Local source and build evidence cannot substitute for the required signed-in
browser test against the pilot deployment.
