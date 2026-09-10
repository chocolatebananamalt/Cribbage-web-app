# Account-activation fragment boundary — 2026-09-10

## Finding and acceptance criteria

The first gated `/activate` page removed the fragment from the address bar only
after React hydrated. That did not meet the activation contract's stronger
requirement: the raw credential must be removed before hydration and before
any nonessential browser work, with a restrictive no-third-party policy in
force for that route.

This repair must ensure that an enabled activation page:

- receives a fresh nonce-based, same-origin-only Content-Security-Policy and
  the existing `Referrer-Policy: no-referrer` before its subresources load;
- invokes a tiny, grammar-limited bootstrap before Next.js hydration to remove
  the fragment synchronously and retain only a valid value in ephemeral
  JavaScript memory;
- does not place the value in React state/props, rendered markup, browser
  storage, a cookie, a URL, or a redirect;
- aborts and clears an in-flight redemption on `pagehide` and component
  teardown; and
- remains unavailable while its explicit release flag is off.

## Implementation

- `public/activation-bootstrap.js` accepts only the documented
  `uuid.base64url-256-bit-secret` fragment grammar, immediately calls
  `history.replaceState`, and retains a valid value only in a temporary global
  consumed by the client form after hydration.
- `/activate` now loads that bootstrap with the same critical-script strategy
  used by the already-reviewed registration route.
- The request proxy applies the existing per-request nonce, restrictive CSP,
  and authentication-cookie handling to both `/register` and `/activate`.
  Production CSP permits only same-origin scripts/connections/resources, with
  no third-party analytics, images, fonts, or network destinations.
- When the flag is off, the proxy bypasses session initialization for
  `/activate`, so missing local Supabase configuration cannot turn an absent
  feature into a generic server error before the page's not-found decision.
- The client form has no URL parsing of its own, uses a non-rendered ref, adds
  `pagehide` abort/clear handling, and sends only the bounded, same-origin,
  no-store redemption request.
- Static regression tests cover the bootstrap, page strategy, restrictive
  proxy path, no storage, and abort behavior. The existing registration
  regression was broadened to assert that the shared CSP boundary covers both
  fragment-bearing routes.

## Local evidence

Run in the production-readiness workspace on 2026-09-10:

```text
pnpm lint       PASS
pnpm test       PASS — 146 tests
pnpm build      PASS — Next.js 16.3.4 production build
git diff --check PASS
```

With the release flag absent and no local Supabase environment configured, a
local development smoke request to `/activate` returned the intended `404`
(rather than a proxy `503`) with `Referrer-Policy: no-referrer`. Browser
automation could not reach this local address because its browser extension
reported `ERR_BLOCKED_BY_CLIENT`; that limitation is recorded rather than
substituted with a false browser claim.

## Limits and release decision

The account-activation switch remains off and migrations `0090`–`0095` remain
unapplied. Static tests and a production build prove the source boundary, not
the required real-browser trace. Before enabling this feature, a controlled
pilot must prove the enabled route's actual response headers, fragment removal
before hydration, no external/browser-network leakage, reload/BFCache/pagehide
handling, unauthenticated re-open behavior, and independent authenticated
sessions against the applied private schema. This repair does not authorize
activation, QR delivery, or production release.
