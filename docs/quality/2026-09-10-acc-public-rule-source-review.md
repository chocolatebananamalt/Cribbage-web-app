# ACC public rule-source review — 2026-09-10

## Scope

This review identifies current public ACC sources that may govern the app. It
does not treat an older policy manual, an online-tournament page, or a
prototype as authority to invent an unconfirmed in-person tournament rule.
The canonical rule fixtures and financial schedules remain a separate task.

## Current public sources checked

1. The [ACC Official Tournament Rules page](https://www.cribbage.org/NewSite/rules/default.asp)
   identifies **Rulebook 2025** as its current public rulebook edition.
2. The [ACC Play-off Brackets and Byes page](https://www.cribbage.org/NewSite/rules/playoffbracket.asp)
   states that qualifying scorecards must be cross-checked and tallied; one in
   four entrants qualifies, fractions round up, byes go to the highest
   qualifiers, and the second playoff round must be a full bracket.
3. The [ACC Tournament Director Resources page](https://www.cribbage.org/NewSite/sched/tournament_dir.asp)
   identifies the sanctioning process, director manual, official rules,
   MRP/payout resources, report materials, scorecard templates, and rotating
   doubles materials as public resource categories.
4. The ACC [Policy Manual](https://www.cribbage.org/NewSite/about/Policy%20Manual%2008162017A.pdf)
   is an older supporting source. Its tournament section explicitly states
   2 points for a qualifying-round win, 3 for a win by 31 or more, and 0 for
   a loss. It also records the ranking order: game points, games won, net
   spread, plus points, head-to-head if available, then a one-game playoff.
   It must not supersede the 2025 Rulebook where the two conflict.
5. Appendix B of the 2025 Rulebook covers traditional and Canadian Doubles.
   It says that singles rules generally apply to doubles, then supplies distinct
   team seating/rotation, four-player cut-for-deal, Canadian hand-configuration,
   incorrect-card, and table-talk rules.

## Confirmed application implications

- The existing 1–121 margin boundary and derived 0/2/3 game points match the
  public scoring baseline.
- Rule 12.1's scorecard convention requires a leading zero for a one-digit
  per-game spread. The display contract is therefore `01` through `09` for a
  populated game-row spread cell, while stored and calculated values remain
  integers.
- Separate plus/minus values are necessary: net spread and plus points have
  distinct places in the qualifying hierarchy.
- The ranking calculation must never substitute minus points as another
  tie-breaker.
- Qualifier count is `ceil(entrants / 4)`, not the next complete bracket
  size. Bracket size and first-round byes are calculated only after that count.
- Cross-check/tally is a required operational gate for qualifying scorecards;
  it cannot be represented as cosmetic UI status.
- The judge workflow must start with two judges present; at least one has the
  rulebook. A third judge is available when a player disagrees with the first
  two judges' decision, and the three-judge decision is final. The prior
  requirements wording incorrectly tied the third judge only to disagreement
  between the first two judges; that conflict was corrected in
  `production-requirements.md` before the feature is implemented.
- Rule 11.4 provides an implementable, narrow post-lunch absence fixture:
  five-minute grace, a 2/+10 outcome for the opponent and 0/-10 for the late
  player, continued rotation, and only one such award. Rule 13.1 separately
  defines playoff absence forfeits. Both are now explicit requirements, while
  broader rotation/replacement rules remain blocked pending source fixtures.
- Doubles cannot reuse the singles data model unchanged. Appendix B assigns a
  seat to a **team**, permits multiple rotation systems, and makes Canadian
  Doubles hand configuration and four-player play materially different. A
  future team workflow must model two named members per side, team-scoped
  seating/rotation, and appropriate independent record/confirmation authority.
  The source is sufficient to reject a false claim that team events are just
  two singles cards; it is not yet a completed, fixture-tested digital
  team-scorecard specification.

## Cached-edition clause review and implementation ledger

The permitted cached copy was independently re-read on 2026-09-10. Its
SHA-256 remains
`DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`, matching
the metadata shown in the protected Rulebook page. The following references
are sufficiently specific to guide implementation work, but are not a claim
that every related workflow is complete:

| 2025 Rulebook location | Confirmed rule | Present application state | Release consequence |
| --- | --- | --- | --- |
| Rule 12.1 (scorecard) | A win receives 2 points, a win by 31+ receives 3, a loss receives 0; one-digit per-game spreads use a leading zero. | `src/lib/score.ts`, score-card rendering, and boundary tests cover margin, reciprocal values, 0/2/3 points, and `01`–`09` display. | The limited Standard Singles derivation is backed by tests. |
| Rule 12.2(a)–(i) (cross-check discrepancies) | Resolution may change one or both card records, derived game/spread totals, and a qualification position. Cases (b) and (h) can retain non-reciprocal corrected values on the two cards. | The current shared-result correction writer cannot represent those cases faithfully. It is default-off at the app boundary. Migrations `0096`–`0098` revoke its direct authenticated writers, policy writer, and correction readers; the replacement requires independent-card projections and fixtures for all nine cases. | Do not present correction handling as ACC-complete or finalize an affected event from it. |
| Rule 13.2 (qualifiers and brackets) | Cross-check/tally qualifying cards; one in four qualifies, fractions round up; the highest qualifiers receive byes needed to make the second round a full bracket. | `src/lib/qualification.ts` and tests cover numeric order, rounded qualification count, bracket size, and byes. | It remains a preview only until head-to-head/playoff tie resolution and finalization fixtures are implemented. |
| Appendix A / cross-check guidance | Cross-checking is an operational control, not a decorative scorecard status. | Two independent submissions and confirmations, pending states, audit records, self-check limits, and a protected scorecard reader are implemented in the current slice. | Independent real-browser sessions and full cross-check staffing/exception fixtures remain required. |

The qualification preview deliberately stops rather than inventing a final
ordering whenever the numeric inputs are tied. That is more conservative than
using an unimplemented head-to-head or playoff outcome, and it prevents an
unverified result from being exported as official.

## Still unconfirmed and therefore not encoded as official results

- Exact digital scorecard, independent-entry/confirmation, standings,
  qualification, payout, and reporting fixtures for team/doubles, Consolation,
  double-elimination, and all configured satellite event variants.
- Effective MRP, Q-pool, payout, report, and portal-import schedules.
- ACC permission to recognize the app's digital verification and corrections
  as official records.

No rule-derived finalization, payout, or ACC export may be enabled until these
items have a dated source and executable positive and rejection fixtures.

## 2026-09-10 direct-RPC suspension verification

**Acceptance criterion:** while Rule 12 correction handling is release-gated,
an authenticated caller cannot invoke any correction writer, correction-policy
writer, correction workspace, or correction replay reader directly.

Applied migrations `0097_suspend_incomplete_rule12_correction_policy` and
`0098_suspend_incomplete_rule12_correction_readers` only to the separate
synthetic validation project, never the shared pilot. The database catalog
check returned `authenticated_execute = false` for all five exposed correction
functions: `configure_correction_policy`, `get_correction_workspace`,
`get_correction_operation_reconciliation`, `get_correction_policy`, and
`get_correction_policy_operation_reconciliation`.

The Supabase security advisor continues to report intentional `SECURITY
DEFINER` RPC exposure for other active, authorization-checked workflows and
the separate free-plan limitation that leaked-password protection cannot be
enabled. Those items are documented release considerations; neither was
relaxed or changed here. The suspended correction functions no longer appear
as authenticated-executable findings.

## 2026-09-10 independent-card foundation verification

**Acceptance criterion:** the replacement schema can retain the original and
adjudicated values for each individual scorecard without imposing reciprocal
correction values, and it does not expose a new writer or reader.

Migration `0099_independent_card_correction_projection_foundation` applied
cleanly to the separate synthetic validation project. It creates private,
RLS-forced, immutable case and projection tables with one projection for each
card side, retains source Rule 12.2 case codes `12.2a` through `12.2i`, and
has no grant. Static contract coverage and the full local verification suite
pass. This proves only that the inert structural foundation is valid; it does
not prove lifecycle, adjudication, standings, qualification, or browser
behavior and does not re-enable the correction feature.

The Git-connected Vercel Preview for commit `ba896b4` reached `READY` on
2026-09-10 with no runtime errors reported in the preceding hour. The preview
is protected by Vercel authentication, so an unauthenticated request is
redirected to Vercel sign-in rather than serving the application; this is the
expected non-public-pilot boundary. Vercel's build-log endpoint is not granted
to the connected read token, so local `pnpm verify` remains the recorded build
evidence for this commit.
