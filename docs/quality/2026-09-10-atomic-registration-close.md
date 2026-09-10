# Atomic tournament-registration closure — 2026-09-10

## Acceptance criteria

Closing registration must be one server-authorized operation. It closes the
tournament registration lifecycle and, when present, disables the active QR
registration link under the same tournament lock. Browser roles cannot call
the database function directly; exact retries are safe and a changed reuse of
an operation ID is rejected without changing state.

## Implementation

Migration `0082_atomic_tournament_registration_close.sql` adds the
service-role-only `close_tournament_registration_v2` transaction. It locks the
same tournament lifecycle used by claims and link changes, reauthorizes a
director/co-director, reconciles an immutable receipt, then atomically closes
registration, the current open head, and its issued/enabled link as applicable.
It records a receipt, link event when a link changed, and audit record in that
same transaction. The protected application route accepts only a bounded
same-origin request from a verified session and uses the server-only client.

## Executed evidence

- Disposable synthetic database `donfxulkliuyteiannir`: migration applied.
- Catalog: `anon` execute `false`; `authenticated` execute `false`;
  `service_role` execute `true`; function is `SECURITY DEFINER` with an empty
  search path.
- Pilot database `fnjkwymxpnsqvxtpronk`: the identical migration applied;
  its catalog reports the same browser-role denial and service-only grant.
- Local lint, 111 tests, and the production build pass.
- Independent high-risk review found no P0/P1 implementation defect. It
  confirms that real lifecycle and concurrency execution remains a release
  gate rather than treating source-pattern coverage as sufficient proof.

## Remaining release evidence

This is not a public-registration release. Before activation, use a seeded
disposable database to prove active-link closure, no-link closure, exact retry,
operation-ID conflict, role revocation, claim-vs-close and rotate-vs-close
races, resulting seating eligibility, and the protected browser flow. The
public-registration switch remains disabled.
