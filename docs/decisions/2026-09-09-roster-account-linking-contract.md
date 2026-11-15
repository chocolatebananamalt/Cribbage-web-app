# Roster-to-account linking contract — 2026-09-09

## Decision

A private roster identity, an authenticated account, and a digitally scored
event participant remain three distinct records. The application may not infer
their relationship from a display name, ACC number, table/seat, a registration
claim, or an email typed into a public form.

The next identity increment will create an append-only,
tournament-scoped **roster-account link** only after a current director or
co-director explicitly links an existing authenticated profile to one private
roster entry. It is an authority to reveal that player's own assignment and to
make that profile eligible for later explicitly-created event participation;
it is not itself an event enrollment, role grant, check-in, payment approval,
seating assignment, score submission, or confirmation.

## Required boundary

- The writer accepts only a same-tournament roster-entry ID and existing
  profile ID; it never creates `auth.users` or `app.profiles`.
- The actor must be a current director/co-director. Profile discovery must not
  be exposed to ordinary signed-in users or public registration endpoints.
- One roster entry may link to at most one account and one account may link to
  at most one roster entry per tournament. A claimed email is evidence for
  director review only, never automatic matching authority.
- A link is immutable history with receipt/audit provenance. A mistaken link
  requires a separately designed, reasoned override/revocation workflow; this
  initial writer cannot overwrite or delete it.
- Exact same-request replay returns its original receipt. A changed replay,
  cross-tournament target, existing conflicting link, self-authorization,
  unauthenticated caller, and revoked official are rejected without linking.
- Direct client access to links and private roster identity remains revoked.
  A future player read RPC may return only that caller's own non-sensitive
  display name, permanent verification ID, and current assignment—not the
  wider seating list, contact data, payment history, or other players' IDs.

## Acceptance evidence before release

1. Two independent authenticated accounts and a director fixture prove only
   the director can create a valid link.
2. Exact replay, changed replay, link collision, cross-tournament request,
   revoked-role request, anonymous request, and direct-table reads all fail
   safely with persisted receipt/audit assertions where appropriate.
3. An account sees only its own assignment through a narrow RPC and cannot
   enumerate other roster identities or profiles.
4. A separate event-enrollment increment proves that only a linked account may
   become an assigned digital participant; linking alone changes no scoring or
   finance state.

## Sources

- `docs/product/production-requirements.md`, R-REG-01, R-VERIFY-01, and
  sections 3 and 3.1.
- `docs/product/requirements.md`, player initial Table/Seat delivery decision.
- User-approved magic-link authentication and hybrid verification decisions.
