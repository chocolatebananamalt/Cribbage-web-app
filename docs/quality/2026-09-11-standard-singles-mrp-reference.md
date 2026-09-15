# Standard Singles MRP reference fixture

**Date:** 2026-09-11  
**Status:** Historical reference fixture; superseded for supported production calculation on 2026-09-14

> **Superseding update — 2026-09-14:** The owner approved server-only automatic
> calculation for supported Standard Main/Consolation events using the published
> source named below. Migration `0190_automatic_standard_singles_mrp_results`
> persists source version `acc-published-mrp-2016-08-01` and effective date
> `2016-08-01`, rejects incomplete playoff-exit-round data, and never calculates
> Satellite MRPs. This document retains the original discovery evidence.

## Source findings

- Official scoring index observed 2026-09-11:
  `https://www.cribbage.org/newsite/about/scoring.asp`.
- Linked schedules:
  `https://www.cribbage.org/NewSite/sched/MainMRPs.pdf` and
  `https://www.cribbage.org/NewSite/sched/ConMRPs.pdf`.
- Current odd-boundary corroboration:
  `https://www.cribbage.org/NewSite/sched/tournament_results.asp?tournament_id=8984`.
- The official ACC Point Scoring System page currently lists Standard Main
  game counts 12, 14, 16, 18, 20, 21, and 22 and Standard Consolation game
  counts 7, 8, 9, 10, and 12.
- Its linked ACC sheets say effective August 1, 2016. Main qualifying MRPs use
  the published five-point schedule and playoffs use the 7+7 sequence;
  Consolation uses the three-point schedule and 4+4 sequence. Both state that
  byes count as a playoff win and no later MRP is earned after a loss.
- The live official page and recent 2026 results corroborate continued use. The
  owner chose the source-versioned published schedule as the calculation basis
  for the rehearsal and supported October scope; automatic ACC submission
  remains outside this decision.

## Implemented boundary

`calculateStandardSinglesMrpReference` remains a deterministic fixture for the
published schedule. The production settlement path now independently uses the
equivalent server-only calculation, bound to an exact qualification/playoff
result and automatic source/effective-date evidence.

The calculator rejects unsupported event/game types, invalid scores or ranks,
top-half scores below the published table, and invalid playoff rounds. The
official 2026 Topaz Summer Bash result resolves the odd qualifier boundary:
with 15 Main qualifiers, the first eight received score-based MRPs and the
remaining seven received the fixed five, so the fixture uses
`ceil(qualifiers / 2)`.

## Remaining blockers ranked by evidence

1. **Playoff authority:** verified exit-round/byes data must be persisted; paid
   placement alone is not a safe substitute.
2. **Q-pools:** equal and graduated concepts are published, but allocation,
   rounding/remainder, eligibility, and approval fixtures are incomplete.
3. **Event prize payouts:** the only public percentage sheet is explicitly a
   sample and remains non-machine-reviewable; no official automatic schedule
   is available.
4. **Double elimination/Consy Lite:** outside the October digital-scoring
   boundary and lacking the same effective-date confidence.

## Verification

- `node --test tests/standard-singles-mrp-reference.test.mjs`: PASS, 3/3.
- `pnpm verify`: PASS, including 334/334 application tests, dependency audit,
  lint, production build, 6/6 workspace checks, and embedded private-handoff
  verification.
- `pnpm verify:handoff`: PASS, 6/6.
- No browser check was required because this reference fixture is deliberately
  disconnected from the UI and every authoritative persistence/export path.
