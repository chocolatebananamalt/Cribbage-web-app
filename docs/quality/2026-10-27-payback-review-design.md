# Local payback review design (locally registered; not deployed)

Owner approval 2026-10-27: local structured benefit/operating classifications, separate 85% gross-entry validation, explicit director-selected prize schedule and positive award coverage for ordinary cash-eligible qualifiers. Existing hosted draft ab275686-6349-40e3-8771-bdfb1fe18f65 stays unfinalized. No hosted write, migration application, publication, new access, payment or email is authorized by this design.

## Source contract

Current linked https://www.cribbage.org/NewSite/about/Policy%20Manual.pdf, inspected 2026-10-27, revision list through February 2025, downloaded SHA256 9A329944522DBCBB4868D465BD5E68DEF58E274FADFD1F81054C6276049F48E1. Chapter 6 I.B/C printed 6-1: 25% qualifiers rounded upward. I.H printed 6-3: highest qualifiers receive bracket-filling byes. III printed 6-3/6-4: combined Main/Consolation cash/player-benefit return at least 85%, no director monetary profit; benefit categories include sanctioning, meals, refreshments, snacks, charity, prizes and trophies; cards, printing, advertising, postage, telephone, supplies and venue rental are operating costs. I.G printed 6-3 has legal-age/sanction-only exceptions, so a universal claim that every possible qualifier must receive cash is incorrect.

2019 Director Manual section 7A printed 11 says award ratio one in four entrants and distribution not mandated; optional percentage/progression guidance is not a universal formula. Existing owner requirement makes every full-entry cash-eligible qualifier have one positive total award. The award is the player's entire final cash prize, not incremental winnings added each round. Equal elimination cohorts receive equal awards in the first supported slice; alternate prize-order approval needs a separate evidence contract. Prize policy never changes MRP or qualifying rank. Q Pool eligibility and payouts remain separate.

## Acceptance and boundaries

- Cash conservation and participant-return ratio are independent checks, using integer arithmetic. `100 * (cash awards + eligible benefit costs) >= 85 * gross entry fees`; operating costs are excluded from numerator, and gross is not reduced by costs first.
- Record one sourced classification per actual current expense. Unknown/unclassified/unsupported benefits block a compliant review. Never infer from a description.
- One positive total award for every authoritative cash-eligible qualifier, no duplicate or outsider awards. No fixed split, universal doubling, or automatic payout is introduced.
- First integrated scope is one active Standard Singles Main with no other event, Q/Side pools, independent cash, refunds, exemptions, partial/overpaid receipts or byes. Exact participant-to-roster bijection, all latest obligations and receipts equal the configured positive entry fee. Snapshot actual IDs/versions. Fail closed outside this scope rather than guess allocation or age eligibility.
- Gross source is server-derived participant/roster/obligation/receipt facts, not an arbitrary user number or tournament receipts assumed to be entry-only.
- Every qualifier needs auditable director eligibility evidence; no age is inferred from account metadata. This remains an attestation, not external verification.
- Positive retained balance blocks the first compliance slice; no interpretation of a 15% allowance as director profit.

## Reviewed integration seam

Preserve immutable V5 drafts/finals and their exact request/recovery contracts. Add append-only payback reviews bound to exact draft/version plus complete financial/qualification facts snapshot. Add service-only read/save/reconcile RPCs and a separate explicit UI review after saving a draft. Unknown outcome retains the identical operation and body; null receipt never authorizes deletion. Actor verified by API; same-origin, strict DTO, scoped receipt/audit, current role checks, replay/conflict and lock ordering match V5.

An immutable event requirement marker prevents old-client bypass for newly opted-in/future eligible events. Existing records remain historical and are not silently called compliant. Legacy writer domain guards reject new writes for required events after exact receipt replay. V5 preflight rejects missing/stale/invalid payback review with structured operation receipt before final insertion. Persist exact review ID on new final, with a defense-in-depth trigger. Migration proposal must not revoke legacy functions globally. Application first, migration later, each separately approved for staging; no deployment is part of local implementation.

Implemented DTO: `{draftId,draftVersion,expectedVersion,scheduleKind:'director_selected',amountBasis:'total_award',scheduleReference,sourceReference,eligibilityEvidence:[{participantId,basis:'full_entry_cash_eligible',evidenceReference}],expenseClassifications:[{expenseEventId,category,evidenceReference}]}`. Amounts/qualifiers derive from saved draft and current facts; idempotency key is in the header, not duplicated in the body. The equal-cohort rule is fixed and disclosed; alternate free-text approval cannot unlock it. Canonical 0241 was generated locally and verified against the tested proposal; no hosted application occurred. See the local-validation report for final evidence and hashes.

## Verification required before readiness

Pure validator: exact 85% boundary/ceiling, overflow, unknown classifications, each benefit/operating category, gross/net double deduction, missing/duplicate/nonpositive/ineligible awards, total-vs-incremental, equal cohorts, unknown eligibility and unsupported byes/income. SQL: auth/ACL/owner/search-path/RLS, immutable history, receipt/audit cardinalities, exact replay, changed-key conflict, stale draft/facts/obligations/expenses, old-client bypass and grandfathered exact receipt replay, concurrent review/final/ledger changes. Browser: desktop/mobile, no invented policy defaults, unknown evidence blocks, exact retained retry, final readiness and immutable review readback. Full pnpm verify and independent review. A pure helper pass alone is not app enforcement or SQL/API proof.
