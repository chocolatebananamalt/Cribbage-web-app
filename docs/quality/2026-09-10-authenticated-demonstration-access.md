# Authenticated demonstration access

Date: 2026-09-10 (Pacific/Honolulu)

## Acceptance criteria

1. A signed-in production visitor can deliberately open the current interface
   without receiving a tournament role or modifying operational records.
2. An anonymous visitor to `/demo` is sent to the email sign-in flow with the
   intended return path preserved.
3. The interface identifies itself as a demonstration using sample data and
   states that actions are not saved.
4. The existing rule that prevents the synthetic dashboard from becoming an
   anonymous Production operations screen remains intact.
5. The complete repository verification and private handoff verification pass;
   the deployed route is checked at phone and desktop sizes before closure.

## Implementation boundary

- `/demo` validates the current Supabase subject on the server and redirects an
  anonymous request to `/sign-in?next=%2Fdemo`.
- The signed-in landing page offers an explicit demonstration link.
- The demonstration reuses the synthetic client-only review dashboard. It does
  not call Supabase data RPCs, application mutation APIs, or the server-only
  admin client, and it does not grant a tournament role.
- A persistent visible notice distinguishes sample interaction from an active
  tournament and links back to the account landing page.

## Executed checks

- Focused ESLint: PASS.
- `tests/supabase-auth-semantics.test.mjs`: PASS, 36/36.
- `pnpm verify`: PASS: production dependency audit, lint, 216/216 application
  tests, Next.js 16.3.4 production build, and 5/5 workspace checks.
- `pnpm verify:handoff`: PASS, 6/6.
- Production build reports `/demo` as a dynamic server-rendered route.

## Remaining live proof

The committed deployment must still be promoted and checked in an actual
authenticated browser at desktop and phone widths. This document is updated
with that evidence before the change is called live.
