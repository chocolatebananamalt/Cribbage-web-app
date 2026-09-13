# ACC MRP and payout source inventory — 2026-09-10

## Acceptance criterion

Identify the publicly published ACC MRP and payout materials, preserve their
effective-date evidence, and ensure that an older published schedule cannot be
mistaken for a current, production-authoritative financial rule.

## Sources checked

1. The [ACC Tournament Director Resources page](https://www.cribbage.org/NewSite/sched/tournament_dir.asp)
   publishes separate Main, Consolation, and Double-Elimination MRP documents,
   plus a sample event play-off payout-percentages document. It also states
   that a regional sanctioning request must be completed and approved before a
   tournament is sanctioned.
2. The [Main MRP sheet](https://www.cribbage.org/NewSite/sched/MainMRPs.pdf)
   says it is effective **August 1, 2016**. It covers Main qualifying and
   playoff MRP awards, including game-count tables and playoff MRP treatment
   of byes.
3. The [Consolation MRP sheet](https://www.cribbage.org/NewSite/sched/ConMRPs.pdf)
   also says it is effective **August 1, 2016**, and covers Consolation
   qualifying and playoff MRP awards.
4. The [Double-Elimination MRP sheet](https://www.cribbage.org/NewSite/sched/MRP_for_DE.pdf)
   contains player-count/ranking tables and says there is no qualifying round
   for double-elimination tournaments. Its document metadata/content is not a
   current effective-date confirmation.
5. The public [payout-percentages PDF](https://www.cribbage.org/NewSite/sched/Payout-Percentages-25_120-Players.pdf)
   is labelled as a **sample** in the resource index. The text extraction did
   not expose its percentage table, so it is not a fixture source yet.
6. A fresh public-site check on 2026-09-10 confirms that the ACC's 2026/2027
   national standings and recent 2026 player-result records actively display
   MRP values. This establishes that MRP recording is current operational
   practice, but it does not identify a current effective calculation table,
   Q-pool rule, or payout-rounding fixture.

## Safe application consequence

- A fresh check on 2026-09-11 found that the official ACC Point Scoring System
  page still links and renders the same complete Standard Main and Consolation
  qualifying schedules and the 7+7 / 4+4 playoff sequences. Recent 2026 ACC
  player-result pages show values consistent with those schedules. This is
  sufficient to preserve and executable-test the published formulas as a
  versioned **reference fixture**.
- The application may continue to show non-final qualification previews only
  where their ranking and bracket behavior is independently sourced and
  tested.
- It must not persist, publish, export, or financially reconcile an official
  MRP, Q-pool, prize, or payout value from these documents alone. The reference
  fixture remains `currentEffectiveApproved: false`. In particular, the
  2016-effective MRP sheets still need an ACC-authorized current effective-date
  confirmation for every supported event type.
- The official 2026 Topaz Summer Bash result supplies the otherwise unstated
  odd-count boundary: 59 Main entrants produced 15 qualifiers; ranks 1–8 used
  the score schedule and the remaining seven received the fixed five MRPs.
  The reference fixture therefore uses `ceil(qualifiers / 2)` for the top half.
- No saved playoff bracket/exit-round authority exists yet, so the reference
  calculator accepts an explicit exit round but is not connected to settlement
  drafts or results.
- The existing finalization/export gates remain correct. No financial rule,
  MRP table, or payout percentage was added to production code.

## Remaining evidence needed

1. An ACC-authorized confirmation that each relevant published MRP schedule
   remains current, or a newer dated replacement.
2. A machine-reviewable authoritative Q-pool and payout/rounding schedule for
   each supported event type.
3. The required result-report fields and the approved director-assisted portal
   workflow or supported import/API contract.
4. A persisted, verified playoff-bracket result that can supply the credited
   playoff round (including byes) without inferring it from paid placement.

## Verification performed

- Opened the current public Director Resources index and each linked Main,
  Consolation, Double-Elimination, and sample-payout document.
- Cross-checked the explicit 2016 effective-date language in the Main and
  Consolation sheets.
- Reviewed the existing product requirements and finalization boundary to
  confirm this inventory does not relax any official-result gate.
- Checked current public ACC standings and 2026 player-result records to
  distinguish active MRP recording from an authoritative calculation schedule.

This is source-inventory evidence, not financial-calculation certification.
