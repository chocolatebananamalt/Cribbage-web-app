# Public registration boundary — 2026-09-09

## Decision

The QR/link workflow is a public **registration claim queue**, not a public tournament account, roster record, payment record, role grant, Table/Seat assignment, or verification-ID assignment.

- A director-created link contains a high-entropy raw token; the database retains only its SHA-256 hash.
- The link functions only while both the link and a separate tournament registration state are open.
- Public callers may submit name, email, optional ACC number, and a non-authoritative intended cash/check/other payment method.
- The server creates a private claim. It never creates an event participant, role, seat, payment receipt, or authenticated user.
- The submitted claim is immutable. Any later director action must be an append-only, separately authorized decision/ledger event rather than an edit to the visitor's submission.
- Name, email, or ACC-number collisions produce a private `needs_review` claim; the public response is intentionally non-enumerating.
- Only a future director/co-director operation may accept a claim, create/associate the roster identity, record audited payment, or check in the player.

## Rationale

This implements the user's QR/link registration decision without allowing an untrusted flyer visitor to obtain tournament access or self-attest payment. It keeps automatic online payment and ACC portal submission outside the first release, as recorded in `PRD-001`.

## Acceptance boundary

The foundation is complete only when an open, valid link accepts one idempotent claim; closed/invalid links and malformed data are rejected; collisions are held; private registration tables have no direct anonymous/authenticated access; and no public path can create a role, event participant, seat, or payment record.
