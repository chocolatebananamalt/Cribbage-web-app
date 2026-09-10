# Protected preview authentication preflight — 2026-09-10

## Purpose

Verify the Vercel/Supabase configuration boundary without treating a successful
public prototype response as proof that authenticated tournament routes work.

## Observed hosting state

- Project `cribbage-web-app` is configured as Next.js on Node 24 and is not
  marked as a live production deployment.
- Protected preview deployment
  `dpl_GAFNdW6BSZ5KtZmRH2EbNjcv5h5S` from commit `a038732` reached `READY`.
- Its root returned HTTP 200 with no-store, `DENY` framing, strict transport,
  and no-referrer headers.
- The Vercel runtime-error view contains one older middleware error from
  2026-09-07: the Supabase public URL/publishable key were absent in deployment
  `dpl_GHHrC2nF2zMuwiKLsDewQhoETKLg`. It does not identify the current
  deployment as failing, but it proves that an environment check must be a
  release gate.
- Vercel authentication correctly intercepted direct requests to `/sign-in`,
  `/register`, and `/auth/callback` with redirects to its protected SSO flow.
- A logged-in Vercel browser session then opened the exact current-preview
  `/sign-in` route. It rendered the passwordless email form and its submit
  control without the prior `Supabase is not configured` middleware error. No
  email was entered or sent.

## Required authenticated smoke evidence

Before this build can advance beyond protected preview, record all of the
following against the exact deployment URL:

1. **Passed, 2026-09-10:** an authenticated Vercel browser session reached
   `/sign-in` without the `Supabase is not configured` middleware error.
2. A magic-link request uses only the publishable browser key and returns the
   app's safe user-facing result; no service-role key is exposed.
3. The callback returns to an approved same-origin path and a fresh protected
   tournament request is subject to membership authorization.
4. Vercel runtime errors for the tested deployment show no configuration
   failure after the smoke test.

## Release consequence

The current preview is available but authenticated application configuration is
**unverified**, not assumed. Do not promote it, attach a public domain, or call
the authentication foundation pilot-ready until the four checks above have
direct browser evidence.
