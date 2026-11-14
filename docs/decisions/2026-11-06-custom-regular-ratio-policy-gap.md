# Latest owner clarification - supersedes the pending ratio question

The owner explicitly said: "Exactly. It has nothing to do with a one in n number. The 1-in-N only applies to qpools and side pools." Main/Consolation regular prizes therefore do not use this method. The recommendation/question below is historical analysis, not an outstanding decision or enabled policy. New local regular-prize selectors omit1-in-N; legacy intent remains visible for review and blocked from calculation. Satellite is not changed by this clarification. Previously approved Top-N/whole-group behavior is retained pending any separate direction.

---

# Custom regular-event payout ratio: exact remaining decision

## Established owner decisions (trusted parent transcript)

- Main/Consolation Custom 1-in-N and Top-N choose paid finishing places only; they do not change playoff qualification.
- Factor controls progression between equal playoff finishing groups, default 1.5.
- ACC quarter qualification rounds a fraction upward (17 entrants means 5 qualifiers), as the owner explicitly confirmed from Rule 13.2(b). That qualification rule is not a paid-place rounding instruction.
- If a paid-place cutoff splits an equal group, include the whole group, with requested and expanded count warning (when at least eight qualify, Top6 includes all places5-8, becoming8).
- Director per-group amount adjustments preserve equal treatment and show imbalance separately. No payout/disbursement is inferred.

## Not established

The owner did not specify which population is divided by N: everyone who played this event, only fee-paying entrants, or qualifiers. Nor was fractional paid-place rounding explicitly settled. The workbook MainCon baseline pays qualifying finishing groups; it does not define the new custom ratio mode. Q/Side/Satellite ratio rules cannot be silently imported into MainCon regular prizes.

Hypothetical: 17 people played, 12 paid fees, 5 qualified, Custom1-in-6. Dividing everyone and rounding up requests3 places, which expands to4 because3rd-4th are equal. Rounding the same17/6 down requests2. Dividing12 fee-payers gives2. Dividing5 qualifiers and rounding up gives1. All leave5 qualifiers unchanged. Receipts contribute gross entry income; benefits, expenses and unrestricted income separately determine the regular-event fund.

A further boundary is a request above qualifier count: 17/2 rounded up is9 while only5 qualify. Current code rejects that request rather than silently capping it or awarding regular playoff money to nonqualifiers. There is no approved beyond-qualifier recipient policy.

## Recommendation for owner decision (not implemented)

Use all players who actually participated in that event, including comped players; request ceil(participants/N), then apply the approved whole-group expansion. For registration estimates use the same rule with a clearly provisional active-entry count. Reject a requested count above verified qualifiers with a clear explanation rather than silently changing the selection. This keeps ability to win separate from payment status and fund size. It is an app policy proposal, not an ACC mandate.

Minimum question: approve that all-participants/round-up rule and above-qualifier rejection, or choose a different population/rounding. Existing graduated and Top-N paths can continue independently. No new policy is enabled by this note.

## Exact implementation evidence

- src/lib/playoffs/event-playoff-parameters-v1.ts: custom number is preserved as settings intent, not interpreted as qualification or calculated paid count.
- src/lib/results/maincon-source-model-v1.ts: source-comparison baseline has no custom-ratio implementation.
- src/lib/results/maincon-fund-comparison-v2.ts: custom_paid_ratio returns custom_ratio_paid_count_policy_unresolved; custom_top_paid routes through whole-band cutoff.
- src/lib/results/maincon-paid-place-cutoff-v1.ts: equal-group expansion and payments_beyond_qualifiers_policy_unresolved.
- src/lib/finance/event-finance-workspace-v1.ts: official proposals and separate opt-in registration forecast retain those blocks. No fallback ratio or substitution.

## Independent local verification

Added tests/event-finance-forecast-invariants-v1.test.mjs: Main/Consolation fields1-500 (1000 forecasts), every paid cutoff for1-125 qualifiers (7875), 125 beyond-qualifier rejection cases, and registration-to-official transition preserving retained edits while removing forecast and blocking award edits. These are arithmetic/source-state tests, not proof of official bracket seeding or provider/database behavior. No production code changed in this verification phase; no fixture, SQL, hosted access or publication.
