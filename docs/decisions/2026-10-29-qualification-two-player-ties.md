# Qualification ties: source-bound ranking decisions

Approved local scope: owner messages through 2026-10-29; ACC 2025 Rulebook Appendix A item 20 (printed page 55 / PDF page 56), and Policy Manual chapter 6 IV.B.2. The rulebook is https://www.cribbage.org/NewSite/rules/ruleBook_2025.pdf. Parent verified these source sections; reusable reference Library ID `libfile_ce063920e6848191a0605c88aece74df`.

After game points, game wins, net spread, and gross positive winning spreads, an exact two-player tie uses one unambiguous current qualifying-round head-to-head result. When the pair has no qualifying meeting, the director records the winner of a separately played one-game playoff, with a reminder to cut for first deal. This game changes ranking only: it adds no qualifying game, points, wins, or spread. Multiway ties, repeated meetings, and inconsistent reciprocal evidence remain blocked in this first implementation.

The backend derives the pair and qualifying head-to-head evidence. It never accepts a client assertion of that evidence. Append-only resolution history binds the exact event, pair, method, winner, current evidence fingerprint, actor, timestamp, reason, reference and operation receipt. A source change invalidates applicability without deleting history. Same-source opposing decisions do not silently supersede each other. Finalization revalidates under shared locks and retains dispute, correction, recovery, notice and immutable-result guards.

Original numeric ranks and qualifying totals remain visible. Resolved ranking ordinals place the winner first; a resolved result's `tied` flag denotes no unresolved tie. Downstream Q source validation recomputes this same qualification digest. This does not change the independently versioned Q cash tie policy or execute any awards.

No historical finalized tournament is recalculated. New schema is additive; existing private finalizer and Q source helper are updated without changing their public signatures or existing human access. Publication and staging application require a separately verified artifact and approval. Local SQL, race, browser and full verification are required before readiness.
