# Vercel Production live smoke verification

Date: 2026-09-10 (Pacific/Honolulu)

## Scope

Close the hosting-only blockers recorded for the Vercel Production target:
missing public Supabase connection values, no promoted release, and the
default Production hostname returning Vercel 404.

## Change

- Added `NEXT_PUBLIC_SUPABASE_URL` to Vercel Production.
- Added `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Vercel Production.
- Added no privileged Supabase key or password.
- Promoted reviewed commit `a8078fa` to Production.

## Evidence

- Production deployment: `dpl_4XzLuvmw4hPixU3vytbe7cF92KMF`
- Deployment state: `READY`
- Deployment target: `production`
- Production alias: `https://cribbage-web-app.vercel.app/`
- Alias error: none
- `GET /`: `200 OK`
- `GET /sign-in`: `200 OK`
- `GET /auth/callback` without a code: expected safe redirect to
  `/sign-in?error=missing_code`
- External Chrome rendered the Production tournament-access screen.
- Vercel runtime errors for the verification window: none.
- Production runtime status groups observed: 200 and expected redirect 307.
- Supabase Authentication Site URL:
  `https://cribbage-web-app.vercel.app`
- Supabase Authentication allowed Redirect URL:
  `https://cribbage-web-app.vercel.app/auth/callback`

## Limitations

This proves hosting, routing, runtime startup, public Supabase connection
configuration, and the Supabase Production callback allow-list. It does not
prove delivery and use of a real magic-link email, account membership, or the
independent multi-user scoring/verification workflow. Those remain separate
release gates.
