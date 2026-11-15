# Legacy registration-token path audit — 2026-09-10

## Finding

The current public registration implementation accepts its bearer token in
`/register/[token]` and `/api/v1/registration/[token]`. A path component is
sent to the web server and can be retained by CDN, access-log, referrer, or
diagnostic systems before the application can remove it. This conflicts with
the approved registration-link lifecycle contract, which requires a
fragment-only token on a fixed route and no raw-token persistence.

## Pre-retirement evidence

- Source inspection confirmed the two dynamic legacy routes and their use of
  the token as a path parameter.
- A safe pilot aggregate query on 2026-09-10 found zero legacy registration
  links and zero enabled legacy registration links. No token, player, claim,
  or tournament details were read.
- The legacy public context and claim RPCs were intentionally executable by
  anonymous users only for the unfinished public-registration design. The
  advisor warning was not a finding that direct private `app` tables were
  exposed.

## Release decision

This is a non-waivable public-release blocker. The legacy path-token routes
and their public RPC surface must be retired before public registration is
enabled. Their replacement is the separately approved versioned,
fragment-only link lifecycle in
`docs/decisions/2026-09-09-registration-link-lifecycle-contract.md`.

## Resolution — 2026-09-10

The owner authorized retirement. Migration
`0070_retire_legacy_public_registration_surface` was applied first to the
disposable synthetic database and then to the pilot. It guards against
incoherent claims, disables all legacy links, revokes every caller role, and
drops both anonymous RPCs. It does not delete claim history.

Aggregate checks in both environments returned zero legacy links, zero enabled
links, zero incoherent claims, and no remaining legacy RPC. The dynamic page,
API route, and client helper were deleted. Public signup is therefore
intentionally unavailable until v2 is implemented and tested.

## What this does not prove

This retirement does not implement the secure v2 lifecycle, QR
issuance/rotation, fragment bootstrap, secure token storage, browser/network
canary checks, or the public registration flow.
