# V2 saved-policy payout comparison, local only

Later native-source and manual-history work is recorded in
[the integration checkpoint](2026-11-08-prize-native-history-v2-integration.md).
It supersedes the missing-private-reader/history-model status below locally;
live wiring, durable storage and final-award authority remain incomplete.

## Bounded integration

`calculatePlayoffPrizeComparisonV2` calculates a proposal from the latest V2
plan, a known playoff field and an explicit fund. It preserves the supplied
MainCon geometric per-person weights across equal elimination groups, and adds
the agreed Equal, Equal with Winner Multiplier and Winner Takes All comparisons.
Regular rounding alone controls this calculation; Q-Pool and Side Pool choices
do not change it or their existing operating kernels.

The model uses exact rational weights and independently rounds each group's
per-person estimate to the selected $1/$5/$10 increment, using the source model's
positive-half-up convention. It reports the discrepancy, zero awards and
first-round comparison status separately. It never redistributes a remainder,
changes the fund/factor to satisfy an intention, changes qualifiers, assigns
named recipients or authorizes payment. This is an explicitly versioned source
comparison, not adoption of a new balanced-allocation policy.

The supplied MainCon 40-entry example with a $280 regular fund, 10 qualifiers
and factor 1.5 yields $70/$45/$30/$20/$15 per person for groups of 1/1/2/4/2:
$285 total, visibly $5 over. The earlier verified $1,800 example yields $1,805.
Equal $100/3 rounded to $5 yields $105; winner multiplier 2 with $100/3 and $1
increments yields $50/$25/$25. Winner-only $103 with $5 increments yields $105
and a $2 warning. None is silently balanced or treated as a disbursement.

## Saved policy and event-fund composition

The server-only `buildPlayoffPrizeProposalBasisV2` requires the exact saved
settings/prize binding and current prize-head pins, complete unchanged current
allocation and current finalized qualification result. It derives the regular
fund using the existing ledger projection: regular receipts minus benefits and
expenses plus unrestricted additional income. Voluntary-pool money is excluded.
Unreviewed, restricted, negative, stale or foreign sources fail closed. A
correction changes the source digest; an older proposal cannot be called current.

This is not an authenticated native reader. The future reader must verify/join
the operational event, saved policy pin, catalog, current ledger, fee-coverage
and fund-review evidence, and sporting result under appropriate source locks.
Posted DTOs, matching IDs or classification flags alone are not that proof.
The basis deliberately has no first-round loss evidence or authoritative
entry-fee-comparison source: both remain unknown at qualifying-estimate stage.
No new SQL, fixture, API grant, route enablement, hosted read/write or public
upload was performed for this slice. Existing operational V2 guards stay closed.

## Verification

Six lead calculator tests, eleven independent golden/invariant groups and four
basis tests pass. The independent tests cover irregular and one-player fields,
all increments and half-up boundaries, dormant inputs, large fields, unsafe
totals, zero awards and actual supplied first-round loss evidence. A discovered
unknown-input accessor defect was fixed using the existing descriptor-safe wire
validator; getters are not executed and malformed input cannot throw through it.
Inputs are not mutated, and old calculators and history are unchanged.

Full application tests: 2,433 passed. The read-only comparison component passes
17 actual-React cases at 320/390/768/1440 pixels and 100/200% text, with no
navigation, network requests, storage or write ports. Evidence is under
`test-results/playoff-prize-comparison-offline/`, including source hashes.
Independent review found a safe-integer-boundary cent-display error; reuse of
the existing exact integer-money formatter and a real-component boundary case
fixed it. Final TypeScript/build, provider readiness, lint (0 errors/199 warnings)
and workspace/private-handoff checks passed. Logs use
`test-results/prize-comparison-v2-*`. These tests use static verified workbook
examples, not a new live Excel/Google Sheets recalculation or real
provider/payment acceptance. The prior denied registry audit was not retried;
no full clean audit or complete `pnpm verify` result is claimed.

## Remaining implementation and decisions

- Connect a verified native source reader and reviewable, immutable proposal
  history before this can replace operating Finance calculations.
- Adapt existing whole-group manual corrections to V2 policies/increments,
  preserve exact zero vs absent amounts, and recheck balance and comparison after
  each correction; a calculated proposal is not actual payment evidence.
- Automatic residue allocation remains unresolved. Manual review is supported
  as a warning boundary here; no smallest-unit or extra-funding rule is invented.
- Define which fee a first-round comparison uses when entrants paid different
  amounts, were discounted or waived, and what should change if the preference
  cannot fit the fund/rounding. The current estimate checks an explicitly given
  single fee without solving that policy.
- Independent signed-in/device acceptance, actual final-recipient provenance,
  durable proposal/award integration, release/recovery review and separate
  hosted/publication approval remain required. No usable live payouts are claimed.
