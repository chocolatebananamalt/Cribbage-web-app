# Exact Supabase CSP connection source — 2026-09-10

## Finding

The site-wide Content Security Policy allowed browser connections to every
`*.supabase.co` tenant. That was narrower than an unrestricted policy, but it
was broader than this app needs and would make a future script-injection defect
more useful for data exfiltration.

## Repair

The proxy now derives `connect-src` from the one configured public Supabase
URL. It emits only that HTTPS origin and its matching secure WebSocket origin.
Missing, non-HTTPS, credential-bearing, path-bearing, or malformed values add
no external connection source. Authentication configuration still fails closed
separately; this policy does not make an invalid deployment usable.

## Verification

- Focused lint passed.
- The 32-check Supabase/auth suite passed, including exact-origin and malformed
  configuration cases.
- A local optimized-server request without public Supabase configuration
  returned the expected private `503` and retained the full CSP with
  `connect-src 'self'`; no external source was silently allowed. The temporary
  server was stopped after the check.

Hosted header and browser verification remain open while Vercel's daily code
deployment quota is exhausted. This local/source evidence is not substituted
for that later verification.
