# Side Pool distribution: Sheet versus current app

## Recommendation

Use the friend's current Sheet as the reference for the intended **distribution**, consistent with Daron's latest direction, but verify its exact Side formulas before implementing a new version. Keep the app's already approved exact, fund-conserving $5 rounding and separate recipient/tie checks. A distribution decision and a rounding decision are different. Preserve all existing elected/disclosed policies and historical obligations; no silent conversion. This is a recommendation, not a policy change.

The clearest verified example is **17 paid entries x $10, paying 1-in-6: $170 fund, three recipients**:

| Source | First | Second | Third | Total |
|---|---:|---:|---:|---:|
| Friend's current native Sheet, parent-verified | $95 | $55 | $20 | $170 |
| Current app V2 | $85 | $55 | $30 | $170 |
| Older supplied PDF lookup chart, a different source | $85 | $55 | $30 | $170 |

The Sheet moves $10 from third to first relative to the app. Both balance. This is NOT a rounding fix. App raw amounts are $85, $56.666..., $28.333...: adjacent $5 rounding can give first exactly$85 and third$25/$30, never$95/$20. Do not confuse the newer Sheet with the older charts just because both came from the friend.

## What determines the app distribution

Current source is src/lib/results/graduated-pool-amounts-v2.ts, method graduated-acc-weighted-largest-remainder-5usd-v2. The app uses the retained observed ACC calculator algorithm as its raw basis; this is not an ACC-mandated universal payout rule. For N fully paid pool entries, fee E, ratio r, recipient count k=ceil(N/r), fund F=N*E, triangular total T=k(k+1)/2:

- One recipient receives the full fund.
- If F>T*E, raw weights descend k,k-1,...,1, divided by T.
- Otherwise each award begins at the actual entry fee E; surplus F-k*E is distributed by k-1,k-2,...,0 divided by T-k. This is the entry-fee-floor branch.
- Exact rational amounts are floored to $5; remaining $5 units go by largest exact fractional remainder, higher finishing place first only when rounding remainders are equal. Awards remain ordered, at least E and sum exactly to the named fund.

This raw basis was approved locally in the October30 decision. Historical appV1 charts remain separate independent lookup tables, never scaled/interpolated. The newer workbook analysis reported a fixed$20 Side baseline, but its exact cell formulas/branches are absent on this executor; that fact alone does not establish the full distribution formula. Do not infer further Sheet outputs from it.

## Representative local comparisons (dollars)

The Sheet column is deliberately incomplete; only the parent-verified Side example above is available here. A dash means not verified, NOT zero. Old charts are not substitutes for that Sheet.

| Paid x fee; ratio | Fund | Current Sheet | Older PDF lookup | Current app | Independently nearest-$5 rounding of app raw quotas |
|---|---:|---|---|---|---|
| 12 x$10;1-in-6 | $120 | — | 75/45 | 80/40 | 80/40; balanced |
| 16 x$10;1-in-6 | $160 | — | 80/50/30 | 80/55/25 | 80/55/25; balanced |
| 17 x$10;1-in-6 | $170 | 95/55/20 | 85/55/30 | 85/55/30 | 85/55/30; balanced |
| 18 x$10;1-in-6 | $180 | — | 90/55/35 | 90/60/30 | 90/60/30; balanced |
| 16 x$50;1-in-6 | $800 | — | 390/250/160 | 400/265/135 | 400/265/135; balanced |
| 17 x$5;1-in-6 | $85 | — | — | 40/30/15 | 45/30/15; **$5 over** |

The final row isolates rounding: raw app quotas are $42.50/$28.333.../$14.166.... Independently rounding each up/down gives $90 for an$85 fund. The current app keeps the same raw distribution and balances to$40/$30/$15. That is a real rounding correction, unlike changing the17x$10 example to95/55/20.

For59x$10/1-in-4 the fee-floor branch produces app awards70/65/60/55/50/50/45/40/35/30/25/20/20/15/10=$590. Independent nearest rounding gives$595. The older chart gives105/85/65/55/45/40/35/30/25/20/20/20/15/15/15=$590, demonstrating another materially different distribution. Neither old-chart weights nor current Sheet defaults automatically replace the app's disclosed policy.

## Fund balance and equal treatment are separate checks

All320 current retained old-chart rows and all320 corresponding app outputs balance.319 complete schedules differ;308 old-chart rows contain an award outside the app raw quota's adjacent $5 choices. Those are distribution differences, not rounding noise. Recalculation of this CURRENT catalog with independent nearest rounding balances254, overallocates39 and underallocates27. An older research note says255/38/27; the original separate comparison artifact is absent here, so this discrepancy remains explicitly unreconciled rather than rewriting historical evidence. These counts do not describe the current Sheet or320 website submissions.

Equal elimination-round awards belong to Main/Consolation payout rules, not a rule that distinct Side ranks must be equal. Equal-Q shares/top-double and unresolved sporting ties also require their own validation. Current Side recipient preview blocks unresolved cash ties, ranks fully paid entries' own event scorecards regardless of playoff qualification, and does not use names or arbitrary IDs to choose a cash-tie winner. A manual override can make a total match while breaking an equal-share/cohort method. Validate fund total, declared method and tied/cohort treatment independently; a green balance alert is insufficient. Parent reported the Sheet's name-based lookups and duplicate names: retain stable app participant IDs for recipient binding, never join by display name.

## Evidence and exact limitation

No workbook bytes, exact Side formulas or full56-case bundle are locally available. The single newer-Sheet Side result is trusted parent-supplied live-recalculation evidence, not newly observed/recalculated here. Additional Sheet cases cannot honestly be supplied under the current no-hosted-read scope. This is an information/coverage limitation, not a failed payout or a permission denial; no access was attempted.

Local subject inputs came from the current kernel and all320 immutable cells in q-chart-catalog.ts (older user-provided cribbage pool info.pdf; sourceSHA f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d). Subject outputs were independently recomputed with Python Fraction arithmetic:320 chart rows plus seven representative examples,327 checks passed.12 existing kernel/catalog tests passed. Reproducible analysis and JSON live under test-results/side-distribution-*, analyze-side-distribution.mjs and check-side-distribution-independent.py. Local replay of retained observed JavaScript operation order agrees with this current nearest-rounding count; no website was accessed.

No product source, operating policy, saved review, receipt, fixture, hosted data, publication or money changed. No denied operation was retried. Full application verification is not rerun for this analysis-only document/data checkpoint; the prior1,386-test full application checkpoint remains separate and unchanged.

## Subsequent parent-verified Sheet evidence

Parent reports private native Sheet $10 Side/1-in-6 counts12-30:10of19 schedules differ from app, all balance. Sheet uses fixed$20 last-place baseline unless fund/triangular-recipient sum strictly exceeds$40; conserving largest-remainder rounding of those Sheet raw weights reproduced all19 observed Sheet results. Original unchanged. This supersedes the earlier one-example coverage limitation for that exact19-case domain, but this executor has not inspected the Sheet or received all19 raw output arrays. It is evidence for future comparison, not authority to change historical/hosted awards. New fees/ratios/large fields and exact source-cell provenance still need verified coverage.
