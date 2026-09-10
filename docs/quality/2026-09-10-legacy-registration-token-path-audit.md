# Legacy registration-token path audit — 2026-09-10

## Finding

The current public registration implementation accepts its bearer token in
`/register/[token]` and `/api/v1/registration/[token]`. A path component is
sent to the web server and can be retained by CDN, access-log, referrer, or
diagnostic systems before the application can remove it. This conflicts with
the approved registration-link lifecycle contract, which requires a
fragment-only token on a fixed route and no raw-token persistence.

## Current-state evidence

- Source inspection confirmed the two dynamic legacy routes and their use of
  the token as a path parameter.
- A safe pilot aggregate query on 2026-09-10 found zero legacy registration
  links and zero enabled legacy registration links. No token, player, claim,
  or tournament details were read.
- The legacy public context and claim RPCs remain intentionally executable by
  anonymous users only for the currently unfinished public-registration
  design. The security advisor reports them as such; that warning is not a
  finding that the direct private `app` tables are exposed.

## Release decision

This is a non-waivable public-release blocker. The legacy path-token routes
and their public RPC surface must be retired before public registration is
enabled. Their replacement is the separately approved versioned,
fragment-only link lifecycle in
`docs/decisions/2026-09-09-registration-link-lifecycle-contract.md`.

Because retiring the legacy path deliberately turns off public signup until
the replacement is completed, that customer-visible operation awaits owner
approval. No legacy link is active while the decision is pending.

## What this does not prove

This audit does not implement the secure lifecycle, QR issuance/rotation,
fragment bootstrap, secure token storage, browser/network canary checks, or
the public registration flow. It records why the existing route cannot be
promoted to a public production release.
