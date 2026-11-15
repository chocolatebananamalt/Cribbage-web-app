# Standard Singles supervised playoff placement record

**Date:** 2026-09-11  
**Status:** Implemented locally; hosted migration and independent-session proof pending

## Decision

Playoff finish is a separate, supervised result record bound to one exact,
locked qualification result version. A director or co-director may record a
winner, runner-up, and additional sequential places chosen only from that
qualification version's qualifier list. Revisions append a new immutable
version and preserve the superseded version, actor, timestamp, operation
receipt, and exact idempotency result.

This record does not alter qualifying-round rank and does not infer bracket
rounds, byes, MRPs, Q-pools, prize amounts, payout allocation, publication, or
ACC export. Those capabilities remain explicitly unavailable.

## Settlement boundary

New settlement drafts must bind to the latest supervised playoff result and
their paid placement claims must match its participant/place pairs. The
binding is an immutable companion record so already-hosted historical draft
rows are not rewritten. A settlement draft remains provisional and retains
all existing blockers even after it is bound.

Legacy settlement drafts can be read as unbound history but cannot be used as
the basis for a new save through the version-2 application path.
