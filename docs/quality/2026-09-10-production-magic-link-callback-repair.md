# Production magic-link callback repair

Date: 2026-09-10 (Pacific/Honolulu)

## Failure evidence

- A real production magic-link request delivered successfully through Supabase.
- The callback request reached Vercel at `/auth/callback` and returned HTTP 500.
- Vercel runtime logs recorded: `NextResponse.next() was used in a app route handler, this is not supported.`
- The failing deployment was `dpl_4XzLuvmw4hPixU3vytbe7cF92KMF` at `https://cribbage-web-app.vercel.app`.

## Repair

- Replaced the middleware-only `NextResponse.next()` route-cookie accumulator with a neutral `NextResponse`.
- Preserved Supabase's cache-control headers and refreshed cookies on the final redirect.
- Prevented duplicate raw `Set-Cookie` propagation before applying parsed cookies with their options.
- Added a regression assertion that the route client cannot reintroduce `NextResponse.next()`.

## Verification

- `pnpm verify`: pass — dependency audit, lint, 214/214 application tests, production build, and workspace checks.
- `pnpm verify:handoff`: pass — 6/6 private handoff checks.
- Independent Sol review found no P0/P1 issue and approved the exact repair for deployment.
- With explicit owner approval, commit `32cd581fa8c4ee71d4fb36bb35fbaad29019e0fc` was promoted to Vercel Production as deployment `dpl_2TdYsMyRuhXygphi3vTEUfSGVkFy`.
- Vercel reports the deployment `READY`, targeted to `production`, aliased to `https://cribbage-web-app.vercel.app`, and with no alias error.
- Live smoke results on the promoted deployment:
  - `/`: `200 OK`
  - `/sign-in`: `200 OK`
  - `/auth/callback` without a code: `307` to `/sign-in?error=missing_code`
  - `/auth/callback` with an intentionally invalid code: `307` to `/sign-in?error=callback_failed`
- Deployment-scoped runtime logs show only the expected `200` and `307` responses for these requests. The Vercel runtime-error query for `/auth/callback` returned no errors in the post-promotion window.
- External Chrome visibly loaded the live Tournament access page at the Production URL.
- Promotion and the original HTTP 500 reproduction are closed. A fresh human magic-link exchange remains required to prove successful exchange of a valid one-time code and authenticated-session establishment.

## Limitations

The one-time callback code from the failed attempt is intentionally not recorded and cannot be reused. The repaired build is now promoted; the remaining human check must request and use a new link.
