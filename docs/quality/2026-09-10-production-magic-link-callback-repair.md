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
- Production deployment and a fresh human magic-link exchange remain required before this repair can be called live-verified.

## Limitations

The one-time callback code from the failed attempt is intentionally not recorded and cannot be reused. A new link must be requested after the repaired build is promoted.
