# Registration-claim roster-promotion contract — 2026-09-09

## Scope

An immutable director/co-director-reviewed `approved_for_roster` registration
claim can produce one immutable, private tournament roster identity. This is a
small administrative bridge between public registration intake and later,
separately approved player/account and event workflows.

## Explicit non-effects

Creating a roster entry does **not** create an Auth user or profile; match an
existing account; grant a role; enroll an event; record payment; check in a
player; assign a Table/Seat or permanent verification ID; create a scorecard;
or determine eligibility. Claimed name, email, and ACC number remain unverified
intake data even after the director's administrative decision.

## Security and integrity rules

- Only an authenticated director/co-director in the same draft/open tournament
  can use the protected read/write RPCs.
- The writer accepts only a tournament ID, immutable approved-decision ID, and
  idempotency key. It copies identity snapshot fields from the source claim;
  callers cannot supply them.
- The roster entry references its exact same-tournament claim and its exact
  `approved_for_roster` decision through a composite foreign key. One source
  claim and one decision can create at most one entry.
- Direct table access is revoked and RLS is forced. Director/co-director read
  access is through a narrow workspace RPC only; anonymous routes expose no
  roster information.
- Exact idempotent replay returns the original opaque response. Changed reuse
  records an immutable conflict. An already-promoted decision gets an auditable
  rejection. Accepted/rejected domain operations receive private receipts and
  audit events atomically; unexpected errors roll back.
- The entry and operation-conflict records are immutable.

## Acceptance and rejection evidence

1. Director/co-director can create one entry from a same-tournament approved
   decision. Exact replay returns that entry; a concurrent/different attempt
   cannot create another.
2. Unauthenticated, player, cross-checker, revoked, cross-tournament,
   finalized/archived, rejected/unreviewed/mismatched-decision, and direct-table
   callers are rejected or receive no data.
3. Tests and database inspection prove the operation leaves `auth.users`,
   `app.profiles`, roles, event participants, payment, check-in, seating, and
   verification-ID data untouched.
4. Pilot integration requires independent authenticated sessions and persisted
   data assertions before this increment can be treated as release evidence.

## Sources

- `R-REG-01` and section 3.1 of `docs/product/production-requirements.md`.
- Registration-claim review contract, 2026-09-09.
- Focused Sol security architecture review, 2026-09-09.
