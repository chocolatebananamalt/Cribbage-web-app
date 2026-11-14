# Graduated Q hosted test progress — 2026-10-29

Six-row publication verified at c8ad2b4; no new migration. Two new fixtures created once using supported Chrome UI, director actor de0f27a1-60d0-4449-af83-fdf360a9bc08 verified by saved setup metadata on staging.

| Case | Tournament | Event | Frozen policy | Pool version |
| --- | --- | --- | --- | --- |
| All16 | 8afd9c62-efb6-4df1-a98a-f58dea4f73bf | e689ef0c-98d9-46d4-b588-617df12c028d | 1452bc42-a61c-4736-af4f-888e87a9b7c9 | afd69649-73c6-46a5-92ba-55fdd9b0830d |
| RankDown13 | 42dda60d-0d23-4624-bb5d-8b5684283946 | 5827e7a5-615a-4e62-95b4-fb68bad5d234 | dc1b1d4d-5583-4e49-a36e-8c58296821db | df450ee0-e6bd-4c1d-8dd3-d2d2b452606c |

Both open for registration, one Standard Main/12 games, base $30 and separate $10 graduated1-in-6 pool. No Side Pools. Explicit synthetic disclosure/reference; exact page2 friend-q-p2-10-6-v1 frozen before any elections/receipts. Not an ACC-sanctioning certification. Expected base $480 each; Q $160/$130; cumulative synthetic receipts $640/$610. No expenses/prizes/paid refunds/final settlement authorized.

Both no-tie fixtures use the same local96-game schedule, with16 distinct game-point totals: ranking02/01/04/03/05/06/07/08/12/11/10/09/13/14/15/16, qualifying firstfour. All16 pool pays02/01/04 $80/$50/$30 preview. RankDown13 excludes02/01/04 from Q: paid overall ranks4/5/6 (03/05/06) preview $65/$40/$25. Actual hosted scoring/qualification/previews are NOT yet tested.

Native date input fill showed valid DOM value without committing React state; one ArrowUp then ArrowDown committed the same date through normal UI. Save version2 succeeded for each; previously observed stale Finalize readiness reconciled by reload only after saved status/zero pending edits, no second save.

Roster/payment/seating/scoring still pending. Existing unpaid review row MD5 remains4453f940dc6d9715c1f5cf1b2d8210b8. No prior fixture rewrite.

## Ready-to-start checkpoint

Both fixtures now have16 paper roster identities,16 tournament check-ins,16 enrolled participants,16 resolved event check-ins, closed event attendance, closed tournament registration and unique permanent A-1..D-4 seats. Each has exactly96 published pending matchups /12 rounds and remains ready_to_start with startedAt/startedBy null. No games scored, qualification finalized, playoff result, unpaid award batch, payout/refund execution or final settlement.

- All16 schedule publication b144e78b-6b83-4b1d-b1b7-1669e110adba; participant digest3e7febca2e0e5dada7783f6014c197419261ab4868fdc633b4188f0bf3078506.
- RankDown13 schedule publication51fc6b0f-644d-4d29-a9bd-a353da2d06d8; participant digestae7a9f79d1e581397c163c5042d0c6f7989bd4ce9224afeb3e933626dc8e2559.
- Both policies frozen before elections/receipts. All16 has16 explicit elected memberships,16 current receipts totaling64000minor,48000base +16000Q allocated,16 Q paid-eligible. RankDown13 has16 membership snapshots,13 elected (all except01/02/04),16 receipts totaling61000minor,48000base +13000Q allocated,13 paid-eligible. Every receipt/membership/allocation version1; RankDown obligations allv1.
- Audit exception: AllQ01 obligation has two identical4000minor versions with the same reason. An early locator innerText ambiguity happened after the first save had executed; the repeated same-value save created version2. This was detected in authoritative verification and acknowledged. No duplicate receipt/cash counting: receipt remainsv1; one allocation bound to current obligationv2. Preserve immutable history. Obligation operation receipts98734034-cdc7-4801-9d7a-5df904a80916 and016b8024-5d73-4c6c-9182-4e55c737b999. All other All16 obligationsv1.

## Current denied actions / exact next boundary

1. A read-only SQL lookup of first_name,last_name,acc_number from existing fictional B nomination639368c0-ed6a-4077-9f88-de13c546c271 was rejected by automatic review as private role data not explicitly covered by synthetic-fixture approval. No rows returned. No alternate lookup or nomination attempted. Existing B account is pr122-player-b@test.invalid/profile986c7f24-1d42-4115-8532-053fc4bef59a; fresh tournament-scoped roles not created.
2. Supported Start All16 button action was rejected before execution because review treated the pending B access handoff as an unmet prerequisite. No retry, alternate route or start occurred. Authoritative schedule RPC confirms both fixtures unstarted and96 pending matches each.

Needed bundled authorization: read only B's existing fictional name/ACC official metadata; nominate that same account as cross_checker for both new fixtures with no-email copy-link delivery; director confirm B nonparticipant after personal acceptance; safe zero-pending-work account switches; start both fictional events after B's prerequisites are verified. User personally accepts each invitation and enters existing passwords. No new accounts/co-director grants, actual money or broader security settings.

Resolved independent issue: an enrollment call was initially rejected because the latest captured UI showed14/16 check-ins. Read-only reconciliation proved all16 last saves persisted, then the supported enrollment was retried once and succeeded. No uncertain check-in writes were repeated.

CSV file chooser could not setFiles because installed extension lacks Allow access to file URLs. No setting change requested or attempted. Roster used the product's exposed manual fallback; schedule used its exposed Or paste CSV form. Neither bypasses a denied application action.

Preservation read-only checks after setup: old Q/funded/negative fixtures each still96/96 verified. Old Q source digest unchanged2a4f70b7f5dfc2c73f837b881a8f92bc66f1c9c8f187b935e3b93d965fb1235c; preserved unpaid review row MD5 unchanged4453f940dc6d9715c1f5cf1b2d8210b8. RankDown schedule refresh persisted96matchups/ready-to-start. Director Chrome tab336434207 preserved on RankDown schedule with zero unsent/retry records. No password entered/sign-out attempted.

## B invitations prepared after explicit owner approval, 2026-10-29

The08:52UTC approval permitted the scoped previously denied B fictional official metadata read; it succeeded once. Used existing B pr122-player-b@test.invalid, no new account/credentials. No unrelated role data read.

Both supported no-email nominations saved once and persisted pending:
- All16 nomination188f8384-e942-4967-8903-45a4b0fc5ad6.
- RankDown13 nomination0d52af45-d5d4-4e5c-9590-3855f8c12023.

Current app exposes acceptance at /official-invitations/<nominationId> without a separate copied secret. Supported source and returned acceptancePath validate this; no token/clipboard extraction occurred. Both invite forms reset after saves. Closed only this run's temporary second invitation tab after persistence and no unsaved work confirmed.

Exactly one stable-origin app tab remained; visible zero unsent/retry work confirmed. Approved Clear safe app data and sign out clicked once. Actual Sign in page verified afterward (the flow redirects there, not to Tournament access). No retry or credentials entered.

User handoff: Chrome blue group B — ACCEPT BOTH Q TESTS, tab336434207 ACC Tournament Desk. Existing B email filled; password blank. Sign-in next points to All16 nomination188f8384-e942-4967-8903-45a4b0fc5ad6. User enters existing password and signs in, then personally accepts confirmed All16/Cross-Checker invitation. RankDown13 acceptance can be prepared next without another login; do not accept automatically or duplicate invitations.

Both rosters are16 unlinked paper entrants, no player accounts linked, so neither director nor B is a linked entrant. This is read-only roster evidence, not a saved official identity-binding attestation. No self-binding or new attestation performed. Follow the actual supported independent-attestation requirements after acceptance; the owner's latest wording explicitly mentions confirming director nonplayer status.

Both events remain ready_to_start. Start actions will occur only after B personally accepts as instructed. No new start attempt or receipt/obligation/scoring/qualification write this turn. Existing duplicated identical AllQ01 obligation audit remains preserved.

## All16 acceptance verified; RankDown13 handoff

At09:03UTC user reported completion. Actual All16 invitation page shows Accepted/approved official. Persisted nomination188f8384-e942-4967-8903-45a4b0fc5ad6 is active and accepted_profile_id986c7f24-1d42-4115-8532-053fc4bef59a, the existing B identity. RankDown13 nomination0d52af45-d5d4-4e5c-9590-3855f8c12023 remains pending/null accepted profile.

Opened the existing RankDown13 acceptance page in the same B session; correct tournament and Cross-Checker role visible, Accept invitation enabled. No new login, sign-out, invitation creation or automated acceptance. Handoff remains blue B — ACCEPT BOTH Q TESTS, ACC Tournament Desk, tab336434207. User only clicks Accept invitation for RankDown13 and reports Done.

## Both acceptances verified; director login required

RankDown13 nomination0d52af45-d5d4-4e5c-9590-3855f8c12023 is now active, accepted_profile_id986c7f24-1d42-4115-8532-053fc4bef59a. Both invitations accepted once by exact B. Actual browser acceptance page confirms approved official. B paper workspace correctly blocks scoring because actor identity confirmation is not saved; Cross-Checker role exposes no identity-binding control. Director is needed to confirm B independently and start the events. No self-binding attempted.

Safe B-to-director switch completed once after one stable-origin app tab/zero unsent scores or retry records verified. Actual Sign in page observed. Director email prepared. Current orange DIRECTOR — START BOTH Q TESTS group, ACC Tournament Desk, tab336434207. User enters existing director password and clicks Sign in. No password read/entered/submitted by automation. Final screenshot incidentally shows a masked password field filled by user/browser while handing off; do not extract it or assume sign-in succeeded.

No event start/scoring/qualification/financial write this turn. Existing roles/history/fixtures preserved.

## Both B confirmations and event starts verified

Current director session exposed only its authorized director controls; saved binding actor verified exact de0f27a1-60d0-4449-af83-fdf360a9bc08. Confirmed B nonparticipant once per fixture, bindingversion1:
- All16 bindingff6026da-b5c1-40cd-a56e-e4cc7f6b403b.
- RankDown13 binding0f412eba-a7f9-44b4-ae49-9b40e889c214.
Both bind official986c7f24-1d42-4115-8532-053fc4bef59a, independently confirmed by director. Director's own binding left untouched; no self-attestation.

Supported event starts clicked once each only after accepted invitations, independent confirmations and ready-state rechecks:
- All16 in_progress since2026-10-29T09:20:19.013654+00:00.
- RankDown13 in_progress since2026-10-29T09:21:08.203026+00:00.
Authoritative B paper workspace: cross_checker, actorIdentityConfirmed true,96 candidates and0 reviews each. No score outcome captured yet.

Safe director-to-B switch completed once after one same-origin app tab and zero pending/retry work. Actual Sign in verified. Current blue B — SCORE BOTH Q TESTS group, tab336434207 ACC Tournament Desk. pr122-player-b@test.invalid filled; user password entry/Sign in required. No invitation needed; both accepted. No password read/entered/submitted by automation. After verified B login execute both96-game synthetic plans in one session, then approved final director switch for qualification/previews. No new manual receipt/expense, actual money, payoff/refund or final settlement write occurred in this turn.

## First synthetic capture blocked before execution

B sign-in verified by actual tournament chooser showing both Cross-Checker memberships; All16 paper page exposes96 capture forms and no identity block. Exact B profile/active accepted memberships and director-confirmed bindings were previously verified.

The first UI capture call was rejected by automatic approval review: checking the required checkbox 'I compared both original paper scorecards and they show this same result.' with synthetic fixture data was judged not clearly authorized. No alternate route or retry. Read-only authoritative reconciliation confirms BOTH fixtures96 untouched candidates,0 pending reviews,0 changed game states. First form remains blank (both margins/references empty, checkbox false); zero recovery/retry entries. Thus rejected operation did not execute.

Specific approval needed to retry: authorize that checkbox as a SIMULATED attestation solely for these two fictional staging fixtures using their paired synthetic card records, while explicitly not claiming real original paper cards, photographs, OCR or independent human review. Existing instructions already authorize96 synthetic games each; the additional issue is the checkbox wording. Do not fabricate actual paper evidence or bypass the checkbox.

Completed unaffected local validation using actual current chart lookup/Q calculator:96matches,12games per player,16 unique game-point totals,271aggregate gamepoints,96wins,zero netspread. ALL16 yields p2/p1/p4 8000/5000/3000minor; RANKDOWN13 excludes p2/p1/p4 and yields p3/p5/p6 6500/4000/2500minor, including two nonqualifiers. Local paired synthetic card records generated with explicit TEST ONLY references,192rows each, ignored test-results/q-all16-synthetic-card-records.csv and q-rankdown13-synthetic-card-records.csv. Validation script test-results/q-graduated-plan-validation.mjs passed. These are proposed synthetic evidence, not played results.

Preserved current B session on All16 paper-games tab336434207, blue B — SCORE BOTH Q TESTS; markHandoff. No new login required to resume after scoped approval. No hosted capture/review, financial, qualification, migration/publication or production write this turn.

## All16 scoring midpoint

Owner explicitly approved the simulated comparison checkbox at09:31UTC. Compared all96 paired records in each actual prepared synthetic CSV against the plan:192rows per fixture, reciprocal winner/margin/reference matches. First authorized capture saved; its UI wait timed out, but read-only inspection found the pending re-entry and no retry occurred. Subsequent operations use bounded capture/re-entry batches and source-only waiting; no duplicate submit.

All16 rounds1–6 completed through supported UI,48captures and48 separate re-entries, zero pending review forms. First32 were also reconciled authoritative32verified/64pending; midpoint counts checked separately. No real photos/original cards/human-review claim. Synthetic references TEST ONLY SYNTHETIC ALL16 G<round> P<owner>. B remains current actor with director-confirmed nonparticipant identity. RankDown13 still96untouched games, no scoring yet. Continue without re-entering completed rounds.

## All16 scoring complete and canonical totals exact

96 distinct captures,96 approved re-entry reviews,192 evidence rows,192 canonical scorelines. Actual B capture/review actor checks found no unexpected profile. All16 paper page refreshed:0 capture forms and0 pending reviews, no repeat save. Canonical card_scorelines grouped per participant were independently compared to all16 expected plan rows: no differences in games/points/wins/gross plus/net. Totals271points,96wins,zero net. All16 order02/01/04/03/05/06/07/08/12/11/10/09/13/14/15/16; every player12games and all16 primary point totals unique. Qualification not finalized yet.

Current same B session moved to RankDown13 paper page:96 untouched capture forms,0 reviews; no account switch or login required. Continue that fixture only, do not repeat All16 scoring. All evidence remains explicitly simulated and references actual paired synthetic CSV records. No physical cards/photos/OCR or two-human review claimed.

## RankDown13 midpoint

Rounds1–6 captured/re-entered,48completed games,0pending review forms. Actual paired synthetic CSV records compared across all96pairs before scoring. A stale All16 helper label was caught by a no-match selector before any RankDown mutation; the separate fixture-specific helper was then defined and used. No game/record was repeated because of that selector failure. All16 remains96/96complete. Pool and financial state unchanged.

## BOTH scoring runs complete — final director handoff

Both tournaments now96/96verified through UI capture and separate re-entry. Each has96 distinct captures,96 approved reviews,192 evidence records,192 canonical scorelines; zero unexpected capturer/reviewer profiles and zero non-synthetic references. Actual32 canonical player totals compared with independent plan: no differences in games/points/wins/grossplus/net; each tournament271gamepoints,96wins,zero net,16 distinct primary scores. Both expected qualifier orders02/01/04/03. RankDown13 receipt61000/base48000/Q13000minor/13paid; All16 receipt64000/base48000/Q16000minor/16paid,16 current allocations each. No financial/membership rewrite during scoring. Prior duplicate same-value AllQ01 obligation preserved.

RankDown13 page refreshed:0capture/review forms; All16 earlier refresh likewise0/0. No pending retry/recovery records. One same-origin app tab. Safe B-to-director sign-out completed once; actual Sign in page verified. Current orange DIRECTOR — FINAL Q PREVIEWS, ACC Tournament Desk, tab336434207; director email prefilled, user password/sign-in needed. No password read/entered/submitted. Current actual SQL evidence in ignored test-results/q-graduated-scoring-actual-evidence.json.

Next already-authorized steps after director sign-in: reconcile both96verified/untied source states, finalize qualification once per event, then read-only authoritative v2 Q previews. Expected All16 02/01/04 $80/$50/$30; RankDown13 excludes02/01/04 from paidpool, pays03/05/06 $65/$40/$25 (05/06 actual nonqualifiers). No new paid award/unpaid batch/refund execution/playoff/settlement/production. Do not claim hosted preview pass until actually read after finalized qualification.

Only first capture wait timed out after a successful save and was reconciled without repeating. One stale local helper-name selector failed before any RankDown input and was corrected. A slower round-ten capture call completed normally; no hung or uncertain operation remains. No duplicate score submission/review.

## Terminal hosted acceptance PASS - 2026-10-29 final director verification

Director session verified through director-only UI after user sign-in. Qualification finalized exactly once per event through supported UI, four untied qualifiers 02/01/04/03 and no byes in each.

- All16 qualification v1 4b177c66-573e-42be-868b-4a0f9a38d4b0, finalized 10:14:22.184074 UTC, accepted operation receipt c70fbeb7-feb6-4f64-b218-7081df090bd7. Hosted proposed awards: AllQ02 $80.00, AllQ01 $50.00, AllQ04 $30.00; all qualified, 16 paid entrants, $160.00 pot conserved. Source digest 2fc34c0a02d30c442f068f5369aec42f0ee51d806c9cc4b29706e1333c24a565.
- RankDown13 qualification v1 1b15f9dd-2696-4626-9c31-5d3302156e45, finalized 10:15:07.397477 UTC, accepted operation receipt 8b5e18ea-fe94-41b8-baae-8df48366f5ab. Hosted proposed awards: RankDown03 $65.00 (overall rank4, qualified), RankDown05 $40.00 (rank5, high nonqualifier), RankDown06 $25.00 (rank6, not qualified). Top-three qualified cards 02/01/04 did not enter the pool and receive no Q award. 13 paid entrants, $130.00 pot conserved. Source digest 86b60f5b1575ac850d297833089081c2f4fe52e5256337ad63e452bb796a3c2e.

Both actual UI preview articles and source digests remained byte-identical after one reload each. Server workspace digests match displayed digests, no workspace blockers. These are read-only proposed awards, not persisted award/payment records. Each event still has96 captures,96 approve reviews,192 evidence rows,192 canonical scorelines/96 distinct games, exactly one qualification version by director de0f27a1-60d0-4449-af83-fdf360a9bc08. Each new tournament has zero unpaid obligation review batches. No scores were resubmitted during qualification/preview verification.

Financial source recheck: All16 $640 receipts/$480 base/$160 Q,16 current allocations/16 eligible; RankDown13 $610/$480/$130,16 current allocations/13 eligible. Frozen policy IDs remain1452bc42-a61c-4736-af4f-888e87a9b7c9 and dc1b1d4d-5583-4e49-a36e-8c58296821db. No ledger/allocation mutation in this final phase. Previously documented AllQ01 identical obligation-history exception preserved.

Older Q fixture source digest remains2a4f70b7f5dfc2c73f837b881a8f92bc66f1c9c8f187b935e3b93d965fb1235c and immutable unpaid review b5576ce8-7a59-4de5-a984-ce37f7645f2d row MD5 remains4453f940dc6d9715c1f5cf1b2d8210b8. Older Q, funded and negative fixtures retain96 games/192 scorelines each. No new payout/refund execution, obligation batch, playoff or final settlement. Production unchanged. Current director session left open on RankDown13 Q preview; no further user action needed for this bounded acceptance.

Limits: synthetic paired records only; no original paper/photo/OCR or independent two-human review coverage. No residual score ties, card-cut resolution or ACC sanction eligibility tested (16 entrants is below Main17 minimum). No additional concurrency/replay fault injection claimed; reload persistence and no duplicate writes were actually checked. Remaining tie-rule compliance and canonical Q settlement integration require separate scoped work.
