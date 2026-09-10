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

## Still unconfirmed and therefore not encoded as official results

- Exact digital scorecard, independent-entry/confirmation, standings,
  qualification, payout, and reporting fixtures for team/doubles, Consolation,
  double-elimination, and all configured satellite event variants.
- Effective MRP, Q-pool, payout, report, and portal-import schedules.
- ACC permission to recognize the app's digital verification and corrections
  as official records.

No rule-derived finalization, payout, or ACC export may be enabled until these
items have a dated source and executable positive and rejection fixtures.
