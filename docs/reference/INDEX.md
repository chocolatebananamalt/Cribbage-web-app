## 2026-10-30 owner payout correction — local policy design hold

Owner06:18 requires whole-dollar awards, preferably $5, for regular/Q prizes.06:19 clarifies graduated rank-down (not a blanket equal-pool refund override).06:22 directs the shared ACC-weighted/balanced $5 formula for graduated Q and Side Pools;06:24 rejects recurring director questions for leftover placement. Whole-$5 LR already allocates every $5 unit; a genuine280.50 fund has a distinct50c funding residue. A once-agreed disclosed rounding-cover guarantee is proposed, not approved; no automatic donor, fee/expense change or fund diversion. Preserve immutable historical penny/refund test records; prior acceptance proves accounting behavior, not current denomination-policy correctness. Reference docs/reference/payout-policy-clarification-2026-10-30.md. No application behavior, migration, publication or hosted data changed.
# Project PDF and extracted-reference index

Use retained reference data before reopening originals. This index identifies actual coverage; it does not claim complete extraction of every PDF. A comprehensive user-facing searchable reference is being prepared separately.

## Official ACC sources

| Source | Retained material | Coverage and limits |
| --- | --- | --- |
| ACC Official Tournament Rules, 2025 | [Cached original PDF](../../public/rulebook/acc-rulebook-2025.pdf), [edition/integrity record](../quality/2026-09-09-production-rulebook-reference.md), [reviewed rule notes](../quality/2026-09-10-acc-public-rule-source-review.md) | The PDF is the original, not a complete extracted text corpus. Reviewed notes cover selected scoring, cross-check, qualification and doubles clauses. The app's [five-topic quick reference](../../src/app/tournament/[tournamentId]/rulebook/rulebook-reference.tsx) is a navigation aid, not a full-text rule index. PDF SHA256: DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD. |
| ACC Tournament Director Manual, February 2019 | [Playoff/manual source review](../quality/2026-10-27-official-playoff-source-review.md), [payback source contract](../quality/2026-10-27-payback-review-design.md) | Reviewed excerpts, including sections 5.E and 7.A. No complete Director Manual PDF/text index was found in the inspected tracked repository. Do not confuse the separate 2025 Rulebook with this manual. |
| ACC Policy Manual, revision list through February 2025 | [Payback source contract and dated hash](../quality/2026-10-27-payback-review-design.md) | Selected Chapter 6 requirements and expense/payback classifications; not the full manual. Preserve dated effective-source distinctions from older policy notes. |
| ACC published Main/Consolation MRP sheets, effective August 1, 2016 | [Source inventory](../quality/2026-09-10-acc-mrp-payout-source-inventory.md), [versioned reference notes](../quality/2026-09-11-standard-singles-mrp-reference.md), [later playoff semantic review](../quality/2026-10-27-official-playoff-source-review.md) | Reviewed formula/table and playoff-credit evidence with implementation-version notes. These files are not complete extracts of every linked PDF. Historical blocked-state notes may be superseded by later implementation evidence. |

Official sources describe their own scope and dates. Application defaults and director-selected operating policies must not be presented as universally mandated ACC formulas.

- [ACC side-pool web calculator observation, 2026-10-29](acc-side-pool-calculator-observation-2026-10-29.md): reported public client formula and ten chart comparisons, with unsubmitted final-validation limits. This alternative is not enabled and does not replace the selected friend charts.

## Friend-supplied operating charts — distinct authority

- Source: eight-page **cribbage pool info.pdf**, Library `libfile_3a1e3f4477e481919c5163b368dcd5c2`; original PDF SHA256 `f7549bd181bdfd0c08695547293d32811b5406ef1aa3c171bba221420238924d`.
- Reusable extracted data: [versioned Q chart catalog](../../src/lib/results/q-chart-catalog.ts); [exhaustive catalog/provenance tests](../../tests/q-chart-catalog.test.mjs).
- Pages 2–7 contain six independent $10/$20/$50, 1-in-4/1-in-6 Q schedules. The supplied coverage has **320 supported combinations**: 314 visually reviewed rows and six separately labeled user-read page-5 clarifications approved October 29, 2026. Each cell retains source page and provenance. Whole source dollars convert once to integer cents.
- The six clarifications are paid counts 39 and 56–60 for $10 / 1-in-4. Row 56 retains the user's qualified reading; rows 57–59 retain the fourth-place ambiguity resolved by the total. Count/total checks are not independent visual extraction. See [clarification evidence](../quality/2026-10-29-q-chart-six-row-clarification.md).
- Page 1 is a separate regular-playoff percentage chart and has **not** been imported. Page 8 is a blank financial worksheet, not a payout table. Neither is represented as extracted Q data.
- These are experienced-director operating schedules, **not** an ACC-mandated universal formula. Missing fee/ratio/count combinations remain blocked; never scale, interpolate or infer source cells from a pot remainder.

## Discovery boundary

Read-only inspection of draft commit `be7d7e669afa86b9de304a7f1bf727c990332b8d` found the cached Rulebook, selected Markdown reviews and the chart catalog, not a complete Director Manual extraction. Relevant staging metadata showed ruleset metadata but no dedicated manual-text corpus or matching reference files. Production/opaque uploads were not exhaustively searched. Vercel serves repository static assets; that does not create a separate extracted corpus. The index reuses these artifacts rather than duplicating the parent's comprehensive reference project.
