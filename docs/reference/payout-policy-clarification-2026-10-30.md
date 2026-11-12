# Payout policy clarification — 2026-10-30

## Latest owner direction and preserved authority

At 06:18 UTC the owner rejected penny-denominated prizes and requested whole dollars, preferably $5 increments, for regular and pool awards. At 06:19 he clarified that his rank-down statement concerned **graduated pools**: highest finishing paid entrants outside the playoff qualifiers may receive Q money. At 06:22 he directed the same ACC-based amount formula for graduated Q and Side Pools with $5 awards. The parent confirmed this means the previously approved total-preserving largest-remainder modification, not independently rounded awards that exceed/underspend the pot. Eligibility and equal finishing bands remain separate rules.

The friend's supplied message distinguished equal and graduated pools, said third/fourth regular percentages are combined and split equally, and item4 said, “It would be returned to the players.” That supports keeping the equal/no-eligible case separate; it is not evidence that a graduated pool should refund rather than rank down. The owner's latest clarification does not erase the distinction or authorize combining separate named pools.

Official-source context retained by the parent: 2019 Director Manual §8A describes equal/graduated choices; current Policy Manual chapter6 II.A.4–7 calls for the disclosed Q cost/payback type/ratio. The February11,2016 Board minutes item14h, printed pages6–7, withdraw the2015 Q action and require disclosed type/ratio. [Minutes source](https://www.cribbage.org/NewSite/about/ACC-Minutes_2016_02_11.pdf), [Director Manual](https://www.cribbage.org/NewSite/sched/Directors%20Manual%20-%202019.pdf). These retained findings do not establish a universal mandatory rounding algorithm, equal-pool penny allocation or general no-refund rule. The full Director Manual is not extracted locally; do not claim a new complete manual review from the selected notes. See [source index](INDEX.md).

## Exact current gap

The historical 17-player test conserved money but used an unapproved-for-current-operation regular cent rule: $93.51/$70.12/$46.75/$46.75/$23.37. Its $280.50 prize budget cannot be exhausted with whole-dollar or $5 prizes. No amount-only rounding can solve that arithmetic. Keeping the original expenses/benefits and paying $280 leaves50c unassigned; merely retaining it gives $433.00 participant return, below the $433.50 required minimum. Do not hide it in expenses, invent a receipt, reduce an actual expense or divert another pool's funds.

The recorded $10 refund obligation was from a distinct **equal** pool whose sole contributor did not qualify. Graduated Q1 had16 paid entrants, $160 awards80/55/25 and zero refund. Preserve both immutable unpaid finals/reviews as historical bookkeeping evidence, not current payout-policy approval. No actual refund or payment happened.

## Denomination audit

| Path | Current behavior | Required design change / hold |
| --- | --- | --- |
| Regular schedules, `src/lib/results/prize-schedule.ts`, API codecs and SQL0242/0253 | Floor weighted shares to cents; residual cents assigned to champion; same-band weights preserved. | New versioned denomination/cohort policy required. Preserve old versions. Never reuse this penny rule as the new operating default. |
| New graduated Q, `acc-weighted-pool.ts` and SQL0255 | Exact ACC weights plus total-preserving $5 largest remainders; supported fees$10/$20/$50, ratios4/6, paid count1–256. | Already whole-$5 in its tested domain. Keep source-bound recipient selection/tie blocking separate. |
| Legacy estimate, `finance/graduated-pool.ts` / payments `pool-calculator.tsx` | Independent nearest-$5 estimate with visible over/under difference; supports a wider input domain. | Replace future graduated suggestions with the shared exact balanced kernel; do not claim the current estimator already uses it. |
| Side Pool schedules/payout API `src/lib/api/side-pools.ts` | Director-entered minor-unit amounts/posted schedules, arbitrary fees and ratios up to100; no shared formula-version binding in this API. | Integrate the same versioned graduated amount kernel and $5 server checks without changing existing history or paid-state semantics. Wider fee/ratio/count support needs explicit tested domain treatment, not silent scaling. |
| Equal Q v1/v2, `q-pool-preview.ts`, `q-operating-schedule.ts`, SQL0245/0248/0255 | Qualifier-only equal split with penny remainder distribution; zero eligible produces unpaid refund obligations. | Current whole-dollar preference conflicts with penny splitting. Exact equal awards are feasible only if fund is divisible by recipientCount×unit. Otherwise block for director review until policy is chosen; no graduated substitution or pool merging. |
| Historical chart schedules | Exact retained amounts are already whole $5, with source/version provenance. | Preserve them as historical/explicitly selected schedules; do not rewrite to match the newer formula. |

## Concrete regular-prize options — proposals, not authorized budget edits

1. **Safest default: block incompatible budgets.** Require the director to resolve the actual documented budget before any new prize schedule/obligation can finalize. Store every cent in accounting; payout denomination is separate from ledger precision.
2. **Future $280 prize budget, whole $5:** a candidate4:3:2:2:1 cohort-aware schedule is **$95/$70/$45/$45/$25**. Semifinal losers remain equal and total exactly280. This is not valid against the existing280.50 budget without a separately approved real budget resolution.
3. **Illustrative future benefit-cost change only if supported/approved:** $230 expenses including $153.50 benefits leaves280 prizes and433.50 participant return. This would require50c additional genuine player-benefit cost, not invented food evidence. Historical expenses cannot be edited to force it.
4. **Illustrative future operating-cost reduction only if supported/approved:** $229 expenses leaves281 whole-dollar prizes; candidate **$94/$70/$47/$47/$23** totals281 and return434. It cannot be all-$5; there must be an explicit approved $1 fallback. Again this is a future budget option, not authority to reduce an actual card/rental cost.

For regular awards, round complete same-round cohorts together, preserve nonincreasing placement amounts and a positive award for every qualifier, and expose the final schedule for director approval. Independent per-person rounding can break equal bands or totals. A proposed exact constrained allocation must be versioned and independently tested before implementation; the two candidate arrays above are arithmetic examples, not an ACC-mandated chart.

For an equal $10 pool with three eligible recipients, exact equality plus whole dollars is impossible ($10/3); exact equality plus $5 is also impossible. $4/$3/$3 would conserve whole dollars but is not exactly equal, so must not be silently called an equal split. Current supported graduated pools avoid that issue via distinct ranked awards.

## Latest 06:22–06:24 direction: automatic policy, agreed once

The owner explicitly directs the same ACC-based weights plus the already approved total-preserving largest-remainder rounding for graduated Q and Side Pools, with $5 awards. He rejects per-event questions about where to place a leftover $5. This supersedes the earlier suggestion above of recurring director denomination/budget decisions. No new app behavior has been implemented.

Two different quantities must remain separate:

- **Allocation remainder:** a pot already on the $5 lattice leaves whole $5 units after floors. The existing ranked largest-remainder kernel deterministically distributes all of them. No director placement decision is required and no extra $5 remains.
- **Funding residue:** a genuine $280.50 budget is off that lattice. No sum of $5 awards can equal it. Altering the formula cannot create the missing funding or lawfully assign50c elsewhere without a prior policy.

### Recommended once-agreed automatic policy for review

Use the same exact $5 balanced amount kernel for graduated Q/Side Pools, preserving each named pot, eligibility, rank-down and tie controls. For regular prizes use a separate **cohort-aware** exact allocation: preserve equal same-round awards, positive awards for every qualifier, nonincreasing places, the disclosed weights and exact fund conservation. Among feasible $5 allocations, minimize total exact absolute deviation from the weighted shares; resolve an exact objective tie by higher finishing-place priority. This is a proposed application rule, not an ACC mandate or a change already authorized/applied.

To make arbitrary cent-based regular budgets compatible without per-event discretion, the universal solution preserving all stated constraints requires a **disclosed rounding-cover funding guarantee**, approved once with a named funding source and limits. Compute `cover = (500 - budgetMinor % 500) % 500`, target = budget + cover. For280.50, cover4.50 gives285.00. A cohort-aware candidate is95/75/45/45/25, totaling285 with equal semifinal awards; the difference from280.50 is real funding, not a rounding error.

The app can compute the cover requirement automatically and display it as a separately funded pending obligation, but cannot choose a donor, impose liability on the director, fabricate a receipt or finalize as fully funded before existing supported receipt evidence proves the cover arrived. A standing guarantee needs explicit owner approval; none exists now. This avoids a recurring **policy/placement question**, but cannot remove the real collection prerequisite. Do not add the contribution to base-entry gross for the85% denominator unless the approved accounting policy actually classifies it as entry fees.

For strict equal Q with `n>0` eligible recipients, all equal $5 awards require a fund divisible by `500*n`, not merely500. A $10 pot split exactly among3 needs a15-dollar funded target (cover5). That potentially larger cover must be included in the one-time guarantee or the equal denomination policy must be separately defined; never quietly turn it into unequal4/3/3 awards or graduated rank-down. The equal/no-eligible refund case remains distinct under the06:19 clarification and earlier source/disclosure; it has not been overridden by the graduated instruction.

If no rounding-cover funding is approved, there is **no** policy that simultaneously guarantees exact exhaustion of every arbitrary cent fund, only-$5 prizes, unchanged expenses/fees, no residual ledger and no extra money. A different global pre-budget/residual policy would have to relax a named constraint and be disclosed. For this exact85%-boundary fixture, simply retaining50c also fails minimum return. Do not present the cover option as already approved or secretly debit a general account.

### Smallest remaining decision

Agree once on the **funding residue rule**: approve a disclosed rounding-cover source/limits, or choose a different explicitly funded budget policy. No more decision is needed for where ranked LR puts whole-$5 allocation remainders. Regular equal-cohort allocation is a separate proposed deterministic rule to review with that choice. Graduated Q and Side Pool unification can be prepared independently against the shared kernel; current broader Side Pool fee/ratio inputs still need validated domain handling.

Next implementation must version policy/source contracts and preserve old exact replays, record kinds and immutable history. No migration, publication or hosted correction is authorized by this note. Test non-lattice funds, cover proof versus pending money, limits, exact rational cohort optimization/ties, equal-pool divisibility, per-pot isolation,85% denominator separation, legacy replay, stale sources, roles/concurrency and actual phone/desktop/SQL flows. Existing35 application tests and7 arithmetic-option tests prove current behavior/options, not approval of a new money policy.