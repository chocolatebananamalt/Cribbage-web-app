# Proposed versioned payout resources and workbook comparison

Status: LOCAL DESIGN ONLY. Owner accepts workbook behavior as a baseline unless a more reliable alternative is justified. Existing approved exact fund-conserving5-dollar pool modification remains authoritative. Main/Consolation/Satellite payout policy remains tabled pending owner’s friend. No hosted reads, code implementation, schema migration or publication is authorized by this plan.

## Source boundary
Parent analyzed the workbook; this executor has no workbook bytes or recalculation receipt. Reported findings: Main/Consolation geometric1.5 and equal elimination-round awards; Q Graduated/Stairstep/Equal/Equal-top-double; Side20-dollar baseline; Satellite125-percent entry baseline; independent rounding may leave fund differences. These are attributed analysis, not live Excel recalculation or direct local formula inspection. Do not invent missing cell formulas or cached values. See quality/2026-11-04-workbook-workflow-assessment.md.

## Smallest useful first slice
A standalone Resources preview, isolated from tournament writes, using current approved graduated kernel. Inputs: paid entrants in one named pool, entry amount, supported1-in-N ratio; outputs: fund, recipient count, per-place award, total and exact remainder. Explain this calculates amounts, not player eligibility or approved liabilities. Display method/version and rounding plainly. No receipts, role assignment, policy publication, winner selection or automatic finalization. Existing operating workflows remain untouched until separately reviewed integration.

Allow preview of a source workbook reference alongside the app method only after its exact table/formulas are recovered and independently verified. Label reference mismatches transparently; never silently replace approved app rounding. Display BOTH source rounded total and fund difference when independent rounding fails conservation.

## Main / Consolation director experience (owner clarification)

Replace the confusing declaration presentation with plain-language **Payout setup** and **Payout estimate**. Model director inputs on the workbook’s yellow input cells, once their actual source-cell mapping is available. Do not require directors to understand internal schema names, source fingerprints or hand-enter source-reference strings when those can be bound automatically to the chosen reviewed method. Preserve their underlying stored evidence and explicit review. Main/Consolation payout policy choice remains tabled pending the friend; this is a presentation/workflow requirement, not approval to select geometric1.5 or replace existing schedules.

Proposed layout:
- Event name and **Payout setup**.
- Editable, plainly labeled parameters for the selected reviewed method; each has units, valid bounds and a short explanation. The exact input list comes from the workbook-to-app mapping, not guessed yellow cells. Existing declared settings remain readable even if a new method is unavailable.
- **Payout estimate**, with one row per finishing place/band and amount per player; same-round equal awards remain visibly equal. Show total payout and the calculation’s current registration snapshot/time.
- Separate current counts: registrations, fee-waived entries, paid entries and uncollected balances. Do not call registration count paid income.
- Clearly separated **Projected payout if outstanding entries pay** versus **Payout supported by verified funds** when both are shown. A forecast cannot create a receipt or imply funds collected. Verified expenses, eligible benefits, required external funding and any restricted retained rounding balance must reconcile explicitly under the currently approved rules.
- One clear **Save payout settings** action for editable draft changes, followed by a versioned review summary. Detailed method/version/source and calculation breakdown may be expandable; no safeguards are removed merely because the default view is simpler.

Registration changes recalculate the estimate under the SAME saved method/version and a fresh event-scoped source snapshot. This is a new estimate, not a policy revision. Unsaved hypothetical inputs must be marked **What-if estimate — not saved** and kept distinct from the estimate for saved settings. A failed refresh displays the last snapshot/time and an unavailable/stale warning rather than calling it current. No totals or payout shares from Main may leak into Consolation or named pools.

### Editing and commitment boundaries
- Before commitment, the director can edit allowed parameters and save a new reviewed version; keep exact-request recovery, reason/review requirements and prior versions. No silent autosave of monetary settings.
- Once a disclosure, paid election, approved review or other existing commitment binds a version, never mutate it in place. Show the current protected state and offer only a supported recorded amendment with affected commitments identified, a reason and any necessary re-disclosure/review/consent. If no compatible amendment exists, block the edit with an explanation rather than replacing the method underneath existing entrants.
- New registrations, verified receipts or legitimate expense records can change an estimate while preserving its bound policy. The server must distinguish changing evidence from changing monetary terms and reject stale source/version requests.
- Approved final payouts remain immutable. Later registration/finance corrections do not rewrite a final; they require an append-only correction workflow and new review where supported. Estimated amounts must never be presented as approved/funded awards or money paid.
- Do not invent an additional irreversible lock at an arbitrary step. Reuse existing commitment guards; any new transition requires explicit domain review and disclosure before implementation.

### Preview and acceptance
The local comparison preview should show: (1) workbook inputs and recalculated reference output, (2) app inputs and automatically updated estimate, (3) intentional differences/rounding and fund reconciliation. Include before/after registration snapshots so the owner can see recalculation without changing policy. No operating tournament/receipt writes. A mock/static formula result is labeled as such until actual spreadsheet recalculation is executed and recorded.

Acceptance tests: changing a fictional paid-registration projection updates estimate only; waived/unpaid entries are not silently funded; saved versus what-if values remain distinct; stale/unavailable refresh stays explicit; old method replay after publishing a new version is unchanged; protected edits require recorded amendment or reject; final amounts/history never mutate; concurrent updates/retry preserve one exact recorded action; all supported rounding/return/funding/equal-cohort checks still run. Verify responsive labels/units and keyboard flow with no mandatory technical identifiers exposed to first-time directors.

## Versioned methods/tables
Separate method identity from immutable versions. Each version records source artifact hash/provenance/date/sheet-range, exact typed table data or reviewed deterministic algorithm identifier, input bounds, event/pool type, recipient/ranking policy version, tie policy, denomination/remainder rules, golden fixtures and approval metadata. Hash canonical content. Published versions are append-only; corrections create a successor and retain the superseded record. Draft edits remain drafts until reviewed. Tables contain data, not executable spreadsheet expressions.

Future tournament disclosure freezes the exact method version and content hash. Later calculator updates must not change existing paid elections, reviews, awards or finals. Operations reject stale/mismatched inputs rather than substituting latest versions. Ordinary player Resources access exposes reference data only; editing/import/publication requires explicit separate authorization and existing Director workflow checks. No new permissions are created in the first local preview slice.

## Independent comparison evidence
1. Recover the workbook file and original version hash; preserve an untouched copy.
2. Identify exact cells and formulas for each named method, including recipient eligibility/count and rounding dependencies.
3. Recalculate a copy using a supported spreadsheet engine and retain engine/version, inputs, calculation settings and output receipt. Cached cells, extracted formulas and a Python reimplementation must be labeled separately from live spreadsheet recalculation.
4. Build an independent reference implementation from recovered formulas, then compare workbook recalculation, reference and app results in a fixture matrix. Differences must identify first differing intermediate value, recipient count, amount, rounding and fund delta.
5. Review all intentional differences before enabling a method. Never weaken conservation to match a spreadsheet bug.

## Decisions needed per method
- GraduatedQ/Side: owner chooses supported ratio bounds; current kernel accepts2-100 but workflow constraints are narrower. Confirm recipient/ranking and tie versions remain unchanged. Side ranks paid event scorecards; do not apply Q qualification rules.
- EqualQ: retain current paid-qualified eligibility/history. Explicit policy needed for impossible equal5-dollar division and any change to historical no-eligible refund obligation; no silent graduated backfill.
- Equal/top-doubleQ: exact recipient set, tied top qualifier handling, double-weight units, indivisible5-dollar remainder and no-eligible behavior must be recovered/approved. Setup label alone is not an operational policy.
- StairstepQ: recover exact workbook steps, count, minimum awards and ties before coding; label does not establish algorithm.
- Main/Consolation and Satellite: TABLED. No1.5 default,125-percent funding assumption or Top4 allocation added now. Same-round equality preserved. External funding must be real evidenced funding or explicitly synthetic provenance; never manufactured by a calculator.

## Test matrix
Zero/one entrants; entrant counts just below/at/above ratio; unsupported ratios; decimal/negative/overflow input; different fees including non5-dollar values; equal and double indivisibility; all/no/three paid qualifiers plus paid nonqualifier backfill; cash ties; exact per-pool conservation/nonincreasing awards; independent rounding mismatches; stale method hash; attempts to rewrite published versions; old tournament replay after new version publication. Separate game points, positive/gross spread points and net spread points in any ranking demonstration. No scorecard alone establishes approved MRPs or money owed.

## Delivery / approval sequence
A. Recover source workbook and produce independent comparison fixtures (blocked here on absent original source/recalculation evidence).
B. Implement/test a pure local preview for already-approved method, plus read-only comparison when reference verified; show working app preview for owner comparison.
C. After method decisions, implement additional isolated versioned methods/tables and full regression/review. Present exact code/migration scope.
D. Request separate test publication/database approval. Operational enrollment/financial simulation records require their own explicit scope. No production or actual payments.

## Later workbook reliability findings (parent analysis)

Validate TWO independent conditions: fund reconciliation and compliance with the selected payout method. A manual override may balance the fund but violate equal awards or top-double weighting. Store/show any separate adjustment explicitly with purpose, amount, recipient effect and policy consequences; do not inherit an unlabeled balancing cell or misleading alert text. Source/output/method statuses remain distinct; matching the fund is never an approval by itself. Use stable player IDs for lookup/aggregation because the workbook’s display-name table contains duplicate names. Test duplicate names, actual payout plus adjustments, over/under, equal-treatment violation with balanced totals, contradictory alert wording and stale inputs. This is future design work, not new preview/application behavior.


## Parent-verified native Sheet scenarios, 2026-11-04

Reference: https://docs.google.com/spreadsheets/d/1HlDFQxNEWjm_oG62ocq4XYCvwa6xgy0U0OsE515vXrc/edit . Parent reports live recalculation in a separate private test copy, not executor verification and not changes to the reference: MainCon 40 × $10 gives $280 fund / $285 awards and red $5 warning; Q Equal $200 / 9 gives nine $20 awards and red $20 unallocated; Satellite $1,003 fund / $1,005 awards, red $2; $10 Side Pool, 17 entrants, 1-in-6 gives $95 / $55 / $20. Preserve these as future comparison cases; defaults are not approved policy and do not supersede reviewed rounding or manual-adjustment requirements. No calculator or payout implementation in the association patch.


## Running pool participation visibility - owner requirement

Show players each Q-Pool and Side Pool participant count and running pool total to inform joining decisions. Distinguish confirmed participation, confirmed payment and estimated pre-close payouts. Exclude withdrawn/duplicate entries by stable election/member identity; do not expose individual payment details or identify an unverified promise as funded money. Assess existing data and role/public read policy before implementation. This is planned pool experience scope, not authority to publish or mutate hosted records during association work.

Parent reports further private-copy live Sheet checks: 2,088 formula cells and 1,240 MainCon lookup cells match the original except known K32 relink and Q defaults; four Main qualifiers gives #N/A; an unassigned tenth Q override can make the balance warning green; Q S25=25 can produce red state with contradictory matching text; Q has 35 award rows. All four Q methods recalculated. These are future validation cases, not approved policies or a reason to copy spreadsheet defects. Reference unchanged.

### Source-backed pool count assessment

Current `src/lib/api/side-pool-graduated-v2.ts` workspace contains `paidCount`, election IDs/versions, per-entry due/received amounts and names. `q-graduated-operating-preview-v4.ts` uses a stable participant-ID Set plus current allocation, pre-play election, policy consent and exact per-pool fee allocation. `side-pool-graduated-recipients-v3.ts` likewise excludes non-elections and requires exact due/received contribution. These final-award previews require finalized scorecards/locked entries and are not the appropriate before-registration-close player view.

Plan a separate server-projected per-pool summary, scoped to event/pool/policy revision with as-of timestamp: active confirmed election count, fully paid eligible count, confirmed allocated fund, and separately labeled estimated fund if all elected entrants pay. Use existing current election/supersession and withdrawal semantics; do not sum historic rows or total tournament receipts. Partial/stale/unresolved allocations must not inflate the funded amount. Do not infer payout recipients from incomplete results. Publish estimate method/version and clear pre-close estimate label. Preserve existing amount-conservation and cash-tie rules.

Existing workspaces expose private entry balances and are official-role resources; do not open them wholesale. A new aggregate-only DTO and authorization boundary is needed. “Everyone” must be resolved as tournament participants versus unauthenticated prospective entrants before any access-policy expansion; no public access is authorized by this assessment. No hosted pool counts were read or displayed here.


## Later November4 bounded implementation
Parent authorized non-fixture local preview work. A pure module, default-off local display page and isolated browser preview now implement the comparison/what-if/aggregate presentation slice; see docs/quality/2026-11-04-local-payout-preview.md. Original operating-policy and live-adapter boundaries above remain. This is not an operational method registry, live declaration editor, public finance endpoint, or general workbook reimplementation. No new policy selected.
