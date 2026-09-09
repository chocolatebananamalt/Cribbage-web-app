# Registration-claim review contract — 2026-09-09

## Scope

The public QR/link endpoint records an immutable, non-authoritative
`registration_claim`. The protected director review increment may decide only
one of the following:

- `approved_for_roster`: the claim has been reviewed and may later be used by a
  separately authorized roster-creation workflow;
- `rejected`: the claim will not be used for that purpose.

Neither decision creates or associates an Auth user/profile, tournament role,
event participant, payment receipt, check-in, Table/Seat, permanent verification
ID, or scorecard. The original claim is never updated.

## Security and integrity rules

- Only an authenticated director or co-director in the same tournament may read
  the review workspace or append a decision.
- Claims, decisions, receipts, audit events, and collision references are all
  tournament scoped; public callers receive none of them.
- A claim has at most one immutable decision. A fresh second decision is a
  recorded terminal rejection; an exact idempotent replay returns its original
  response. Changed reuse of a client operation ID is recorded as a private
  conflict.
- The writer locks the tournament, registration link, and claim before it
  recomputes collisions. It rejects finalized/archived tournaments and requires
  director/co-director authorization at decision time.
- A collision approval requires `confirmed_distinct_person`. A duplicate
  rejection requires a different, same-tournament `duplicate_of_claim_id`.
  The decision never trusts the claim's intake status as collision proof.
- Reason text is optional but, when supplied, is trimmed and bounded to 500
  characters / 2,000 UTF-8 bytes. It is kept private.
- Every accepted or domain-rejected decision has an immutable operation receipt
  and audit event in the same transaction. Unexpected errors roll back all
  writes.

## Required acceptance evidence

1. Director/co-director read and decide a same-tournament claim; player,
   cross-checker, viewer, unauthenticated, revoked, and cross-tournament callers
   are rejected or receive no workspace.
2. Collision, malformed input, oversized reason, invalid resolution, duplicate
   self/reference/cross-tournament reference, finalized/archived tournament,
   already-decided claim, exact replay, changed replay, and concurrent decision
   paths are exercised.
3. Tests prove no review operation writes `auth.users`, `app.profiles`,
   `app.tournament_roles`, `app.event_participants`, payment, check-in, seating,
   or verification-ID data.
4. Direct private-table access is denied; the narrowly granted authenticated
   RPCs use `SECURITY DEFINER`, empty search paths, and explicit `auth.uid()` /
   role checks.

## Sources

- User registration/check-in/payment/seating decisions, 2026-09-06 through
  2026-09-09.
- `docs/product/production-requirements.md`, `R-REG-01` and section 3.1.
- Focused Sol registration-boundary review, 2026-09-09.
