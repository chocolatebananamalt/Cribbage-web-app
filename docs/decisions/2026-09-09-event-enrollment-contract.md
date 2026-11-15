# Event enrollment contract — 2026-09-09

## Decision

Digital event participation is a separate, director/co-director-authorized
transition from roster/account linking. The writer may create one
`app.event_participants` record only when all of the following are true:

- the tournament is open;
- the target event belongs to that tournament, is approved Standard Singles,
  and uses the digital scoring method;
- the linked roster identity and profile are in the same tournament; and
- the roster identity's latest append-only check-in state is `checked_in`.

The participation record starts `checked_in` only because its roster check-in
precondition was verified inside the transaction. It remains distinct from
round assignment, current Table/Seat, canonical game creation, score
submission, confirmation, payment, qualification, and director role grant.

## Required safeguards

- Exact idempotent replay returns the same participant result; a changed replay
  is rejected and audited.
- One roster identity/profile may appear once per event. No client can choose
  another profile, an unlinked roster identity, or a cross-tournament event.
- The server locks the tournament/event and validates the current link and
  check-in evidence; direct table access stays revoked and append-only audit /
  receipt evidence is retained.
- Event enrollment must not occur after initial seating publication unless the
  later approved late-entry/exception workflow is used. The initial release
  rejects it rather than inventing a seating policy.

## Evidence required

Before release, independent disposable director/player sessions must prove
acceptance, exact replay, changed replay, unlinked/not-checked-in/withdrawn,
cross-tournament, unapproved/non-singles/manual event, duplicate enrollment,
post-seating rejection, revoked role, direct-table denial, and persisted
receipt/audit state.

## Sources

- `docs/product/production-requirements.md`, R-REG-01, R-VERIFY-01, R-BOUND-01.
- `docs/decisions/2026-09-09-roster-account-linking-contract.md`.
