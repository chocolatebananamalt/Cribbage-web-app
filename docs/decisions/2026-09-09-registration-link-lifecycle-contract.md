# Registration-link lifecycle contract — 2026-09-09

## Gap found

The public registration-claim endpoint is correctly token-gated, but the
production application contains no director-authorized lifecycle for issuing,
displaying, rotating, closing, or auditing that token. The original table also
permits only one row per tournament, which is incompatible with an immutable
history of replaced flyer links. A public registration page without a safe
link lifecycle cannot be operated at a real tournament.

## Decision

Implement a private **registration-link lifecycle** for a current director or
co-director. It creates a short opaque flyer URL/QR destination for a specific
tournament; it is not an invitation, authentication credential, role grant,
payment record, roster entry, event enrollment, Table/Seat assignment, or
verification ID.

The raw token uses versioned `link-id.secret` format, where `secret` is a
cryptographically generated 256-bit URL-safe value and `link-id` identifies
only the opaque lifecycle record. Each header stores a fresh random per-link
salt and `SHA-256(salt || canonical token)`, verified with a constant-time
comparison. This deliberately avoids a shared HMAC/pepper key in source, SQL,
logs, or an anonymous database function.
It returns the raw value exactly once in a private, no-store issue response,
together with the canonical registration URL. The director may deliberately
copy or print/download a locally generated QR during that immediate response;
that user-directed artifact is the one authorized persistent bearer copy. The
app itself must never persist the raw value in browser storage, logs,
telemetry, audit data, a database row, query history, or a retry envelope. A
lost token is not recoverable: the director issues a new link and retires the
old one. Every link has a server-generated bounded `expires_at` value.

## Required lifecycle and persistence

- Replace the one-row-per-tournament constraint with immutable link headers,
  immutable sequenced lifecycle events, and one locked mutable
  tournament-scoped active-head row. Headers store only the digest/salt version,
  tournament ID, issuer, issuance/expiry time, and bounded intake caps. The
  active head is the only authoritative current-state pointer and supports only
  `issued -> retired|closed|expired`; no link can reopen. Claims remain linked
  to their exact historical link header.
- At most one active head exists for a tournament. Issue, rotate, close, and
  public claim use the same lock order: tournament/active head, then link
  header. Each rechecks registration status, lifecycle state, expiry, and caps
  while locked. Rotation retires the preceding link and inserts its replacement
  atomically; close or registration closure makes the active head unusable in
  the same transaction. Concurrent directors obtain one durable winner. A
  concurrent claim versus close/rotation cannot insert from a stale read.
- Link headers require `UNIQUE(id, tournament_id)` and claims require a
  composite `(registration_link_id, tournament_id)` foreign key. Before
  migration, a transaction must prove zero orphan/mismatched legacy rows;
  backfill ID-preserving issuance/current-state events for each legacy link,
  then verify counts and composite FKs. Existing unsalted legacy SHA-256 links
  cannot be rehashed without raw values. This pilot migration atomically closes
  every legacy-v1 link and removes/revokes every token-in-path page/API route
  before any v2 link can open; old paths return generic unavailable/404 without
  reflecting or logging a canary. Removing the old one-link uniqueness is
  forward-only; rollback is a forward-disable operation backed by restore
  evidence, never deletion of immutable history.
- Issue, rotate, close, and private-read functions revoke `EXECUTE` from
  `PUBLIC`, `anon`, and `authenticated`. Only a server-only database identity
  may invoke them after the Next.js route verifies claims; the database then
  independently reauthorizes the trusted actor's current tournament role. The
  existing narrow public context/claim functions are the only anonymous-callable
  functions. Safe receipts never contain raw tokens. The initial issue response
  may be an ephemeral augmented response; exact retry/reconciliation returns
  only safe lifecycle identity/state and directs the director to rotate if its
  first response was lost.
- The authoritative registration state is the server/database state. A
  director-facing UI cannot claim a QR is open merely because a cached screen
  says so; it must reload the scoped current lifecycle view after any outcome.
- A link URL carries its raw token only in a fragment on a fixed registration
  route (for example, `/register#<token>`), never in a path or query string.
  A path token would reach CDN/server access logs before the application could
  protect it. The registration bootstrap must follow the approved activation-
  link discipline: initial `Referrer-Policy: no-referrer` and restrictive CSP,
  strict bounded fragment parsing and synchronous replacement before hydration,
  analytics, service-worker work, prefetching, or other requests; a
  same-origin credentialed no-store POST body for the token; fail-closed
  behavior if parsing/replacement fails; and dropping every application token
  reference on success, rejection, abort, unmount, and `pagehide`. The server
  must bound the body, enforce Origin/Fetch-Metadata checks, return private
  no-store responses, and exclude it from request capture/platform logs,
  telemetry, errors, middleware, and audit fields. A redirect must never
  preserve it.
- **Credential-processing boundary:** the browser sends the fragment value
  only to the same-origin Next.js registration endpoint. That server parses
  the bounded `link-id.secret` value, obtains the stored salt by opaque link
  ID through a service-only database function, and computes the fixed-length
  digest in server memory. It sends only the link ID, fixed-length digest, and
  ordinary registration fields to Supabase; it never forwards the raw secret
  in an RPC argument, SQL parameter, database error, or audit payload. The
  database still performs the locked lifecycle/capacity checks and a
  fixed-length constant-time digest comparison before accepting a claim.
  Issue follows the reciprocal path: Next.js generates the 256-bit secret in
  server memory, derives its digest locally, and sends only the salt/digest to
  the service-only header-creation function. This limits bearer handling to
  the browser's short fragment lifetime and the app server's short request
  lifetime rather than adding Supabase request telemetry to the secret's
  exposure surface.
- The v2 lifecycle functions may sit in the database's API schema only when
  `PUBLIC`, `anon`, and `authenticated` execution are revoked. Each must be
  explicitly granted to the server-only service role, accept a claimed actor
  ID, and independently verify that actor's current director/co-director role
  inside the database. A browser publishable key must not be capable of
  invoking a lifecycle, salt-lookup, or claim function directly.
- QR encoding is local to the browser or generated from the exact returned URL
  without transmitting it to another provider. The page must load no external
  content for the raw token's complete in-memory lifetime.
- The director issue route/page has the same raw-value protections as the
  public redemption page: initial no-referrer/CSP headers, no third-party
  content, analytics, replay, APM, service-worker or external request while
  displaying the value, no BFCache reuse, body/log redaction, and cleanup of
  every application reference after copy/download, rejection, abort, unmount,
  or `pagehide`. Browser/network canary evidence covers both issue and redeem.

## Explicit non-goals

This increment does not open registration automatically, publish a flyer,
extract flyer data, send SMS/email, create attendee accounts, accept payments,
or promote claims into roster entries. A director must still separately choose
the existing tournament registration state and later review claims.

## Acceptance and rejection evidence

1. A director issues an open link for an eligible same-tournament registration
   state; the returned raw URL works once it is intentionally opened, and the
   database stores only a digest.
2. Exact retry returns only the original safe lifecycle receipt, never a second
   raw token; changed retry creates immutable conflict evidence.
3. Rotation produces one new active link, retires the prior link atomically,
   preserves prior claims' historical link reference, and makes the old public
   token generic-unavailable.
4. Closing registration and explicit link close both deny subsequent public
   context/claim use while preserving private audit history.
5. Anonymous, player, cross-tournament, revoked-role, malformed,
   unavailable-tournament, post-seating/score/finalization, direct-RPC/table,
   and concurrent issue/close/claim paths fail closed with no partial active
   link or stale claim insertion.
6. Real browser/network evidence proves the initial request contains no raw
   token and no external activity occurs while it exists in memory; no raw
   token is retained in storage, telemetry, application errors, request/route
   logs, referrers, QR-provider requests, redirects, or a recoverable issue
   response after the one-time display. It also proves legacy token-in-path
   routes are removed/revoked before the first v2 link opens.
7. Server/network evidence proves that the raw fragment value reaches only
   the same-origin endpoint: the corresponding Supabase RPC/query arguments,
   database receipts, lifecycle events, application diagnostics, and audit
   fields contain only opaque IDs or fixed-length digests.

## Implementation gate

The change requires a reviewed migration and a disposable-database test chain
before it may be applied to the pilot. This prevents an irreversible change to
the existing claim foreign-key history or accidental exposure of a flyer token.
