# Persistent registration-link reveal and name-part contract

**Date:** 2026-09-17
**Status:** Accepted; implementation and release verification in progress

## Decision

Registration-link redemption continues to use only a salted one-way digest.
For newly issued or explicitly replaced links, the original bearer credential
is also sealed with AES-256-GCM in a private server-only database envelope.
The envelope is bound to the exact tournament and registration-link ID. It is
not readable by browser clients, public APIs, RLS policies, receipts, or audit
payloads.

Only the relevant tournament director or co-director can request a reveal.
The server verifies role, link head/version, active lifecycle state, and
tournament registration state, decrypts only in the protected route, and
returns the credential solely to that authenticated official. The reveal is
idempotent and audit-recorded without the bearer credential.

The existing Genesis Rehearsal credential is a legacy link: it remains active,
but cannot be recovered because raw credentials were correctly not persisted.
It becomes redisplayable only after an official deliberately replaces it,
which invalidates the older QR/link.

The existing link-state RPC keeps its previous response shape. A separate
protected availability RPC lets a newly deployed UI distinguish a recoverable
link from a legacy one. This makes the schema-first migration compatible with
the production client during rollout.

New public registration claims collect first and last names separately.
The database writes normalized parts and derives the established display name
so existing roster, scorecard, results, seating, and review readers remain
compatible. Existing display-name-only claims are historical data and remain
unchanged.

## Rejected alternatives

- Reconstructing a legacy QR credential from its digest: cryptographically
  impossible and would violate the original custody boundary.
- Storing the raw credential or returning it from the ordinary state reader:
  would make a bearer secret available on a broader API/database path.
- Rotating a link just to display it: disrupts a displayed or printed QR code
  and invalidates registrations needlessly.
- Changing the existing state-RPC response before the new client is deployed:
  would create an avoidable schema/client release ordering risk.

## Acceptance conditions

- A director/co-director can repeatedly view/copy a new active link with no
  state, expiry, limit, or version change; players and other callers cannot.
- Legacy active links remain usable but identify themselves as unrecoverable.
- Replacement invalidates only the old active link and makes the new link
  repeatedly viewable.
- Public registration exposes only the selected director name, phone, email,
  and optional mailing address, and accepts normalized first/last names.
