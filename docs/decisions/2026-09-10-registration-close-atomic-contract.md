# Atomic tournament-registration closure contract — 2026-09-10

## Problem

Initial seating correctly requires `registration_status = 'closed'`, but the
application has no authoritative operation that closes registration. Merely
changing that status elsewhere can leave a QR registration link active in
storage and complicates audit/retry behavior.

## Decision

Introduce one director/co-director-only, authenticated registration-close
operation. Under one tournament-scoped advisory lock and one locked tournament
row, it must:

1. reauthorize the current director/co-director;
2. reconcile an exact prior receipt before mutable lifecycle checks;
3. reject a new request unless the tournament is open and registration is
   currently open;
4. set `registration_status` to `closed`;
5. lock the current registration-link head and its linked record, if present;
6. retire/disable an issued enabled active link and move its head to `closed`,
   advancing the head version once; and
7. append one immutable receipt, link lifecycle event when applicable, and
   tournament audit event in the same transaction.

No new claim may be accepted after this transaction commits. A racing claim,
rotation, or close must serialize on the same tournament lock and observe a
single consistent outcome. The operation must be server-authorized and
same-origin when exposed through HTTP. It needs a unique operation ID and
exact replay behavior; it never accepts or returns QR credential material.

## Verification required

Use a disposable real database to prove active-link closure, no-link closure,
exact retry, stale/reused ID behavior, actor revocation, claim-vs-close and
rotate-vs-close races, direct browser-RPC denial, and resulting seating
eligibility. Then exercise the protected browser flow before any public
registration release.
