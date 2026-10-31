> **Policy re-review hold — 2026-10-29:** Recipient selection restricted to paid playoff qualifiers and the no-eligible refund assumption are disputed pending original ACC formula/example verification. This document records earlier implementation/test evidence, not proof of ACC policy correctness. Preserve all unpaid history; do not execute payouts/refunds or continue settlement integration. See `2026-10-29-q-recipient-policy-dispute-hold.md`.
# Q Pool payout preview — bounded architecture proposal

2026-10-28. Read-only repository planning after the successful hosted membership/allocation test. No application behavior, policy, migration, permission or hosted record changed. Incorporates the parent's independent ACC research findings; this document does not approve the proposed policy.

## Source findings supplied by independent research

Director Manual §8A allows different Q award methods and does not guarantee every paid playoff qualifier a Q award under every method. Announce the **number of Q entrants** before play; this is not a source requirement to announce dollar totals. Current Policy Manual chapter 6 II.A.4–7 requires flyer Q cost, payback type and payout ratio; a Q payout percentage need not equal the playoff qualification percentage. Keep regular playoff prize coverage separate. Reduced-recipient fraction wording remains insufficiently clear for an executable formula.

Proposed first policy, **awaiting user approval**: equal shares to the intersection of finalized playoff qualifiers and current fully paid members of the exact named pool; distribute 100% of valid fully allocated Q fees separately from base-entry funds, resolving partial/stale allocations and refund obligations first. Block disputed qualification. Proposed odd cents go by final qualifying order; proposed zero-recipient outcome is full refunds to each contributor. Those final two are app choices, not ACC mandates. Preview may show refund obligations but must not issue refunds. If qualifying order is unresolved, block penny assignment rather than choose by UUID. Graduated/reduced variants remain unsupported pending explicit denominator, ranking, weights and tie policy.

Current source format caveat: Main minimum 17 entrants remains; one-day Main minimum 11 qualifying games and Consolation minimum 10 apply. The two-player software rehearsal is not sanction certification. Exact official-source citations are owned by the independent research report; this architecture note does not elevate older cached interpretation over current policy.

## Confirmed integration boundaries

| Existing contract | What can be reused | What must not be inferred |
| --- | --- | --- |
| `src/lib/api/q-pool-membership.ts`, migration 0243 | Exact pool-version election, consent reference, obligation/receipt versions, explicit whole-receipt allocation, currentness and fully funded paid-entry status | Paid-entry eligibility is not payout eligibility. A consent string is not proof of disclosure of a complete payout policy. |
| `src/lib/api/qualification-finalization.ts`, migration 0131 | Immutable finalized qualification result/version, participant IDs, qualification ranks, qualifying statistics and tie flags | Live standings, playoff finish or MRP are not substitutes for the qualifying result. Finalization rejects unresolved cutoff/ranking ties. |
| `src/lib/api/setup.ts` | Activated Q pool version, fee, free-form type/note and historical setup revisions | Current type/note does not encode an exact executable payout contract, disclosure event or freeze-before-payment invariant. |
| `src/lib/api/settlement-v5.ts`, migration 0240 | Exact source bindings, current-source checks, immutable draft/final history, operation receipts, source/ledger invalidation and cash conservation | Existing API explicitly has `qPoolClaims:false`, `automaticPayout:false`, and `noQPoolClaimsRecorded:true`. `app.settlement_award_blocked_v5` blocks configured positive-fee Q Pools. Do not remove that guard for a preview. |
| `src/lib/finance/graduated-pool.ts` | Historical estimator only | Uses ceil(playerCount/payoutRatio), descending weights, $5 rounding and `manualAdjustmentRequired` when unbalanced. It neither selects paid members nor binds qualification/policy versions. It is not an ACC-authoritative payout implementation. Side Pool awards are also separate. |

0243 currently supports one activated Standard Main, positive Q fees, no Side Pools/other events. Keep that narrow boundary for the first preview. Do not silently expand it to Consolation, teams, byes or mixed historical configurations.

## Recommended minimum implementation, after policy approval

1. **Versioned disclosed policy first.** A future additive policy record binds tournament/event and exact setup Q pool version. Store complete method/source label, eligible population/count rule, equal/graduated weights if applicable, tie/cutoff rule, cent-remainder rule and no-recipient disposition. An effective disclosed version must precede the first relevant payment/consent, not merely Start Play. Freeze it before collection; reject incompatible changes after collection. A change needs a separate explicitly designed re-disclosure/re-consent workflow, not editing the old version. Existing paid pools without proven full-policy disclosure remain legacy/unverified and cannot be retroactively labelled compliant.
2. **Pure read-only calculator plus authorized source reader.** Join finalized qualification participant IDs to exact-version, current, fully paid Q elections. Keep all paid members as the funding population; separately derive the policy-defined recipient population. Do not sum only the winners' payments. Do not assume whether recipients are all paid Main qualifiers or a top fraction of pool entrants: that is awaiting source/policy resolution. Preview each pool independently in integer cents and render USD.
3. **Explicit source envelope.** Include policy/disclosure version ID, setup event/pool version IDs, qualification result version ID and ordered eligible/funding membership IDs, allocation IDs/versions, obligation versions and payment receipt IDs/versions. The existing UI workspace does not expose every immutable allocation ID; the future server reader must collect them rather than reconstruct identity from names. Include deterministic source digest and calculator version. Return `blocked` plus precise reasons for missing/stale sources, unresolved ties, unsupported scope or policy.
4. **No payout mutation in this slice.** Display funding, recipient basis, excluded entries/reasons, total proposed awards and residual separately, plus policy/source references. A preview is neither a payment, claim, reviewed final award nor settlement. Never change eligibility or auto-save corrections while reading. Server reader uses existing director/co-director authorization; no anonymous/public policy or payment access is implied. Any new service RPC/visibility requires separate migration/access review.

The calculator must conserve `fund = awards + explicitly classified residual` exactly under an approved rule. If equal awards cannot consume an odd cent without inequality, show a blocked remainder until a disclosed disposition is approved; never secretly give the extra cent to a UUID/rank, round to $5, call it director profit, or fabricate a refund. Zero paid qualifiers must be a distinct blocked/no-recipient state, not division by zero or an automatic payment to a nonqualifier.

## Future canonical settlement boundary (not part of preview activation)

Adding Q claims requires a separately versioned settlement source/request and reviewed migration. Keep base prize schedule/payback evidence separate from Q awards; preserve historical v5 finalizations and attestations. Allocate the same receipt's base and Q portions exactly once across all claims: current event-level ledger totals do not by themselves prove partitioned Q funding. Do not count a $45 cumulative receipt both as $45 base income and another $15 Q income. Q pool balances, awards, corrections and any policy-approved residual/refund must reconcile independently before combining totals. Do not automatically include Q collections/awards in the existing 85% base-entry payback denominator without source-supported classification.

At draft/final acceptance, atomically revalidate all source versions/digests, policy freeze, paid membership and current receipt bindings with existing lock ordering. Reject a concurrent void/replacement or changed qualification before committing. Retained exact requests reconcile by original operation ID; changed payload with same ID conflicts. Any future saved preview/review is append-only and cannot become final just because an earlier preview was valid. No broad legacy-writer/ACL changes are justified for a read-only calculator.

## Required test matrix

| Case | Expected proof |
| --- | --- |
| Two pools, member elects only one; partial base or pool | No cross-pool subsidy or eligibility inference; exact paid base and selected pool required. |
| Paid nonqualifiers versus paid qualifiers | All valid pool funds counted, awards limited to the approved recipient rule; playoff order irrelevant. |
| No paid qualifiers / zero members / one recipient | Defined blocked or approved disposition, never invented recipient or divide-by-zero. |
| Rank tie, cutoff tie, equal cohort | Source-defined tie rule; unresolved result blocks; never arbitrary participant-ID ordering. |
| Odd cents and graduated shares | Deterministic exact integer conservation under approved disclosed rounding; no hidden residual or silent unequal award. |
| Receipt void/replacement after preview | Old allocation invalidates eligibility; replacement requires explicit reallocation; old preview stale, not recalculated history. |
| Membership correction / obligation or setup version changes | Source identity changes invalidate preview; no binding by slot/name alone. |
| New qualification version / pending score correction | Prior result binding stale; live ranking cannot overwrite immutable preview evidence. |
| Policy published after first collection; edited policy after freeze | Fail closed as unsupported disclosure/history; no retroactive consent claim. |
| Unauthorized/cross-tournament/extra-field payload | Existing service boundary and exact contracts reject; no public payment/member data leak. |
| Concurrent void versus future review/finalization | One serializable valid outcome; stale request rejected; no duplicate funds consumed. |
| Lost response/repeated save in future persistence | Exact original operation reconciliation, single history/audit result; modified payload conflicts. |
| Legacy base settlement and Side Pools | Remain unchanged; current Q settlement blockers and false capabilities retained. |

First run pure fixtures and exact reader contracts, then isolated real SQL source-currentness/permission/race tests and phone/desktop preview tests. Hosted fixture below remains preserved; it has no finalized qualification and is therefore an intentional blocked preview case, not a payout fixture.

## Remaining decisions and next approval

Official-source findings above narrow the first implementation proposal to equal shares among all fully paid finalized qualifiers. Ask the owner to approve that method, qualifying-order penny allocation and zero-recipient full-refund obligations together. Do not ask again whether every Q method must pay every qualifier: the source permits variants. Do not reuse the base-prize 4:3:2:2 schedule as Q policy. Confirm the authoritative research references are captured before implementation.

Recommended next approval after research: **implement locally the versioned pre-collection payout-policy contract and read-only Q payout preview for the existing single Standard Main/no Side Pool scope, with explicit blocked states; automatic payouts, Q settlement claims and hosted changes remain disabled.** A merely local calculator without disclosure/source enforcement is insufficient preparation for later authoritative settlement.

## Executed evidence and limits

Read existing setup, Q membership, qualification, settlement and graduated-estimator source/contracts. Ran bundled Node `--test tests/q-pool-membership.test.mjs tests/q-pool-sql-contract.test.mjs`: **8 passed, 0 failed**. These verify existing boundaries, not a new payout implementation. No expensive full verification repeated for this documentation-only plan. No browser or hosted action was needed.

Preserved hosted test: tournament `3cbae2fc-b621-4726-a582-4807744f3e42`, event `d5433d23-8acc-463d-846f-ff32589dc959`; successful evidence in `2026-10-28-hosted-q-pool-allocation-rehearsal.md`.
