# Manual roster-payment contract — 2026-09-09

## Scope

The initial app records only director/co-director-entered evidence that a
manual payment was received or voided. It does not process cards, infer payment
from a registrant preference, calculate a balance, authorize a refund, or call
an entry “paid in full” or reconciled.

## Chosen safe defaults

- Money is stored as integer minor units, never floating point.
- The first implementation accepts **USD only**. Other currencies, partial
  payments, waivers, refunds, check/reference numbers, and fee/balance rules
  require a separate approved decision.
- The authenticated director/co-director is the responsible recorder; callers
  cannot supply a different actor or server-recorded timestamp.

## Integrity rules

- A private, append-only payment event ledger is keyed to a private tournament
  roster identity, not a registration claim or account.
- A `received` event records positive USD amount, actual manual method, actual
  received time, recorder, and optional bounded note. Registrant-stated cash,
  check, or other preference is never payment evidence.
- A `voided` event references the exact current receipt, needs a reason, and
  preserves rather than overwrites the original. One receipt may be voided once.
- Every mutation is current-role director/co-director authorized, tournament
  scoped, expected-version guarded, idempotent, immutable, receipted, and
  audited. Unauthorized callers cannot add financial audit noise.
- Payment operations have no Auth/profile/role, event, check-in, seating,
  verification-ID, claim, or roster-identity side effect.

## Safe interrupted-operation recovery

- A browser must never recreate the database's canonical request hash. JSONB
  serialization, timestamp normalization, and whitespace/null normalization
  make that cross-runtime comparison unreliable.
- A future payment client persists before a request only an actor- and
  tournament-scoped opaque envelope containing the operation kind, roster ID,
  expected version, current receipt ID where relevant, idempotency key, and a
  local digest. It never persists amount, method, received time, note, or void
  reason. The digest is a local changed-input guard only, never authorization
  or proof of payload equality.
- Migration `0045` supplies caller/tournament/target/exact-kind/idempotency
  reconciliation. It intentionally does not revive the retired ambiguous
  three-argument function and does not require the client to provide a hash.
- On refresh, a client must reconcile before enabling another mutation. A
  strict terminal result clears the envelope and refreshes server state; an
  authoritative no-receipt result may clear it and permit a new request;
  transport, malformed, or authorization uncertainty remains locked. A changed
  retry is still rejected by the authoritative writer's request-hash check.

## Required evidence before release

Independent authenticated sessions must exercise received, voided, stale,
replay, concurrent, unauthorized, cross-tournament, direct-table-denied, and
injected-rollback paths with persisted ledger/receipt/audit assertions. Finance
reconciliation, balances, payout, ledger/export mapping, and finalization stay
blocked until their separate requirements and fixtures are implemented.

## Sources

- `R-REG-01`, manual-payment requirements, and finance gates in
  `docs/product/production-requirements.md`.
- Focused Sol payment-boundary review, 2026-09-09.
