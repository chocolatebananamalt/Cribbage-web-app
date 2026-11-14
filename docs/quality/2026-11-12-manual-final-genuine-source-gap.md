# Genuine manual final-award source integration checkpoint

Source inspection and independent review found an actual incompatibility hidden by the previous synthetic reviewed-fund fixture. The V3 proposal writer retained `playoff_prize_proposal_range_safe_v2`, which rejects every Q/Side receipt allocation. The genuine V3 regular ledger intentionally includes those allocations within each conserved receipt. Therefore a real proposal could be rejected as `unsafe_proposal_range` before Finance review or final awards.

## Implemented fix

`database/proposals/selected-step-prize-range-v3.sql`, installed after `selected-step-final-review-v3.sql`, adds a distinct V3 validator and changes only the V3 proposal writer's exact validator call. Legacy validation stays unchanged. The original complete source is retained, not rewritten as a fabricated regular-only receipt.

The V3 validation preserves every receipt's conservation and original range/history arithmetic. Q and Side partitions must belong to declared pools of the same kind and current event; regular/cost partitions retain null pool IDs. Optional amounts never contribute to regular entry or expense totals. Duplicate source/pool identities, mismatched physical evidence, cross-event allocations, unreviewed classifications, missing pools and unsafe sums fail closed. No payout method or rounding policy changed.

The actual source chain remains:

1. Real V3 ownership source and reviewed immutable ownership journal → `selected_step_regular_ledger_v3` → `get_selected_step_prize_source_v3`.
2. Actual V3 proposal save (now compatible with that ledger) and current proposal workspace.
3. `selected_step_final_review_source_v3`, patched by the existing manual bridge to call `selected_step_fund_sporting_source_v3` → `modern_manual_sporting_source_v1`, which reads persisted generation/game/evidence/verification/result journals and current source/independence.
4. Actual fund-review writer and `current_selected_step_fund_v3` revalidation → manual final source/writer → actual V3 unpaid journal/current-or-historical readers.

Main four/five scope, separate funds, zero-income/fee holds, verified-only sporting outcomes, audit and exact recovery remain. Nothing in this change fabricates paper-player digital confirmation or converts unpaid accounting into payment.

## Focused evidence

Independent review: GO, no material findings. `tests/run-selected-step-prize-range-minimal-local-v3.mjs` passed using one authorized disposable fictional local Docker database. It installed the genuine original proposal store, genuine V3 save clone and new exact-call patch, then exercised the actual SQL range functions. The unchanged legacy function rejected the conserved optional-fund input; V3 accepted it and four existing methods. Invalid conservation/pool/event/identity/classification/overflow cases rejected. Regular-only input remained compatible and new functions remained revoked. Scoped runner lint passed. Result and hashes: `test-results/selected-step-range-minimal-20261112/result.json`; exact container removal verified (`cleaned:true`).

**This was a pure synthetic source-input DTO check. It did not invoke the genuine current collectors, save a proposal, run manual game journals, or accept a provider session.** The earlier manual-final writer acceptance likewise used synthetic reviewed-fund evidence. Neither result is end-to-end genuine acceptance.

## Remaining acceptance

The next bounded fixture must author coherent current activation/settings, actual event receipt partitions and ownership review, current qualification, a real modern proposal, persisted manual playoff evidence/verification/series, then the actual V3 fund review and manual final writer in the same fictional database. Existing minimal fixtures lack those upstream journal structures and cannot prove this by substituting another getter. No further source wiring gap was identified in this review, but joint runtime acceptance may reveal one. Provider/device and later release packaging remain separate. No hosted action, real payment/award/submission, denied retry, broad suite or frozen-release change occurred.
