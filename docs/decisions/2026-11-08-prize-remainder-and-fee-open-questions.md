# Regular-prize remainder and fee-reference questions

No new monetary policy is adopted by this note. These are regular playoff
prizes; optional Q-Pool and Side Pool rules and historical awards are unchanged.

## Reconciliation with prior no-refund and redistribution decisions

Do not ask again whether pool money should be refunded. The current
[pool implementation decision](../quality/2026-11-05-custom-pool-persistence-accounting.md)
forbids new refund obligations; zero eligible recipients blocks review. It
supersedes older refund wording still present in historical documents. The
[approved graduated policy](2026-10-30-acc-weighted-balanced-q-policy.md)
already redistributes whole-$5 remainder units by exact largest remainder,
with higher placement breaking equal fractional remainders, within the named
paid Q-Pool/Side Pool. That decision does not silently change Equal treatment,
recipient eligibility or regular playoff finishing groups.

Regular prizes also already have an approved automatic policy. The
[accepted V3 rule](../quality/2026-10-30-five-dollar-prize-policy-local.md)
rounds the target down when awards plus verified benefits meet the 85% minimum,
otherwise up. It preserves equal finishing cohorts, minimizes exact weighted
share deviation, and gives higher places lexicographic tie priority. Restricted
balance and genuine additional funding needs are recorded explicitly; neither
is a refund or invented receipt. Do not reopen those approved principles.

The implemented V3 domain is four or five recipients, fixed $5 increments,
positive integer weights and a $100,000 target ceiling. Latest V2 introduces
new methods, recipient choices and selectable $1/$5/$10 increments. Mapping
these new cases needs verification; historical V3 policies stay unchanged.
Proposal storage does not grant automatic finalization authority.

## Already agreed

The Director can propose manual amounts for whole equal finishing groups, with
the same per-person amount for everyone in that group. Preserve the original
calculation and reasoned correction history. Show fund imbalance separately
from changes to the selected distribution. Paid places do not change playoff
qualification. Do not invent extra income, expenses, refunds or receipts.

For example, the $1,800 fund / eight paid places / factor 1.5 / $5 source-model
comparison proposes $480 first, $320 second, $215 each for 3rd-4th and $145 each
for 5th-8th: $1,810. Explicitly proposing $490 first and $140 each for 5th-8th
produces $1,800. This is an entered manual proposal, not an automatic repair;
it changes the original geometric proportions and must remain visible.

## Genuinely unresolved before automatic approval

### Equal payouts incompatible with the fund and increment

Three equal recipients and a $100 fund with $5 increments cannot simultaneously
be exactly equal and pay out exactly $100: $35 each totals $105, $30 each totals
$90. $35/$35/$30 balances but breaks Equal. Selecting $1 increments gives
$33 each and still leaves $1. No silent winner remainder or refund is authorized.

The narrow extension decision is whether the established target policy should
select a feasible equal-cohort total ($90 or $105 here) and explicitly classify
the restricted balance or genuine funding shortfall, or require a different
method/increment before approval. The approved allocator must not quietly turn
Equal into $35/$35/$30. No pool refund is introduced by either choice.

Winner Takes All with a $103 fund and $5 increments similarly has feasible
$100/$105 targets. The established V3 rule determines direction using verified
benefits and minimum-return evidence, rather than inventing $2 income or a $3
expense. Its generalization to the new selected step and methods must be
explicit and tested. With $1 increments $103 is exact. The native fixture's
$841 fund and $835 comparison are estimates, not approved V3 target selection:
fee coverage and required-return review are still unverified. Do not classify
the $6 difference as a refund, an approved reserve or a disbursement.

### Which entry fee is the comparison reference?

Suppose the advertised event fee is $50, one entrant has a genuine approved
$25 discounted fee, and the proposed first-round prize is $40. It is less than
the published fee but more than the discounted fee. A $25 deposit toward $50
owed is a partial payment, not a $25 entry fee; waiving payment also needs its
own explicit meaning.

Options are: compare everyone to the published base fee; compare each entrant
to their documented agreed fee (which may produce different comparisons within
one equal finishing group); or use an explicit Director-reviewed reference.
No average, maximum, presumed fee from a receipt, or invented fee is selected.

The follow-up choice is whether an unmet Less/Equal/More preference should be
a review warning or prevent final approval until explicitly resolved. No solver
currently changes the factor, fund or prizes to force that preference.

## Current implementation boundary

The comparison accepts a known explicit fee only for evaluation. The native
qualifying-estimate source deliberately supplies no fee reference or actual
first-round loss evidence, so that check remains pending. Native fund coverage
and required-return review remain unverified. Durable proposal storage and the
private Finance save/recovery candidate have local database/offline browser
proof; actual signed-in provider and real-origin IndexedDB acceptance remain
unperformed. Readonly device archive browsing now has local mocked-storage and
offline browser proof; it is not current server authority. There is no final-award
approval or payment enablement.

## Concise questions for Daron (prepared, not automatically applied)

1. For new Equal / Winner Multiplier methods and selected increments, should we
   extend the existing round-down-if-minimum-met / otherwise-round-up policy to
   the nearest total that preserves the chosen method? Example: three equal
   awards from $100 in $5 increments can total $90 or $105, never $100. Existing
   approved accounting would identify restricted balance or genuine funding
   needed; no refund or invented income. Alternative: require a different
   method/increment until the full fund fits. This concerns regular prizes,
   not the already-approved Q-Pool / Side Pool remainder formula.
2. For paid first-round losers under Graduated or Winner Multiplier, should
   the prize comparison use the published event entry fee? This comparison
   does not apply to plain Equal or unpaid first-round losers.
   Example: a $40 prize is below the advertised $50, but above a player's agreed
   discounted $25 fee. A $25 deposit toward $50 owed remains a $50 entry fee.
   Alternative: compare each person's documented agreed fee and show mixed
   results within an equal finishing group; no receipt-derived assumption.
3. If the chosen Less/Equal/More comparison is unmet, should final review require
   a warning acknowledgement, or block until the settings/amounts are changed?
   Equal finishing groups and fund checks remain separate in either case.

Do not reopen no-new-pool-refunds, approved redistribution, qualification
round-up or the established regular V3 allocator. Required source verification
and fee-coverage integration are implementation/verification work, not missing
owner policy.
