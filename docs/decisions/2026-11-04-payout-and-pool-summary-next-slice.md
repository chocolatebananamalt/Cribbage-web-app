# Payout setup and player-visible pool summaries — local plan

Planning only, excluded from frozen 0290–0292 rollout. No hosted reads/writes or publication for this work. The backup handoff was not touched during planning. Parent-verified native Sheet tests are independent evidence; this executor did not perform live Sheet recalculation.

## Recommended order

1. Finish the currently approved recovery-gated rollout; do not bundle payout changes.
2. Build/review a read-only workbook comparison with exact labeled reference cases and the existing approved app calculator. No receipts, settings save or award creation. Resolve method/rounding/recipient differences before enabling a method.
3. Add a small aggregate-only pool summary for eligible supported event/pool types. It must not open the private official finance workspaces.
4. Replace the declaration presentation with event-specific Payout setup and Payout estimate after policy choices are approved. Preserve existing versioned declarations, disclosures, amendments, audit, recovery and final-award guards.

## Present code and genuine gaps

`event-prize-declaration.ts` and the current setup editor accept only four/five qualifiers, per-place/cohort weights, source reference, reason and review. This is not a general workbook table editor; the verified 40-entrant workbook example pays ten recipients and cannot be installed by a cosmetic rename. The next method DTO/table version must support approved bands/counts, source-table versions and applicable bracket domain. Do not expand recipient counts from the current four/five adapters silently.

Show director parameters in the relevant event's Payout setup, not a remote technical section. Use saved event fee/rates and computed registration counts where available; do not duplicate editable financial truth. Exact editable yellow-cell controls require the verified cell-to-input mapping. Method factor, retention, external funding and manual adjustment behavior remain policy decisions. Main/Consolation/Satellite policy is still tabled pending owner's friend. Save new settings explicitly; recalculate estimates as evidence changes without changing the saved method version. Protect paid commitments and final amounts.

Current Q/Side workspaces contain private participant names, elections, due/received amounts, receipt/allocation references and reasons. Q membership and synthetic multi-event elections require event participants; `multi_event_pool_elections_v1` is explicitly TEST ONLY SYNTHETIC and is not a normal live-registration writer. A pre-enrollment roster-only joining/counting path must be mapped or built before promising registration-time counts. Do not count registration interest as an enrolled or paid election.

## Verified comparisons and conflicts

| Case | Parent-verified native Sheet | Current app / decision |
|---|---|---|
| MainCon 40 × $10, $3 sanction | $280 fund, $285 awards; $5 over | Event method not chosen; ten-recipient domain exceeds current 4/5 DTO |
| Side 17 × $10, 1-in-6 | $95/$55/$20 = $170 | Pure approved V2 app run: $85/$55/$30 = $170. Same fund/count, different distribution: this is NOT just conservation or rounding; reconcile exact workbook baseline/branch policy |
| Q Equal $200, nine eligible | 9 × $20 = $180; $20 unallocated | Remainder policy needed; do not silently alter equal treatment |
| Q Equal $200, six eligible | 6 × $35 = $210; $10 over | Exact equal $5-unit division impossible; true external funding or explicit retained-balance policy needed |
| Q top-double $200, six eligible | $60 + 5 × $30 = $210 | Exact weighting and remainder/funding policy needed; balancing alone cannot validate method |
| Q Graduated $200, six eligible qualifiers | $55/$45/$40/$30/$20/$10 | This recipient rule differs from 20 paid at 1-in-4. Approved V2 ratio run pays five: $65/$55/$40/$25/$15. Never compare as identical inputs or silently substitute recipient policy |
| Satellite | $1,003 fund, $1,005 awards; $2 over | 125%-entry baseline may require actual external funding; Top 4 split not defined by label |

The two app runs above were executed locally using `calculateGraduatedPoolAmountsV2`; no app code/data changed, moneyMoved=false. Existing approved $5-conserving method remains unchanged. Workbook's unlabeled adjustment, unassigned override, contradictory warning text, duplicate-name lookup and 35-row Q output limit must not be reproduced. Validate fund balance AND selected-method compliance independently. Use stable IDs.

## Proposed player card and data contract

Example only: “Q-Pool 1 · $10 — 16 entered · 12 fully paid — Eligible paid fund $120 — If all entered players pay: $160 (estimate).” Names/private debts are absent. Unsupported/unknown data displays unavailable, never zero.

Server projection: event/pool/policy IDs and revision, entry unit (player or supported team), fee, as-of timestamp, current active confirmed-election count, fully-paid eligible count, eligible allocated fund and separately labeled projected fund. Count distinct current stable entries; exclude superseded/withdrawn elections. Partial, stale or unresolved allocations are not eligible paid funds. Do not label that amount as all money received; official diagnostics may separately show held/incomplete contributions. Existing final-award previews require locked entries/final scores and cannot serve as this pre-close summary.

Before results, estimates may show number of projected awards and amounts under the disclosed version, not named winners or finalized liabilities. Actual eligible/ranked recipients require current results, tie decisions and review. “Everyone” is a user goal for visibility, but public versus signed-in tournament access needs explicit scope and a purpose-built aggregate endpoint; never expose an existing private workspace wholesale. No permission change is authorized by this plan.

## Acceptance and remaining decisions

- Refresh count/payment independently; duplicate/superseded/withdrawn entries, fee waivers, partial payment and stale allocations cannot inflate eligible fund.
- Separate Main/Consolation/named pools and policy versions; same-name players/pools cannot merge by display name.
- Stale/offline refresh shows last timestamp and status, not “current”; no zero fallback.
- Estimate versus approved award versus payment remain distinct; saved versus what-if inputs remain distinct.
- Preserve old schedules, receipts, consent and final history after publishing a new table version.
- Verify exact recipient counts, approved ratio bounds, Equal/top-double/no-eligible handling, Stairstep, Satellite split/external funding and event method before operational enablement. Do not replace approved formula just because a workbook output balances.
- No implementation or payout publication approval is sought as part of the current rollout.


## Later November4 bounded implementation
Parent authorized non-fixture local preview work. A pure module, default-off local display page and isolated browser preview now implement the comparison/what-if/aggregate presentation slice; see docs/quality/2026-11-04-local-payout-preview.md. Original operating-policy and live-adapter boundaries above remain. This is not an operational method registry, live declaration editor, public finance endpoint, or general workbook reimplementation. No new policy selected.
