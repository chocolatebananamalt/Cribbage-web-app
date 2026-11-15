# 2026-11-10 Current fund-only source and durable modern prize journal

## Built locally

`readCurrentNativeFundOnlyV2` independently validates the current recorded-fund review against the current native recipient/operational proposal, allocation, income head/status and sanction coverage. It reuses the strict existing recorded-fund read contract and full own-confirmed playoff provenance. Legacy proposed award amounts no longer have to balance merely to establish fund facts. A focused check deliberately unbalances that older proposal and still obtains reviewed fund facts, while stale review/coverage pins reject. Matching review does not establish a bank balance or authorize disbursement.

The existing newer-method review bridge accepts this fund-only source, so saved V2 policy/history can be reconciled without first manufacturing a balanced legacy award projection. `reconcileModernPrizeAwardSourceV2` checks the private SQL projection against that independently rebuilt review, including exact groups, named recipient identity/profile bindings, policy, chosen increment and fund totals. `decodeModernPrizeAwardRecordV2` validates the immutable saved source and actual stored rows, then returns private historical/unpaid information with no profiles or payout/current-source authority.

`database/proposals/modern-prize-awards-v2.sql` is an UNEXECUTED local candidate with6 revoked functions and5 new immutable forced-RLS tables:

- Literal-false gate, current fund-only reader, current modern-policy award source, reciprocal guard, transactional writer and historical reader.
- Separate actor/operation request journal, award sets, all finishing groups, all participant award/no-award rows and immutable outcomes. Existing award tables/records are untouched.
- Modern sets retain the V2 prize revision FK, fund review FK, complete original fund/policy/provenance captures, selected$1/$5/$10 increment, plan, source digest, Director reason and time.
- Writer accepts only expected source/prize/review pins and explicit reviewed/reason; no posted amount or recipient is trusted. It recomputes from locked current sources, requires exact fund balance, retains whole groups and explicit zero exclusions, writes all rows atomically, and verifies exact group/recipient bijections and totals. Same actor/operation exact retry recovers the saved immutable outcome; changed request rejects. No money moves.
- Tournament/role locks and reciprocal insert guards prevent another legacy/native/optional final (including tournament-wide joint finals) from creating duplicate liabilities. Relevant fund/proposal/generation inserts are blocked after this modern final; post-final corrections are unsupported.
- Local UTC is pinned on capture/hash/write/read functions. Independent review caught this determinism issue; it was corrected without global timezone/security changes or historical-row rewriting.

## Focused checks

19 focused groups pass (existing funds/history plus new fund-only and modern source/record checks). Modern record projections cover18 larger configurations:8/16/64qualifiers ×Equal/WinnerTakesAll×$1/$5/$10, in addition to48 review-bridge configurations retained from the preceding slice. Tests check same-group equality, explicit excluded zeros, original input immutability, stale fund/review/head, changed recipients/rounding/method/source and false payment/currentness claims. Source checks prove closed gates/revoked access/immutable tables, reciprocal guard presence, exact postcondition fields and function-local UTC. TypeScript/scoped lint exit0. Independent final source review found no remainingP1/P2; SQL SHA `e207a837acdc07e5d1991f00f28c6809158840c664069ff7674c3cc332e6f755`.

These are pure fictional DTO/code checks and source review. They are NOT actual database installation, permissions, transaction rollback, concurrency, lost-response recovery, trigger compatibility or persisted readback proof. No fixture or denied operation was retried, and no hosted state changed.

## Scope and remaining work

Only Equal and WinnerTakesAll are recordable in this first modern SQL source. They use saved paid-place selection/whole-group rules and the selected increment; imbalance is held with no refund or automatic redistribution. Graduated/WinnerMultiplier remain held until their final field/entry-fee conditions and any changed manual method receive appropriate source-backed review. Positive recorded additional income is independently reviewable by the fund-only source, but modern recording rejects it because the current V2 proposal source does not yet carry that income. Broader optional-pool/multi-event source compositions not matching exact allocation rows remain blocked. These are explicit implementation/source coverage limits, not invented payout policies.

All new and existing gates remain off. New SQL and prerequisite large-field SQL are unexecuted. Required next acceptance: SQL parse/install and schema/grant compatibility, actual source/TS parity, preserved historical rows, positive/negative roles, duplicate/joint-final races, exact retry/lost reply, rollback of late failures, trigger/source freezing, timezone parity and verified cleanup, using only appropriately authorized isolated fictional resources. Provider/API/UI/offline integration is also still missing; no public wrapper or route was added. No modern awards should be described as operational or ready for real payout.
