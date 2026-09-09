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
  in browser storage, logs, URLs/referrers beyond immediate redemption, or the
  database.
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
   cache, or referrers, and all new private tables/functions deny direct
   browser access.

This is the required identity increment before a director-facing account-link
screen or player assignment delivery can be safely built.
