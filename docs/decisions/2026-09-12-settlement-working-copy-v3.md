# Settlement Working Copy v3

Date: 2026-09-12  
Status: accepted for implementation; not hosted

## Decision

Allow a current tournament director or co-director to transcribe provisional MRP claims into an immutable, versioned Standard Singles settlement working copy. Each entered claim is a whole number of points (zero is valid) and requires a short source/evidence note. Omitting a participant's claim remains distinct from entering zero.

The write is bound to the exact current locked qualification result and latest supervised playoff result. MRP and Q-pool claimants must be qualifiers in that qualification result. The server remains the authority for payment and expense snapshots. The feature never calculates, reconciles, approves, publishes, or submits an MRP, Q-pool, prize, payout, or ACC record.

## Safety and lifecycle

- Store one immutable MRP row per settlement version and participant.
- Reuse the event-scoped post-event lock used by playoff placement and settlement writes.
- Check the current tournament and current director/co-director role before reading or writing idempotency receipts.
- Require an exact expected settlement version and include all MRP claims in the request digest and retry envelope.
- Reconcile accepted and rejected attempts by actor, tournament, event, operation type, and operation ID; audit changed-key conflicts.
- Keep the workspace and CSV private and server-derived. The CSV carries a deterministic SHA-256 digest of its canonical source and conspicuous non-authoritative wording.

## Deferred authority

Automatic MRP and Q-pool calculations, event allocation of tournament-wide money, reconciliation, approval, publication, and official ACC submission remain blocked until dated authoritative rules/fixtures and applicable ACC approval exist.
