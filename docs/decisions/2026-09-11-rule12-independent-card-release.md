# Rule 12.2 corrections release as independent card adjudication

**Decision date:** 2026-09-11  
**Source:** ACC Official Tournament Rules 2025, Rule 12.2(a)–(i), cached checksum `DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`

Migration 0140 replaces the suspended reciprocal-game correction boundary with a service-only independent-card workflow. A current, non-self cross checker selects the applicable source case and records both original card claims. The database independently validates cases 12.2(a)–(f) and (h), including the mutually exclusive favorable 12.2(a) and already-adverse 12.2(h) directions, derives each card's adjudicated result, and never rewrites `canonical_games` or `card_scorelines`.

The active versioned tournament policy still controls optional/required reason and immediate/one-independent-approval authority. Review v2 grants authority only after rechecking the current event, publication, role, non-self, and immutable policy-snapshot scope; the legacy review RPC is revoked even from the service role. Exact retries reuse their immutable receipt; changed reuse conflicts. Applied projections are already consumed once by the player scorecard, preliminary standings, and qualification preview. Pending and rejected projections remain excluded.

Rule 12.2(g) is represented by those derived scorecard totals and standings, not a selectable disposition. When an applied correction is marked as changing qualification fact or position, the cross checker selects the affected participant from the event roster; that participant may be someone displaced by the correction rather than one of the two card holders. Rule 12.2(i) then creates an immutable notice attached to the correction and game evidence. The player's scorecard displays that notice without exposing the private correction reason.

The original release gate recognized only
`ACC_RULE12_CORRECTION_ENABLED=approved-0140`. That gate is superseded by the
owner-approved October activation decision dated 2026-09-12 after migration
application, hosted rollback proof, and independent review. Real
cross-checker/reviewer/player rehearsal remains acceptance evidence, but a
missing Vercel value no longer hides the required protected workflow.

Legacy `propose_game_correction` and `review_game_correction` grants stay revoked and must never be restored.
