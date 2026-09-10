# Sign-in prerender boundary repair — 2026-09-10

## Trigger

Direct observation of the newest protected Preview's `/sign-in` route showed
the static Suspense fallback, “Opening sign-in…”, after a five-second wait
instead of the sign-in form. No email address was entered and no authentication
request was sent.

## Change

The route now uses Next's request-time `searchParams` page prop in a Server
Component and passes the one safe local-clear warning boolean to a small Client
Component. This removes the client-only `useSearchParams` rendering boundary
from the essential sign-in screen, so the form is server-rendered rather than
depending on the old static fallback being replaced before it can be seen.

The Client Component retains only the browser-only work required to submit a
passwordless sign-in request. It still uses the publishable Supabase key,
accepts only a same-origin relative next path, and never introduces password
login.

## Acceptance checks

- `pnpm lint` — pass.
- focused `tests/supabase-auth-semantics.test.mjs` — 34 pass.
- `pnpm build` — pass; `/sign-in` is now request-rendered.
- `git diff --check` — pass.

The next protected hosted deployment must be checked visually before this is
treated as hosted evidence. Vercel's daily Hobby deployment limit was active
when the defect was observed, so no manual deployment or paid workaround was
attempted.
