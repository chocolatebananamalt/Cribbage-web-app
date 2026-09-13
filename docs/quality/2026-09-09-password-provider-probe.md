# Password-provider probe — 2026-09-09

> **Superseded clarification — 2026-09-10:** The hosted Email provider
> combines password and magic-link email authentication; its dashboard offers
> no supported password-only disablement while magic links and new-user
> creation remain enabled. The HTTP probe remains accurate, but its conclusion
> that this must be disabled is withdrawn. The release boundary is instead:
> the application contains no password UI/API path, raw provider-created
> accounts receive no role or tournament data, and every protected action
> remains server/database authorized. Leaked-password protection is optional
> for the app's magic-link-only flow, not a release blocker.

## Acceptance criterion

The supported authentication model is passwordless email magic links. A
password grant must be disabled by the hosted provider before release, not
merely absent from the application screen.

## Executed evidence

Using the pilot's enabled **public** client credential and deliberately fake,
nonexistent test credentials, a single anonymous request was made to the
Supabase password-grant endpoint. It returned HTTP 400 `Invalid login
credentials`.

That response proves the password grant was accepted and attempted credential
validation. A disabled password provider would reject the password grant
itself. No account was created, no real person’s data was sent, and no secret
credential was used or recorded.

## Result

**Fail — release blocker.** The hosted provider currently permits password
login even though the application does not show a password field. The
Supabase Email/Password provider must be disabled (or password sign-in must be
otherwise explicitly made unavailable) before production release. This is
separate from the user-approved decision not to pay for leaked-password
protection; once password login is disabled, that paid feature is not relevant
to the app's supported flow.

The application regression test continues to forbid password inputs,
`signInWithPassword`, and password sign-up calls. It protects source code but
cannot override provider configuration.
