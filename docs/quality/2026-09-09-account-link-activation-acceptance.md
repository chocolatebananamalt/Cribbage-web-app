# Account-link activation acceptance criteria — 2026-09-09

## Scope

Implement the private account-link activation foundation only. It is not roster
creation, payment, event enrollment, check-in, seating, scoring, or role
assignment.

## Observable success cases

1. A current director or co-director can issue one short-lived activation for
   one existing roster identity; the raw 256-bit activation value is returned
   exactly once in a private, non-cacheable response and is not persisted.
2. An authenticated player can redeem that value exactly once. The server, not
   the browser, binds the pending request to `auth.uid()` and creates a
   server-generated confirmation phrase.
3. A current director or co-director can read only the pending requests for
   the selected tournament and can approve a witnessed matching phrase. The
   single approval transaction creates one immutable roster-account link using
   the stored profile and a stable, distinct inner link-operation ID.
4. Exact retry returns the same stored result. A failed nested link or later
   approval write leaves neither a link nor an approved activation event.
5. The activation database functions are unreachable through an authenticated
   browser Supabase client. Only a same-origin server route, using its
   server-only execution identity after verified claims, can invoke them.

## Required rejection cases

- unauthenticated, cross-origin, malformed, non-director, expired, cancelled,
  already-redeemed, cross-tournament, already-linked, changed-retry, and
  revoked-role attempts fail closed;
- redemption does not accept a roster ID, tournament ID, profile ID, name,
  email, or ACC number from the client;
- invalid activation values return one generic non-enumerating response;
- two officials racing to issue an activation for one roster identity create
  exactly one live activation; cancellation/rejection releases only the
  appropriate safe retry path;
- direct browser table access and public/anonymous execution are denied; and
- no mutation creates a role, roster entry, event participant, payment,
  check-in, seating assignment, game, score, or confirmation.

## Evidence required before calling this increment complete

- migration/schema contract tests covering the acceptance and rejection cases;
- route request/response validation tests, including exact response binding;
- executed database tests or a disposable branch that prove the role-revoked
  nested-link rollback and concurrent issue/redeem behavior (regex/source
  tests alone are insufficient);
- local lint, tests, build, `pnpm verify`, `pnpm verify:handoff`, and diff
  validation;
- focused Sol review of the final diff; and
- later, two independent browser accounts against the pilot database. Browser
  proof is a release gate and is not replaced by local static tests.
