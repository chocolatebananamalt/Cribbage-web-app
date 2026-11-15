# Production connection provider audit — 2026-09-10

## Scope and acceptance criteria

This is a connected, non-destructive review of the Vercel project and the
shared Supabase pilot. It does not certify the application for release.

The review succeeds only if it separately identifies Preview and Production
configuration, observes the current public Production route, proves the
Supabase email-auth capability without sending email or creating an account,
and leaves any unapproved backend promotion or secret decision explicitly
open.

## Direct provider evidence

### Vercel

- Connected project: `cribbage-web-app`
  (`prj_loMVGmwbqTNcxEOk3T0VBdg3kfEQ`) on the Hobby team.
- The provider reports the current reviewed deployment
  `dpl_EVyNj1HwzPe6Pc5BogZzqMvRSFkX` from commit `98deb42` as `READY`, with a
  Preview target and Vercel Authentication in front of it.
- The signed-in Environment Variables page shows exactly three project
  variables, all Preview-scoped: the public Supabase URL, the public
  publishable key, and one masked server-only secret. Values were not revealed
  or copied.
- Filtering the same provider page to Production reports **No Environment
  Variables Added**.
- The Environments page tracks `main` as Production and all unassigned Git
  branches as Preview. The primary Production domain is
  `cribbage-web-app.vercel.app`; there is no separate custom staging
  environment on the Hobby plan.
- A historical `main` deployment (`dpl_5zJW2ZLPa7hwbacaY94x1BRMFwDq`, commit
  `9d4a0cb`) still owns the public Production aliases. Provider fetches of `/`,
  `/sign-in`, and `/auth/callback` each returned Vercel platform HTTP 404.
  This is a confirmed stale Production deployment, not merely missing test
  evidence.
- The provider's grouped runtime-error view reported no application runtime
  errors in the preceding 24 hours. Production had no runtime-log counts,
  which is consistent with the platform-level 404 and is not proof of a
  healthy application.

### Supabase Auth

- Connected project `ACC Tournament Pilot Integration`
  (`fnjkwymxpnsqvxtpronk`) is `ACTIVE_HEALTHY` and has an enabled modern
  publishable key. No key value is recorded here.
- The signed-in Auth provider page shows email auth enabled, new-user signup
  enabled, email confirmation required, anonymous sign-in disabled, and an
  email OTP/link lifetime of 3,600 seconds.
- The Emails page confirms that the default templates and the Magic link or
  OTP message type are available. Custom SMTP is disabled, so delivery would
  use Supabase's default service and its limits.
- The URL Configuration page shows `http://localhost:3000` as the Site URL and
  an empty Redirect URLs allowlist. The application sends
  `<current origin>/auth/callback?next=...`; therefore hosted magic-link
  callbacks are currently not configured correctly.
- Current official Supabase guidance says the Site URL should be the official
  Production URL, Production should use an exact redirect path, and Vercel
  Preview hosts may use `https://*-<team-or-account-slug>.vercel.app/**`.

## Live smoke evidence

Using a signed-in Vercel browser session against the exact current Preview
deployment:

- `/sign-in` rendered the email field and **Email me a sign-in link** action,
  with no missing-Supabase-configuration message.
- A read-only request to `/auth/callback` without a code redirected to
  `/sign-in?error=missing_code` and rendered the sign-in page. This proves the
  callback rejection path but not code exchange or mailbox delivery.

No address was entered, no email was sent, no account was created, and no
database row was read or changed for this smoke.

## Closed versus external gates

Closed by direct evidence:

- the current Preview deployment is ready and has the three intended
  Preview-scoped connection settings;
- Supabase email auth and its default email-sending capability are enabled;
- the current Preview sign-in page and missing-code callback rejection path
  render successfully.

Confirmed open defects/gates:

1. **Production environment absent.** Vercel Production has no application
   variables. Closing this safely requires an approved Production Supabase
   target and its server-only secret; copying the shared pilot into Production
   would violate the documented staging/Production separation unless the
   owner explicitly changes that decision.
2. **Stale public deployment.** The public aliases serve an old `main` build
   and return platform 404. The current branch must not be promoted merely to
   remove the 404 while the launch plan still marks the application workflow
   and Production backend decision incomplete.
3. **Auth callback allowlist absent.** The Supabase Site URL is localhost and
   there are no hosted redirect URLs. The provider UI can accept a narrow
   Production callback and a Vercel Preview callback wildcard, but saving this
   authentication access setting needs explicit owner approval and an agreed
   Production hostname.
4. **Delivery unproven.** Default Supabase email capability is present, but a
   real-address request, inbox receipt, single-use callback exchange, and
   independent-session authorization proof require a mailbox test. Custom
   SMTP is a provider/volume decision, not a prerequisite for this no-send
   capability check.

## Changes and limitations

No Vercel, Supabase, GitHub, domain, feature-switch, account, email, or data
mutation was made. No secret was revealed, copied, or invented. The connected
tools do not expose a safe operation to clone masked Preview values into a
separate Production backend, and the repository does not name an approved
Production Supabase project.
