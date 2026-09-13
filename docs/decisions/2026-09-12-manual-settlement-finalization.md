# Manual Settlement Finalization

Date: 2026-09-12  
Status: accepted for implementation; not hosted

## Decision

Provide a private director/co-director action that turns a reviewed Standard Singles settlement working copy into an internally reconciled, immutable finalization version. The director supplies the event income, event expense allocation, retained balance, and a bounded official-source reference, while placement, Q-pool, other-award, MRP, payment-receipt, and expense values remain bound to server-held records.

This is an explicit transcription and reconciliation control. It is not an ACC payout or MRP calculator, a payment action, results publication, or an ACC submission.

## Required gates

- Current director or co-director authority is checked by the server before operation-receipt lookup.
- The latest qualification result, supervised playoff result, settlement working copy, and payment/expense snapshots must match exactly. Payment and expense identity is compared symmetrically against every active immutable event ID, so an equal-count/equal-value replacement cannot pass using a stale draft.
- Every qualifier has an explicit MRP claim, including a recorded zero where appropriate.
- No event dispute is open.
- Event income equals event expenses plus placement payouts, Q-pool payouts, other awards, and retained balance.
- Latest finalized event allocations cannot collectively exceed the tournament payment and expense ledgers.
- All six review attestations are exact and true, including acknowledgement that no ACC submission occurs.

## History and retry behavior

Every accepted finalization creates a new immutable version linked to the prior version. Accepted and controlled rejected attempts receive actor-scoped operation receipts and audits. A repeated identical operation returns the stored result; a changed reuse of the same operation ID is rejected and separately audited. The browser preserves the exact unresolved request and reconciles it before allowing a new attempt.

An exact stored accepted or rejected response remains replayable after the tournament lifecycle closes, provided the actor still has a current director/co-director role. Lifecycle eligibility is applied only to new operations and changed operation-ID reuse; it does not erase the outcome of an operation that already reached the server.

Settlement mutations use one lock order: actor/operation advisory lock, event post-processing advisory lock, tournament row lock, then actor role row lock. The expected-error path reacquires that same order and revalidates both tournament lifecycle and current director/co-director authority before it reads a receipt or creates any conflict, receipt, or audit row. Payment and expense writers share the tournament-row boundary, keeping exact ledger event IDs stable while finalization checks them.

## Deferred authority

Automatic payout, Q-pool, and MRP formulas; result publication; payment execution; and ACC portal submission remain outside this release until dated authoritative rules and an approved integration contract exist.
