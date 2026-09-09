# Player account-link activation contract — 2026-09-09

## Gap found

The existing director-only roster-account-link writer correctly requires an
already-known authenticated profile ID. No private read model or approved
identity ceremony supplies that ID to a director. Adding a name, ACC-number,
or email search would violate the existing rule against automatic identity
matching and could attach a tournament record to the wrong person.

## Decision

Use a **director-issued, one-time account-link activation** rather than a
profile lookup or a typed UUID. A director selects one private roster entry
and creates a short-lived, non-guessable activation for that entry. The link
contains no roster name, email, payment, seating, or profile identifier.

The player opens the activation while authenticated by magic link. The server
records only a pending request that binds the activation's roster entry to the
currently authenticated profile. It does not create a roster-account link,
event enrollment, role, check-in, seat, score action, or payment state.

This is a witnessed ceremony, not remote identity proof. The director hands
the one-time QR or link directly to the selected player, and redemption creates
a server-generated, one-time confirmation phrase. The phrase is shown to both
the authenticated player and the director while they are present. The director
must explicitly confirm that phrase before approval. It contains no identity
data and is never a search or matching value. A forwarded, photographed, or
otherwise suspicious activation must be rejected by the director rather than
approved.

The director sees the pending request as an opaque, single-entry approval and
explicitly approves it. Only that approval may invoke the existing
`link_roster_entry_to_account_v2` writer. The player cannot choose a different
roster entry or approve their own request; the director never needs to search
or type a profile ID.

## Required safeguards

- Activation values are stored only as a salted digest, are scoped to one
  tournament and roster entry, expire promptly, and have one use. A raw value
  is returned only once over a private, no-store response and is never retained
  in browser storage, logs, or the database.
- A QR/link activation value MUST be carried only in the URL fragment, never
  a path or query string, because fragments are not sent in HTTP requests or
  referrer headers. The initial HTTP response for the dedicated activation
  route must set `Referrer-Policy: no-referrer` and a route-level restrictive
  CSP before any subresource can load. Its CSP must use `default-src 'self'`
  and tightly limit `script-src`, `connect-src`, `img-src`, `form-action`,
  `base-uri`, and `frame-ancestors`; it must allow no third-party script,
  image, font, analytics, replay, APM, prefetch, service-worker, or external
  network request for the entire lifetime in which a raw value is in memory.
  Before React hydration, analytics, service-worker registration, prefetching,
  or any other application request, a minimal bootstrap must strictly parse a
  bounded fragment grammar and synchronously replace it with one fixed,
  sanitized same-route URL using `history.replaceState`. Parse or replacement
  failure must fail closed: do not redeem, navigate, hydrate the activation
  experience, or load further page content. The raw value may live only in a
  local non-rendered variable for the bounded same-origin redemption attempt;
  it must never enter React props/state, the DOM, browser storage, a cookie,
  cache, a redirect target, or a client error payload, and must be cleared on
  success, rejection, abort, unmount, and `pagehide`.
- The redemption request must be an explicit same-origin `POST` with
  `credentials: 'same-origin'` and `cache: 'no-store'`. The server must
  enforce same-origin `Origin` and Fetch-Metadata checks, bound the request
  body, return a private `Cache-Control: no-store` response, and ensure that
  platform logging, request capture, APM, telemetry, errors, middleware, and
  audit fields never retain the body. A redirect must never preserve a raw
  value. Immediate replacement is required to ensure no retrievable
  application/session-history entry retains it; it cannot eliminate transient
  address-bar exposure or capture by browser extensions, operating systems, or
  crash recovery, so short expiry and one use remain mandatory exposure limits.
- An unauthenticated visitor must sign in before opening an activation and then
  rescan/reopen it after authentication. The value must never be carried across
  authentication in `redirectTo`, a query/path, cookie, storage, session state,
  or any other continuation. A future alternative one-time server exchange
  needs separate security review before it may be designed or implemented.
- Creating, opening, expiring, cancelling, requesting, rejecting, and
  approving each create append-only receipt/audit evidence.
- The authenticated profile is learned only from verified server claims at
  activation redemption; no email, name, ACC number, PIN, or client profile ID
  can establish identity.
- An already linked roster entry, a profile already linked in the tournament,
  expired/cancelled/redeemed activation, cross-tournament use, replay with a
  changed request, or role revocation fails closed.
- The director approval view returns only the selected roster display name and
  request status; it does not become a profile directory or reveal unrelated
  players.
- Approval must call the existing receipt-bound writer with the server-stored
  profile ID, never a browser-supplied one.
- The approval transaction owns a stable inner link-operation ID distinct from
  the approval-operation ID. On every retry it locks and rechecks the request,
  activation, expiry, current role, and roster/profile collisions; it then
  requires the exact accepted receipt-bound result from the inner writer before
  recording an approval. A nested failure rolls back the approval event and
  link together, so no partial or ambiguous approval state can exist.
- Invalid, expired, cancelled, redeemed, and cross-tournament activation
  attempts return one generic non-enumerating result with the same observable
  response shape. Redemption accepts only the activation value and an
  idempotency key; approval accepts only the request, decision/phrase, and an
  idempotency key.

## Required server-only execution boundary

The activation functions must not be directly executable from a browser's
authenticated Supabase client. They require a server-only database credential
or equivalent non-browser execution identity. The Next.js route first verifies
the current user and same-origin request, then passes the verified subject to a
private database function. The database function must verify that trusted
server identity before it accepts that subject. A browser-supplied profile ID,
even if it matches the current session, is never accepted as authority.

Every operation must be serialized on the tournament/roster identity, not just
on the caller and idempotency key. Only one live activation can exist for a
roster identity. The state machine includes append-only `issued`, `requested`,
`cancelled`, `rejected`, and `approved` events; cancellation and rejection
must release the affected player or roster identity for a later safe activation.
The approval implementation must use an exception subtransaction around its
nested link writer and raise on a null, malformed, or role-revoked nested
result. Returning a normal failure after a nested writer may commit that
writer's work and is prohibited.

## Acceptance evidence before release

Two independent disposable player accounts and a director account must prove:

1. a director can issue/cancel an activation without exposing private roster
   fields publicly;
2. only the authenticated holder can request the specific activated link;
3. no request changes enrollment, score, role, payment, check-in, or seating;
4. a director approval creates exactly one immutable link, while exact replay
   is safe and changed replay/collision/expired/cross-tournament/revoked-role
   cases fail with persisted receipts; and
5. neither player can enumerate a roster, directory, activation, or another
   account's assignment.
6. two accounts racing to redeem one activation produce exactly one pending
   request without exposing either identity; a forwarded/wrong-account request
   is rejected at the witnessed phrase confirmation;
7. exact replays are safe, changed replays, expired/cancelled/redeemed and
   revoked-role races fail closed, and fault injection around nested approval
   leaves neither a partial roster-account link nor an approved event; and
8. raw activation values never appear in the database, logs, browser storage,
  cache, URLs sent to the server, telemetry, error reports, referrers, redirect
  targets, or retrievable application/session history. A QR uses only a URL
  fragment; its dedicated no-third-party route removes it synchronously before
  hydration or any further request and retains it only for the bounded
  redemption attempt. All new private tables/functions deny direct browser
  access.
9. a direct authenticated Supabase RPC call to the activation functions is
   denied; only the protected server route succeeds. Concurrent directors
   issuing an activation for one roster identity produce exactly one live
   activation, and a nested-link fault or role-revocation race leaves no link,
   approval event, or receipt behind.

This is the required identity increment before a director-facing account-link
screen or player assignment delivery can be safely built.
