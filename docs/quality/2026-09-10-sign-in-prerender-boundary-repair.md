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
- GitHub Actions `Verify` run `34489405152` — pass for commit
  `23ecb27bad6d92e58d7e9e80767f6a67b4404ddd`.
- Protected Vercel Preview `dpl_GRDf33N52vQJRkKYEJQQMsFEjaxT` — `READY`.
  A logged-in browser opened its exact `/sign-in` URL and showed the email
  field and “Email me a sign-in link” control immediately. No address was
  entered and no sign-in message was sent. Vercel reported no grouped runtime
  error in the following one-hour review window.

This verifies the visible hosted form and the no-error observation only. It
does not substitute for the still-required separate-user magic-link callback
and tournament-membership evidence.
