# Hybrid digital-and-paper completion boundary

**Decision:** A mixed-scorecard Standard Singles game uses the one immutable
digital player's submission plus an independent transcription of the original
paper card. One identity-bound cross checker may bind the exact reciprocal
match, but that case is non-authoritative. A second distinct, non-player,
currently authorized and identity-bound official must independently re-enter
the paper claim and confirm the digital submission identifier and result.
Only that exact approval writes the two reciprocal scorelines.

The case snapshots both explicit scorecard-preference versions, the game
version, digital submission, first official identity binding, and paper
reference. Approval revalidates every snapshot, current-game progression,
both officials, and mutual exclusion from ordinary confirmation,
paper-versus-paper completion, and failed-device recovery. Rejection may close
a mismatched or stale case without granting authority.

All records are append-only, audited, idempotent, server-role-only, and
recoverable from actor-scoped operation receipts after a lost response.
Identity-sensitive writers use one compatible lock hierarchy: actor/operation,
then the tournament row, then tournament-scoped official-identity locks, then
role/identity rows and the receipt lookup. Existing roster-link and event-
enrollment writers already take actor/operation before the tournament row;
their identity guard therefore joins the same hierarchy rather than forming a
tournament-to-identity inversion with official binding or review.

**Deferred evidence:** migration 0148 has not been applied to the hosted pilot.
Its rollback fixture and independent-session browser flow remain required.
