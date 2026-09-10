# Hosted preview environment-scope review — 2026-09-10

## Purpose

Confirm the current Vercel configuration boundary without revealing any
credential values or changing hosted configuration.

## Direct observations

The signed-in Vercel project interface for `cribbage-web-app` showed the
following on 2026-09-10:

- Preview deployment `dpl_FLa3qv1dYdBhAQobCu9vETfFTnm9`, from commit
  `9e5fa32251f6d906137201f5dd9ed28689af4dd6`, was `READY`.
- The Vercel project identifies the framework as Next.js.
- The protected Preview environment contains masked values for
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- The protected Preview environment also contains a server-only
  `SUPABASE_SECRET_KEY`; its value was not revealed or inspected.
- Those entries are scoped to **Preview**, not Production. The observation
  does not establish any Production environment configuration.
- Vercel's grouped runtime-error view reported no runtime error in the two
  hours preceding the review.

The protected deployment endpoint redirects an unauthenticated request to
Vercel SSO, which is expected for the current review environment. This
prevents an unauthenticated fetch from acting as an application-flow test.

## Result

The present setup is correctly bounded as a protected preview and is not
evidence of a configured public production environment. This is the desired
state while the app remains under review.

The already-recorded authenticated-flow evidence is still required: an
independent-user sign-in/callback/membership test against the precise
deployment, then a separately configured staging and production release
environment. No variable, deployment, domain, service setting, or pilot data
was changed during this review.
