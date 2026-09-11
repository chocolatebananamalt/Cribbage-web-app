# Authenticated entry UX repair

Date: 2026-09-10 (Pacific/Honolulu)

## Observed behavior

- A fresh real-address magic link delivered successfully.
- Supabase created a new authentication session at the same time the link was
  opened.
- Vercel recorded the repaired `/auth/callback` request as HTTP 307 with no
  application error.
- The visitor nevertheless saw the anonymous root page, followed the visible
  sign-in link again, and eventually received Supabase's email rate-limit
  response.

## Cause

The Production root page always rendered the anonymous sign-in invitation and
the sign-in page always rendered the email form. Neither page read the valid
Supabase session. The callback and session creation were already working.

## Repair

- Added a server-only, fail-closed current-subject reader using
  `supabase.auth.getClaims()`.
- The Production root now renders a generic signed-in acknowledgement and the
  shared-device sign-out control when a valid subject is present.
- `/sign-in` redirects an already authenticated visitor to `/`, preventing a
  second email request.
- A raw rate-limit response is translated into a clear wait-and-retry message
  for genuinely anonymous users.
- Tournament authorization remains separately enforced; the acknowledgement
  grants no role or workspace access.

## Verification

- `pnpm verify`: pass — audit, lint, 215/215 application tests, production
  build, and workspace checks.
- `pnpm verify:handoff`: pass — 6/6 private handoff checks.
- Independent Sol review: no P0/P1 finding; callback and cookie-handling files
  unchanged; tournament authorization remains independent.
- Commit `faba056a63df94f1a2233bd714f8aef76e1be44f` was promoted as Vercel
  Production deployment `dpl_3TPeJetjEENeoDUimx4tKGjec46i`, which is `READY`
  with no alias error.
- Using the real session created by the user's fresh magic-link test, external
  Chrome rendered “You’re signed in” at the Production root.
- In that same session, visiting `/sign-in` returned to `/` and did not display
  the email form.
- Vercel recorded `GET /sign-in` as 307 followed by `GET /` as 200 on the exact
  deployment, and reported no runtime errors in the verification window.
- The latest authenticated account has zero tournament-role records in the
  pilot, confirming that sign-in acknowledgement did not grant access.

## Limitations

No sign-out mutation was performed during this check because it would have
destroyed the user's active verification session. Existing automated tests
cover the local sign-out and device-clear boundary.
