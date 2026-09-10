# Registration fragment CSP repair — 2026-09-10

## Finding

The initial `/register` static Content-Security-Policy allowed only same-origin
scripts. Next.js emits inline framework bootstrap/hydration scripts, so that
policy would block the registration page's own browser behavior before the
fragment-clearing bootstrap or form could run. A successful build did not prove
the browser page was usable.

## Repair

- Removed the route's static policy from `next.config.ts`.
- The request proxy now creates a fresh unpredictable nonce only for
  `/register`, forwards the nonce and policy to the renderer, and returns the
  same policy to the browser.
- The registration page explicitly waits for a request connection so Next.js
  dynamically renders it and attaches the per-request nonce to its scripts.
- The Supabase proxy preserves forwarded request headers while it refreshes
  authentication cookies.
- Production policy permits only same-origin resources, nonce-authorized
  scripts/styles, self/blob/data images, and same-origin connections; it
  disallows objects, framing, cross-origin forms, and insecure upgrades. The
  development-only allowances are limited to the framework's documented
  development needs.

## Local evidence

On 2026-09-10, in the production-readiness branch:

- `pnpm lint` — pass.
- `pnpm test` — pass, 92 tests.
- `pnpm build` — pass; `/register` is dynamic (`ƒ`).
- `git diff --check` — pass.

## Remaining hosted evidence

Before public registration may be enabled, the next Preview deployment must
prove a distinct response nonce, matching nonce-bearing rendered scripts,
fragment clearing before hydration, browser error-free submission rejection
paths, and independent-session behavior. This repair does not enable public
registration or remove any existing lifecycle/identity release gate.
