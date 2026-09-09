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

The director sees the pending request as an opaque, single-entry approval and
explicitly approves it. Only that approval may invoke the existing
`link_roster_entry_to_account_v2` writer. The player cannot choose a different
roster entry or approve their own request; the director never needs to search
or type a profile ID.

## Required safeguards

- Activation values are stored only as a salted digest, are scoped to one
  tournament and roster entry, expire promptly, and have one use.
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

This is the required identity increment before a director-facing account-link
screen or player assignment delivery can be safely built.
