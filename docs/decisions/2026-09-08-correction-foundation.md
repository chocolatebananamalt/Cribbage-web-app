# Correction foundation decision — 2026-09-08

## Decision

Implement corrections as an append-only, server-authorized workflow separate from
the original score submissions and confirmations. A correction must never overwrite
or delete the independently verified source history.

The first implementation boundary is verified Standard Singles games only. A
cross checker may propose a correction only for another player's game. New
tournaments default to immediate correction authority and an optional reason. A
future policy version may require a reason and/or an eligible second cross
checker or director approval; such a pending correction has no effect on score
projections, standings, publication, or export.

## Required server behavior

- Snapshot the base game version, original winner/margin, editor, server time, and
  policy values in immutable correction history.
- Accept only a changed winner/margin in the 1–121 range. Derive reciprocal
  Plus/Minus and 0/2/3 game points on the server.
- Reject unauthenticated, wrong-role, cross-tournament, self-card, stale-version,
  duplicate/conflicting idempotency, non-verified, invalid, and published-result
  correction attempts.
- In the immediate-default path, append the correction and its `applied` state,
  update both current scoreline projections and the canonical game atomically,
  increment the game version, and append an operation receipt/audit event.
- Preserve the two source submissions, two confirmations, verification receipt,
  and verification audit events unchanged.
- Keep published results fail-closed until versioned result supersession is
  implemented.

## Verification gates

The migration and RPC require an independent high-risk review plus pilot checks
for successful non-self correction, reciprocal recomputation, and every rejection
listed above. Deferred game invariants must distinguish an original `verified`
game from a `corrected` game whose effective result is the latest applied
correction.

## Sources

- User correction decision, 2026-09-06.
- `docs/product/production-requirements.md`, R-CORR-01 and section 5.4.
- Focused Sol scoring/security review, 2026-09-08.
