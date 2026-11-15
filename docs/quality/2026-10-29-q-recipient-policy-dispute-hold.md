# Q recipient policy disputed — implementation and settlement hold

2026-10-29. Independent ACC source re-review is underway after Daron challenged recipient selection. This is a documentation-only hold, not a new policy interpretation or a change to code, migrations, permissions, published UI or hosted data.

**Disputed:** limiting Q recipients to the intersection of paid pool entrants and playoff qualifiers; returning all contributions when that intersection is empty. Daron understands a predetermined recipient count selected down paid entrants' standings, including non-playoff qualifiers when necessary. Do not treat either interpretation as settled until the original ACC formula, examples, denominator, ranking and applicable payout type are verified. Earlier successful tests prove the implemented assumptions, not their correctness under ACC rules.

## Preserved evidence

Keep existing policies and unpaid batch untouched: tournament e7bc6541-58b0-4465-8cde-3ccb7c2e6da6, review b5576ce8-7a59-4de5-a984-ce37f7645f2d, version 1; source digest 392c3da81ffe67a151e0f6c23bd839c97430479c6d6376ab6e417a2f0c60a881. Its 6.67/6.67/6.66 award amounts and $10 refund obligation are evidence of the disputed implementation, not an approved actual distribution. All remain unpaid. Do not delete, rewrite, execute, finalize or add a correction batch during this hold.

Canonical settlement integration has not been implemented. Payments, actual refunds and canonical Q settlement remain disabled. No source or hosted changes were made by this assessment.

## Direct code/schema dependencies

- `src/lib/results/q-pool-preview.ts`: `equal-paid-qualifiers-v1`, disclosure text, qualifier-only source type/codec, intersection recipient selection, qualifying-order pennies and zero-recipient refund branch.
- `src/lib/api/q-pool-policy.ts`: accepts only that method; API routes under `src/app/api/v1/tournaments/[id]/q-pool-policy/` forward this contract.
- `src/app/tournament/[tournamentId]/q-pool-policy/policy-client.tsx`: discloses that interpretation and renders its awards/refunds.
- `database/migrations/0244_q_pool_policy_preview_v1.sql`: immutable method constraint/publication validation and source reader providing only qualified result rows, not the full standings needed for possible roll-down. Do not edit the applied migration.
- `database/migrations/0245_q_obligation_review_v1.sql`: authoritative server calculator joins contributions to qualified rows, then produces refunds when no recipients exist. It freezes that calculator/source manifest into immutable reviews. Do not edit applied SQL or historical reviews.
- `src/lib/api/q-obligation-review.ts`: award rows require positive `qualificationRank`, refund rows null. A verified roll-down policy may need an explicit standings/recipient rank rather than implying every recipient qualified for playoffs.
- `src/app/tournament/[tournamentId]/q-obligation-reviews/review-client.tsx` and corresponding API routes: display/save this source-bound result. Audit/recovery/authorization safeguards can remain useful independently of recipient policy.

The membership/allocation framework in 0243 does not itself choose recipients. Its opt-in, exact-pool payment allocation and fully funded states should be assessed separately from payout selection.

## Tests and expected-data dependencies

`tests/q-pool-preview.test.mjs`, `q-pool-policy-v1.sql`, `q-pool-policy-browser.mjs`, `q-pool-policy-concurrency.mjs`, `run-q-pool-policy-isolated.mjs`, `fixtures/q-policy-source.mjs`; `q-preview-hosted-fixture.test.mjs` and its quality JSON; `q-obligation-review.test.mjs`, `q-obligation-browser.mjs`, `q-obligation-sql-acceptance.mjs`, `q-obligation-race.mjs`, `q-obligation-score-stale.mjs`, `q-obligation-security.mjs`, `run-q-obligation-isolated.mjs`, `fixtures/q-review-foundation.mjs` and `fixtures/q-review-games.json`. Some test the policy directly; others inherit its golden fixture. Preserve useful security/conservation/replay regressions while replacing or extending policy oracles only after verified source interpretation. Passing these does not prove ACC recipient correctness.

Existing `src/lib/finance/graduated-pool.ts` uses `ceil(playerCount / payoutRatio)` and $5-rounded graduated estimates; its UI is `src/app/tournament/[tournamentId]/payments/pool-calculator.tsx`. It does not bind recipient identities or full standings. It is a separate unverified estimator, not an authoritative replacement and not proof of Daron's exact formula.

## Correction scope once research resolves policy

Verify recipient count/denominator and rounding, all eligible paid entrants' standing order, ties at the cut line, equal versus graduated variants, zero playoff purchasers, incomplete payments and whether any genuine refund branch remains. Do not conflate regular playoff prizes, Q awards and Side Pools.

Any repair must use explicit versioning for changed policy/calculator/source contracts and retain old operation replay/history. Frozen paid-pool policy cannot silently be edited or retroactively re-acknowledged; current pre-payment disclosure guards deliberately forbid that. A correction path or a new test fixture therefore needs explicit design and authorization after research. No new data or migration is proposed for application now.

Generic future accounting architecture (base/Q partition, conservation, immutable evidence, authorization and replay) remains useful, but recipient selection, refund semantics, source contracts and canonical integration are held. No unverified assumption should be baked into the next adapter.

## Verified later Board action supplied during the hold

The official [February 11, 2016 Board minutes](https://www.cribbage.org/NewSite/about/ACC-Minutes_2016_02_11.pdf), item 14h, printed pages 6–7, withdraw the September 2015 Q-pool action and require the chosen pool type and payout ratio on the flyer and sanctioning request. Vote: 14 for, 7 against, 2 abstained. The PDF identifies itself as final, approved October 7, 2016. The relevant text was independently read during this dependency audit as well as reported by the parent's research.

Therefore the withdrawn 2015 all-paid-playoff-qualifier rule must not be treated as universal current eligibility. This action does **not** by itself establish a universal fixed-number rank-down formula. Daron's ranked paid-entrant interpretation remains a distinct policy to verify against the original manual/examples and current policy before implementation. Neither this finding nor earlier user approval of a proposed test policy authorizes a silent historical rewrite.

The correction may require the source contract to carry full finalized standings, not only playoff qualifiers, with a truthful standings/recipient rank and tie-cutoff rules. Existing canonical v1 records must remain versioned evidence; no changes were made to the paid pool disclosures or unpaid batch.

