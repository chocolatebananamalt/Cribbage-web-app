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

## Confirmed application implications

- The existing 1–121 margin boundary and derived 0/2/3 game points match the
  public scoring baseline.
- Separate plus/minus values are necessary: net spread and plus points have
  distinct places in the qualifying hierarchy.
- The ranking calculation must never substitute minus points as another
  tie-breaker.
- Qualifier count is `ceil(entrants / 4)`, not the next complete bracket
  size. Bracket size and first-round byes are calculated only after that count.
- Cross-check/tally is a required operational gate for qualifying scorecards;
  it cannot be represented as cosmetic UI status.

## Still unconfirmed and therefore not encoded as official results

- The exact 2025 rulebook passages for all team/doubles, consolation,
  double-elimination, judge, late/forfeit, and seating/play-through cases.
- Effective MRP, Q-pool, payout, report, and portal-import schedules.
- ACC permission to recognize the app's digital verification and corrections
  as official records.

No rule-derived finalization, payout, or ACC export may be enabled until these
items have a dated source and executable positive and rejection fixtures.
