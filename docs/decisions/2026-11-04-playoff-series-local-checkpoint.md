# Playoff series settings — separate local checkpoint2026-11-04

User approved per-event regular/final settings, presets2wins/3games,3/5,4/7 and Custom. New pure models and controlled editor are NOTwired to live setup, existing brackets or result writers.

`series-settings-v1.ts` validates standard best-of majority relationship totalgames=2×requiredwins−1, positive safe integers and PostgreSQL integer technical storage ceiling. Custom5of9 is representable; nonstandard game-cap conventions are not assumed. Rule assessment is bounded to sourced one/two-day Main/Consolation contexts; unknown duration/customlonger formats require review. Originalfield257+ applies only to two-day Main final, not one-day. Approval flags do not constitute verified approval or a director waiver. Event-specific exceptions/legacy formats need separate review.

`series-progress-v1.ts` counts one verified game winner as one series win, rejects duplicates, wrong players, mixed synthetic/real provenance, pending games, out-of-order games and games after completion. It reports who reached threshold but explicitly grants no advancement authority. No table/seat assignment or bracket seeding change.

`playoff-series-settings-editor.tsx` offers separate regular/final preset/custom controlled drafts, required blank Custom inputs and event rule messages. Invalid raw input remains explicit; there is no hidden fallback/save of an old preset. No API/storage/network calls. Phone320/390/tablet768/desktop1440 and200%text browser cases passed; local synthetic UI only, not a complete player/official workflow or accessibility certification.

Future integration must freeze settings/version per match before its first verified game, perform atomic nonself/role/current-source checks, preserve game-level audit and invalidate stale concurrent updates. Historical aggregate match winners must remain readable without inventing individual game scores or sweep margins. New settings must not retroactively reinterpret completed matches. Game points/spread points from qualification do not become multiple playoff wins; skunks count as one match game win. Source PolicyManualCh6I.B-C,p6-1 andI.H: https://cribbage.org/NewSite/about/Policy%20Manual.pdf .

No DBschema, hosted state, permissions, invitation, score or publication changes occurred. This checkpoint is separate from CustomN and the regular payout/Finance redesign.

Integration context must identify the EVENT's one/two-day sanctioned format, not infer it from the overall gathering's start/end window or sanctioningfee field. A multiday gathering can contain different event formats. That explicit reliable context is not wired yet. Byes are separate bracket advances with no invented individual games/wins; the two-player series counter cannot represent a bye. Existing verified ACC seeding/bye scope remains unchanged.
