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
6. A QR/link carries the raw activation only in a bounded URL fragment. The
   dedicated activation route returns `Referrer-Policy: no-referrer` and a
   restrictive no-third-party CSP before subresources load; before hydration,
   service-worker work, analytics, prefetching, or any further request, a
   minimal bootstrap synchronously replaces the fragment with a fixed
   sanitized same-route URL. The raw value stays only in a non-rendered local
   variable for one bounded redemption attempt and is cleared on every exit.
   Redemption is an explicit same-origin, credentialed, no-store POST with
   server Origin/Fetch-Metadata enforcement and a private no-store response.

## Required rejection cases

- unauthenticated activation pages require sign-in before the QR/link is
  reopened; no authentication redirect, cookie, storage, query, path, or
  session continuation preserves its raw value;
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
- a raw activation never appears in a server URL, retrievable
  application/session history, storage, cache, referrer, telemetry, error
  report, log, audit payload, request-capture platform, or redirect target;
  parsing/replacement failure fails closed before redemption or page load; and
- no mutation creates a role, roster entry, event participant, payment,
  check-in, seating assignment, game, score, or confirmation.

## Evidence required before calling this increment complete

- migration/schema contract tests covering the acceptance and rejection cases;
- route request/response validation tests, including exact response binding;
- real-browser network traces proving the initial request has no fragment and
  that zero external requests, telemetry calls, prefetches, or service-worker
  activity occur while the token exists; response-header/CSP assertions;
- browser tests for fragment replacement before hydration, back/reload/BFCache,
  replacement failure, unauthenticated sign-in/reopen, and service-worker
  disablement/bypass; and canary-token scans of DOM, storage, cache, redirects,
  application/platform logs, telemetry, APM, and error reports;
- executed database tests or a disposable branch that prove the role-revoked
  nested-link rollback and concurrent issue/redeem behavior (regex/source
  tests alone are insufficient);
- local lint, tests, build, `pnpm verify`, `pnpm verify:handoff`, and diff
  validation;
- focused Sol review of the final diff; and
- later, two independent browser accounts against the pilot database. Browser
  proof is a release gate and is not replaced by local static tests.
