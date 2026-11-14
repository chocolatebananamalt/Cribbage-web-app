# Planned ACC calculator policy version — balancing decision pending

**Current update,2026-10-30:** the owner has now approved exact largest-remainder $5 rounding locally. The text below records the earlier decision process; its pending-choice language is historical. Current policy and remaining integration gates are in [the approved decision](../decisions/2026-10-30-acc-weighted-balanced-q-policy.md). No historical policy or hosted record has changed.


The owner selected the ACC web calculator as the preferred authoritative source for future Q payout policy, superseding the assumption that friend charts should be primary. This does not rewrite stored policies, reviews or final accounting. The current local v2 accounting bridge preserves its exact source version and can support a later calculator through an explicit new policy/calculator version.

Observed source and limits: `../reference/acc-side-pool-calculator-observation-2026-10-29.md`. The public client formula distributes the unrounded pot exactly in the observed positive-denominator cases, then independently rounds every place to $5. Independent rounding does not preserve the sum. A later authorized Update test kept Prize Fund $590 versus Total Prizes $595 without visible warning/rejection/adjustment and enabled Print (not clicked). No actual payout or other account action occurred. This does not supply an approved app balancing rule.

For 59 paid entrants at $10, one-in-four, there are 15 suggested recipients: $150 baseline plus $440 apportioned over weights14..0 with denominator105. The unrounded amounts sum $590; independently rounded suggested fields sum $595. The clarified PDF row instead totals $590:105/85/65/55/45/40/35/30/25/20/20/20/15/15/15. It is a different schedule, not proof of the wizard's balancing rule.

## Required choice before implementation

The remaining choice is how a director reviews and resolves rounding residuals. The parent proposed a visible deterministic balancing proposal with explicit director confirmation, and blocking finalization while total awards differ from the pot. That mechanism has **not yet been confirmed**. Reducing one eligible amount by $5 can balance the example, but which award changes, constraints on minimum/order/equal groups, and confirmation/audit behavior must be defined rather than silently invented.

The latest recommendation is **largest-remainder balanced rounding**, still not implementation-approved: compute exact unrounded ACC amounts, floor each to $5, then allocate the remaining $5 increments by descending fractional remainder, with a disclosed higher-finishing-place tie-break. For the $590 example, the floors total $555 and seven increments go to places2/8/14/1/7/13/6. Proposed final amounts70/65/60/55/50/50/45/40/35/30/25/20/20/15/10 total $590. This is an app recommendation, not a verified ACC rule. It applies to distinct ranked Q/side-pool places; regular same-round playoff losers must retain equal awards. Exact rational/integer-cent arithmetic, fee-floor handling, pots not divisible by $5 and director confirmation remain policy/design requirements before implementation. No float-based balancing or silent historical recalculation is authorized.

No pool may borrow base-entry money or a general account to conceal rounding drift. Preserve separate fund conservation and no automatic paid state. A future version should retain raw suggestions, exact input count/fee/ratio/source, signed residual and explicit reviewed final amounts/reason; accepted policy/adjustment versions must be frozen and source-bound before obligations are authoritative. Changes to a reviewed source invalidate applicability, not immutable history.

## Bounded next implementation after that choice

1. New source-versioned calculator method and prepayment disclosure, retaining v1/v2 history readers and exact replay.
2. Server-owned calculation, TypeScript/SQL parity, finite/positive input checks and explicit unsupported-denominator handling. Low-count/server recipient derivation requires source confirmation; do not infer an unverified special case.
3. Director-visible raw suggestions, pot and difference, followed by the approved balancing/review workflow. No obligation/final accounting while unbalanced or unresolved.
4. Bind adjusted obligations to exact calculator/disclosure/recipient/funding/qualification/review versions using the existing unpaid accounting invariants. Existing chart policies stay readable and are never recalculated.
5. Tests for the ten observed differences,59/$10/one-in-four surplus, balanced cases, deficits, count/ratio boundaries, recipient ordering/ties, correction/stale/replay/concurrent review, full pot conservation and old-history preservation.

This document is planning only. No formula, payout source, balancing behavior, historical record or hosted state was changed.