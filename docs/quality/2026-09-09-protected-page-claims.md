# Protected-page verified-claims boundary — 2026-09-09

## Finding and repair

The shared `requireTournamentAccess` page guard previously called
`auth.getUser()`. That call is server-confirmed, but it left the protected-page
guard inconsistent with the application's protected route handlers and the
current Supabase SSR recommendation to verify identity with `getClaims()`.

The guard now uses `auth.getClaims()`, fails closed on a claims-service error,
redirects only when there is no verified subject, and returns only the profile
identifier that protected pages need. It still obtains authorization from the
server-side `get_tournament_role` RPC; a valid identity by itself never grants
tournament access.

## Evidence

```text
pnpm lint      PASS
pnpm test      PASS (58 tests)
pnpm build     PASS
git diff --check PASS
```

The regression check asserts `getClaims()`, explicit claim-error handling, no
`getUser()` use in the page guard, and the continuing role-RPC/not-found
boundary. Real independent authenticated browser sessions remain a release
gate.
