# Public registration page release gate — 2026-09-10

## Finding

The public registration claim API already failed closed unless
`ACC_PUBLIC_REGISTRATION_V2=enabled`. The `/register` page, however, still
rendered its form shell while that switch was off. The API prevented a claim,
but the disabled product surface could misleadingly appear available and load
the fragment bootstrap script.

## Acceptance criteria

With the release switch absent or any value other than the explicit
`enabled` value:

1. `/register` does not render the registration form or bootstrap script;
2. no credential-containing fragment is processed by the page; and
3. the protected claim, link issue, link rotation, and link-close APIs remain
   unavailable.

When the explicit switch is enabled, the existing dynamic page keeps its
fragment-clearing, non-persistent credential handling.

## Repair

`src/app/register/page.tsx` now checks the same shared
`publicRegistrationEnabled()` decision used by the APIs and calls Next's
`notFound()` before rendering or calling `connection()` when the switch is
off. This preserves a single explicit release decision for both page and API,
without exposing a partially usable registration interface.

The existing static regression now asserts that the page imports the shared
decision and has the fail-closed `notFound()` branch, alongside its existing
fragment-clearing and no-browser-storage assertions.

## Executed verification

Local worktree, 2026-09-10:

- `pnpm test` — 124 passed, 0 failed;
- `pnpm lint` — passed; and
- `pnpm build` — passed (Next.js 16.3.4 optimized production build).

Browser and hosted verification remain release gates: the local browser bridge
is unavailable and the Vercel provider is rate-limiting new Git builds. This
repair does not enable public registration.
