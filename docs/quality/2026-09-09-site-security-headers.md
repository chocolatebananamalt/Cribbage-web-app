# Site-wide browser-security headers — 2026-09-09

## Scope

Close the gap between individually protected private API responses and the
browser-level protections applied to all application routes.

## Acceptance criteria

1. Every Next.js-served route receives MIME-sniffing, framing, referrer, DNS
   prefetch, and unused-device-capability protections.
2. The policy does not add third-party permissions, alter role behavior, or
   loosen the existing private no-store API response policy.
3. The policy is included in the optimized production build and has a
   regression check.

## Implemented policy

`next.config.ts` applies the following headers to `/:path*`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()`
- `X-DNS-Prefetch-Control: off`

The strict no-referrer policy is intentionally compatible with the current
and future bearer-style link protections: no page navigation may disclose a
route value through a referrer. A nonce-bound content-security policy is not
claimed here; it requires its own App Router/script compatibility review.

## Executed evidence

- Read the local Next.js 16.3.4 `next.config` headers reference before the
  change.
- Added a static regression test asserting the exact all-route policy.
- `pnpm lint` passed.
- `pnpm test` passed with 77 tests.
- `pnpm build` passed and compiled the application with the configured
  headers.
- `pnpm verify` and `pnpm verify:handoff` passed.
- `git diff --check` passed.
- Vercel built commit `68dfb0d` as Ready Preview deployment
  `dpl_E6vKfZYGrafvbiZUm7dwsAAkFCmP`. An authenticated Vercel deployment
  fetch of its root response confirmed all five configured headers with their
  exact intended values. The protected Preview response is `200`; it has no
  deployment alias error.

## Limits

The local build and hosted response prove this configuration, not every future
platform or browser behavior. This hardening does not replace the separately
gated registration-link lifecycle, offline/hybrid, results/finance/finalization,
multi-user, restore, or accessibility release work.
