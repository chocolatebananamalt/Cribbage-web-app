# ACC weighted graduated Q policy with balanced $5 rounding

Status: owner approved LOCAL implementation and testing, 2026-10-30. No publication or hosted migration is authorized by this decision.

The owner selected the observed ACC side-pool raw weights as the future graduated allocation basis and explicitly accepted exact largest-remainder rounding after review of conservation and individual-prize tradeoffs. Name the method accurately: **ACC weighted formula with the app's fund-conserving $5 rounding**. This modification and the single-recipient convention are app choices, not ACC endorsement or a universal mandated payout formula.

For paid named-pool entrants N and disclosed ratio 4 or 6, recipients are ceil(N/ratio). Fund is N times the exact configured fee; do not count total tournament entrants or borrow base entry income. Fees supported by this version are $10/$20/$50, with a whole-$5 payout lattice and a bounded 1–256 paid-entrant application domain. Unsupported fees, ratios, counts or finer denominations block rather than infer another rule. One recipient receives the whole fund. Positive funds with no recipients and infeasible fee floors must block.

Compute the observed raw ACC branch with exact rational arithmetic. Floor each award to $5, then assign remaining $5 increments by descending exact fractional remainder, with higher finishing place first for equal remainders. Every final award must preserve the fee floor and nonincreasing rank order, and all awards must sum to the named pool's fund. The accepted fixed-recipient tradeoff includes rank 22 falling from $15 to $10 between 89 and 90 paid at $10/one-in-four; do not silently promise monotonic individual awards as entries increase.

Golden 59/$10/one-in-four awards are $70/$65/$60/$55/$50/$50/$45/$40/$35/$30/$25/$20/$20/$15/$10, totaling $590. These are distinct from the friend's historical table, whose weights differ from the observed ACC formula.

The new method must be explicitly selected, disclosed and frozen before election/payment, with exact policy acknowledgement and source-version binding. Preserve all chart/equal policies, reviewed obligations, finalized accounting and historical snapshots byte-for-byte; no automatic conversion or recalculation. Regular playoff shared-band awards and equal-Q allocation remain separate. Unresolved Q cash ties remain blocked; qualification tie resolutions do not silently authorize a monetary tie decision. Review and unpaid liabilities remain distinct from actual disbursement.

Standalone calculator evidence: 8 test groups, 320 retained research goldens and 1,536 supported combinations passed, with independent review finding no P1/P2. Policy persistence/UI/server-calculator parity and accounting integration remain a separate local implementation gate. Reusable research: [source observation](../reference/acc-side-pool-calculator-observation-2026-10-29.md).
