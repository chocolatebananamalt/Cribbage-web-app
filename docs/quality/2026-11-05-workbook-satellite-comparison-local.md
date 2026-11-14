# Satellite source-formula comparison - local only

## Bounded outcome

Added `src/lib/results/workbook-satellite-comparison-v1.ts`, an amount-only test comparison for the parent-verified native Google Sheet Satellite tab. It does not register an operating method, select recipients, change setup controls, alter historical awards, write records or move money. No UI, endpoint, schema, fixture or hosted action is included.

Source: https://docs.google.com/spreadsheets/d/1HlDFQxNEWjm_oG62ocq4XYCvwa6xgy0U0OsE515vXrc/edit, Satellite I15 entrants, I16 entry fee, I17 ratio, I18 rounded-up paid-place count and I28 expense-adjusted event fund. Parent supplied a verified formula mapping and reported native Sheet comparisons. This implementation reconstructs those formulas locally; it is not a fresh live Sheet recalculation or a claim to have received every observed input/output array.

## Arithmetic and safety

For entrant count n and Custom ratio N, paid-place count p=ceil(n/N). This is mathematical comparison input, not an ACC minimum-ratio policy or permission to save that ratio. T=p(p+1)/2. If F > $50*T, raw individual-rank amounts are (p+1-r)*F/T. Otherwise raw amounts are B+(F-B*p)*(p-r)/(p(p-1)/2), where B=1.25*entry fee. This is not the Main/Consolation knockout-group factor or the Q/Side distribution.

BigInt intermediates and reduced rational values preserve fractional cents. A separately labeled reconstructed nearest-$5 reference shows the Sheet model's over/under amount. The comparison candidate uses exact largest-remainder $5 allocation, monetary remainder ties favoring higher rank, and requires exact conservation and descending nonzero amounts. This rounding tie is not a sporting tie-breaker. No recipient IDs/names, overrides, Q funds or Side funds are accepted.

The function fails closed for:

- unresolved sporting ties;
- one paid place, whose complete behavior remains unverified;
- more than 30 paid places, beyond the mapped Sheet award rows (not an ACC field-size limit);
- fixed-branch fund below the raw 125% baseline;
- a fund not divisible by $5, rather than silently inventing a residual account or extra funding;
- a $5-conserving candidate that rounds below the raw baseline, pending whether the baseline is a strict post-round minimum;
- zero rounded awards, unsafe integers, malformed or extra inputs.

Blocked results have no `awardsMinor`. Where the source arithmetic is defined, a `sourceModel` may remain for diagnosis; its nearest reference is never described as balanced or awardable. The linear branch does not use the fixed baseline, matching the supplied conditional formula. Free-entry/zero-fee inputs are outside this comparison.

## Transparent examples

| Entrants / Fee / Ratio / Net Fund | Result |
|---|---|
| 18 / $40 / 1-in-6 / $300 | Fixed-branch comparison: $150/$100/$50 |
| 18 / $40 / 1-in-6 / $480 | Linear comparison: $240/$160/$80 |
| 18 / $30 / 1-in-6 / $300 | Blocked baseline ambiguity; nearest reference $165/$100/$40 totals $305 |
| 35 / $30 / 1-in-6 / $1,003 | Blocked non-$5 fund; reconstructed nearest reference $295/$245/$195/$140/$90/$40 totals $1,005 |

These complete-input examples are local reconstructions from the formula. Do not relabel them as independently observed live Sheet rows.

## Executed evidence

Five focused test groups pass, including strict threshold equality/one cent above, both branches, rational fee baseline, custom ratios, 30/31 paid places, one recipient, low fund, ties, zero awards, no mutation, malformed/coerced/unsafe inputs and false authority flags. Two initial test expectations were corrected after exact arithmetic: fee $30.01 can round the baseline upward and conserve, while an extreme large-fund input enters the linear branch and blocks unsafe nearest output. No implementation guard was weakened.

Independent Python `Fraction` oracle imports no app code. All 1,922 formula reconstructions match: 510 supported comparisons and 1,412 blocked cases. Outcomes: 169 zero awards, 342 non-$5 funds, 431 low fixed funds, 148 below-baseline rounding, 200 one-recipient, 120 row-limit, one unresolved tie and one unsafe result. Evidence: `test-results/workbook-satellite-comparison-local.json` and `-independent.json`. These counts are local test cases, not 1,922 spreadsheet observations.

Independent Sol source/result review found no concrete P1/P2: both branch derivations, exact threshold/baseline, validation, bounds, ordering/conservation, stable remainder ties and blocked-result flags agree. Existing-method nonmutation unit hashes only prove within-test nonmutation; separate archived-source comparison provides the earlier-checkpoint comparison where available.

`pnpm verify` exits zero: no known production dependency vulnerabilities, zero lint errors/119 existing warnings, 1,989 app tests, six provider checks, production build/TypeScript and eight workspace checks. Six handoff tests pass. Final checkpoint receipt is `test-results/workbook-satellite-checkpoint.json`. There is no browser or database acceptance claim because neither UI nor database changed.

## Decisions before operating integration

Determine one-recipient behavior; whether the 125% raw baseline must remain a minimum after $5 rounding; how an incompatible net fund's residual or extra funding is recorded; sporting ties/cutoff treatment; and support beyond 30 paid places. Do not infer an ACC minimum ratio from the positive-integer comparison domain. Top-4 or other Satellite payout modes need their own disclosed recipient/distribution semantics.

Custom Satellite save/calculation/accounting remains operationally blocked until a versioned method, persisted choices, immutable source/fund review, recipient/tie policy, historical compatibility and provider/runtime tests are implemented and approved. No existing method or disclosure was silently replaced.
