# Site-wide Content Security Policy hardening — 2026-09-10

## Acceptance criteria

- Every matched application response receives a nonce-bound Content Security
  Policy, rather than limiting that isolation to the credential-fragment
  registration pages.
- Browser connections remain limited to the application origin and the
  configured Supabase service needed for passwordless authentication.
- The policy independently forbids framing and plugin content.
- The change must preserve the no-index, no-referrer, no-store API, and
  passwordless sign-in boundaries.

## Change

`src/proxy.ts` now creates one nonce-bound policy for every matched app route
and passes it into the Next request headers before rendering. This lets Next
attach the nonce to its own required scripts and styles. The policy permits:

```text
default-src 'self'
connect-src 'self' https://*.supabase.co wss://*.supabase.co
object-src 'none'
frame-ancestors 'none'
base-uri 'none'
form-action 'self'
```

The existing strict-dynamic script policy and production style nonce remain in
place. Supabase is the only current cross-origin browser endpoint. Adding any
future browser integration requires an intentional allow-list review.

## Evidence and limitation

- `pnpm verify` passed: production dependency audit, lint, 153 tests,
  optimized Next build, and workspace checks.
- `pnpm verify:handoff` passed: 6 private-handoff integrity checks.
- GitHub Actions run `34480749402` passed for commit `d62372f`.
- A local optimized production-server check after the error-path fix proved
  that a cross-origin `POST /api/v1/games/example/submissions` returned `403`
  with `{"error":"invalid_origin"}` **and** the CSP. A deliberately
  unconfigured `GET /sign-in` returned the expected safe `503`, `no-store,
  private`, and the CSP. This verifies both error responses at runtime without
  using credentials or sending a sign-in email.
- The automated local browser verifier is not installed on this workstation.
  The available browser-control tools reject localhost before the development
  server receives a request, so no local visual result is being represented as
  evidence.
- The Vercel deployment screen confirms that the connected Git source is
  correct, but the Hobby plan has reached its daily code-deployment limit:
  “Resource is limited - try again in 24 hours (more than 100, code:
  `api-deployments-free-per-day`).” The latest available hosted preview remains
  `dpl_DmcKzD2g5vDkgkxm5PAxkpe5UG48` from earlier commit `4faa088`, so it
  cannot verify this CSP change. No attempt was made to bypass the limit or
  incur a charge. Hosted response and phone/desktop browser evidence remains
  open after the limit resets.

This is browser isolation hardening, not a substitute for database grants,
role enforcement, migration parity, or release approval.
