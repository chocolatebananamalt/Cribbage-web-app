# Five-qualifier Main: independent ACC source review

Reviewed 2026-10-29. Read-only source/design review; no hosted state or application behavior changed.

## Required playoff topology

[2025 ACC Rulebook](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf), Rule13.2 printed50–52/PDF51–53, requires one-in-four rounded upward, highest qualifying seeds receiving first-round byes, and a full second round. The printed56/PDF57 eight-slot chart was visually checked from the cached original (SHA256 DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD). Its ordered pairings are1/8,4/5,3/6,2/7. The current [official bracket webpage](https://www.cribbage.org/NewSite/rules/playoffbracket.asp) corroborates the rule; its two image links currently404, so the PDF supplies the visual authority.

Therefore17 entrants yield5 qualifiers,8 slots,3 byes: seeds1,2,3 advance without a played match. Only4vs5 plays in round1. Round2 is1vswinner(4/5) and3vs2; round3 is their winners. Record4 actual match results total, plus3 explicit bye advancements. No invented opponent, score, game or played win is needed.

## MRP and finishing representation

The currently linked [Main MRP sheet](https://www.cribbage.org/NewSite/sched/MainMRPs.pdf), one page/effective August1,2016, explicitly credits byes as wins for MRP, gives minimum7, and stops credit after a loss. It distinguishes optional backward trophy/prize playoffs from MRP. The current Director Resources page still links this sheet; no newer effective sheet was established by this review.

For this topology, playoff MRP is70 champion,42 finalist,21 each semifinal loser,7 preliminary loser. Champion/runner-up may have different actual-played win counts depending on their seed, but played wins plus awarded byes produce identical credit at a given exit. Store both fields separately. The source does not explicitly name a shared3–4 label: bands1/2/3–4/5 are our representation of same-round elimination. Equal semifinal awards follow the owner's configured prize policy; ACC does not supply a mandatory percentage schedule here. All5 qualifiers need their configured positive total award; do not apply a4-person prize rule to5 people.

## Odd qualifying field is separate from playoff byes

[2019 Director Manual](https://www.cribbage.org/NewSite/sched/Directors%20Manual%20-%202019.pdf), §12.B printed17/PDF17 (zero-based16), gives an even-game odd-field makeup solution: twelve distinct sit-outs pair by sit-out order1vs12,2vs11,…6vs7 after normal play, with an even number of anchors (including zero). This is one supported solution, not a universal rotation mandate. For17players/12games:96 regular matches plus6 real makeup matches=102; each player gets12 actual qualifying results. A sit-out earns no invented2/+10 result. §12.C/D concerns late arrivals/departures, not ordinary sit-outs. The app must preserve each participant's original game index and independent cross-check evidence for makeup results, even if the paired players missed different scheduled rounds.

Source age distinction: this2019 manual's older residual tiebreak guidance and minimum game-count statements do not override newer2025 Rulebook/current Policy Manual. Current-policy retrieval via web failed in this review; existing dated repository policy notes remain the minimum-count evidence. No sanction certification is claimed for the software fixture.

## Local inspection and limits

Existing qualification.ts already computes5/8/3. playoff-rounds-won.ts separately accepts awarded byes and actual wins; it is arithmetic, not complete bracket authority. Persistence/UI/accounting must derive explicit topology transactionally and retain source versions. No monetary Q tie rule or calculator rounding policy was resolved or changed. No live tournament test was run by this review.

Visual evidence (internal/generated, excluded from source backup): test-results/bye-source-bracket-2025.png.
