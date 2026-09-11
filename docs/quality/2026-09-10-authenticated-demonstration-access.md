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

## Production evidence

- Independent Sol review: P0 none, P1 none; safe to promote. The reviewer
  confirmed the auth/callback/session boundary was unchanged and the synthetic
  dashboard contains no fetch, Supabase RPC, server action, or API navigation.
- Commit `7a1a25585d5bfa0a02339a063139e0ee49ff3866` built as Preview deployment
  `dpl_UmizH2zVXTvvFcWiTXpWNsvj4rLN`, reached `READY`, and was promoted using
  the Vercel Production environment as deployment
  `dpl_5xHc1HTbXxoMf6N6hwm4zD2oM3cx`.
- In the retained real authenticated Chrome session, `/` displayed the new
  `Explore the demonstration` link and `/demo` displayed the persistent sample
  notice, Score Entry, Scorecard, Operations, Results, and Rulebook navigation.
- The browser flow selected Barb, entered an 88-point spread, displayed the
  correct 3/+88 and 0/-88 reciprocal result plus Double skunk aid, reviewed the
  result, and reached `Entry Submitted` with the expected opponent-entry wait.
- A credential-free Production fetch of `/demo` reached
  `/sign-in?next=%2Fdemo` and rendered the email sign-in form.
- Deployment-scoped Vercel logs contain only `GET /`, `GET /demo`, and the
  credential-free `GET /sign-in` proof. No `/api/` mutation request occurred,
  and Vercel reports no runtime-error cluster in the verification window.

## Limitation

The authenticated Production interaction was visually checked at the user's
1536-pixel desktop viewport. The narrow-screen banner behavior is backed by an
explicit 700-pixel responsive rule and the existing dashboard phone regression
suite, but the current external-browser control could not resize the retained
authenticated Chrome tab. A real 375-pixel authenticated browser pass remains
an accessibility proof item; it does not change the no-write demonstration
boundary.
