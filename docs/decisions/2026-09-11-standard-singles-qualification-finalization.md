# Standard Singles qualification finalization

**Date:** 2026-09-11
**Status:** Implemented locally; hosted migration and independent-session proof pending

## Decision

The October pilot may finalize the qualifying round independently of later
playoff and financial work. A director or co-director can create one immutable
version-1 qualification snapshot for an activated digital Standard Singles
event only after the published schedule and every participant scorecard are
complete.

The server ranks by game points, games won, net spread points, then plus
points. The qualifier count is one per four entrants rounded up. An exact tie
across the qualifying cutoff—or an exact tie that prevents naming one High
Non-Qualifier—blocks finalization. Names and UUIDs never resolve a rules tie.

Finalization also fails closed for an unresolved canonical game, pending or
disputed device recovery, pending correction, or a qualification-changing
correction whose required notice workflow is unavailable. The accepted
snapshot freezes further score, participant, recovery, and correction mutation
for that event. Exact request replay returns the original receipt; a changed
reuse is rejected and recorded.

## Output boundary

The stored snapshot contains every qualifying-round rank, the ordered
qualifier list, and one separately labeled High Non-Qualifier immediately
after that list. It explicitly provides no playoff winner or runner-up, MRP,
Q-pool, payout, or official ACC export authority. Those remain separate later
result versions and approved rule fixtures.

## Source basis

- Cached *ACC Official Tournament Rules 2025*, Rule 13.2.
- ACC Tournament Director's Manual ranking sequence already recorded in
  `docs/decisions/2026-09-10-qualification-preview-boundary.md`.
- Owner correction preserving qualifying rank independently of playoff result,
  recorded in `docs/decisions/2026-09-10-qualification-and-playoff-result-separation.md`.
