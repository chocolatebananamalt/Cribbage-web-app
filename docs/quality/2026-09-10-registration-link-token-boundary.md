# 2026-09-10 Registration-Link Token Boundary

## Acceptance criteria

1. A v2 registration credential has a valid opaque UUID link ID and exactly
   256 bits of URL-safe random secret material.
2. Only an exact `link-id.secret` fragment value is accepted; a URL, path,
   query string, old token-only value, whitespace, malformed character, or
   extra segment is rejected.
3. The utility is server-only and derives a fixed 32-byte digest from a fresh
   32-byte salt and canonical credential; no database interface exists yet.
4. Equality checks use the runtime's constant-time comparison only after both
   values have the required fixed length.

## Evidence

- `src/lib/registration-link-token.ts` is marked `server-only` and uses Node
  cryptography for random generation, SHA-256 derivation, and safe equality.
- `tests/registration-link-token.test.mjs` covers valid creation/parsing,
  every rejected raw-location shape above, matching/mismatching digest paths,
  short salts, and invalid canonical values.

## Executed verification

Run locally on 2026-09-10:

```text
pnpm lint                 PASS
pnpm test                 PASS (85 tests)
pnpm build                PASS (Next.js 16.3.4)
pnpm verify               PASS (6 workspace checks)
pnpm verify:handoff       PASS (6 private-handoff checks)
git diff --check          PASS
```

This is a safe primitive only. It does not expose a new route, issue a link,
persist a token, enable registration, or retire the legacy path-token surface.
Those steps remain gated on the reviewed lifecycle migration, server-only
credential configuration, browser/network evidence, and owner-authorized
legacy retirement.
