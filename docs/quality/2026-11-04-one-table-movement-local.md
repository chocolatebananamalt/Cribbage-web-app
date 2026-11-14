# One-table qualifying movement display — LOCAL ONLY

## Scope and source
Parent authorized non-fixture physical movement display improvement for the verified one-table case. No hosted reads/writes, database/fixture creation, invitations, publication, funds or retry of the denied fixture operation. Prior payout, seating and mixed checkpoints are retained separately.

Official source: ACC Grass Roots Organization, Policy and Procedures Manual v8.1, effective September1,2026. SectionX printed7–8 (PDFpages9–10), Figures1–2. Public URL https://www.cribbage.org/grassroots/docs/General_GR_Docs/Manual/GR_Manual_Ver_8.1_FINAL_08102026.pdf . Actual908699-byte/23-page PDF downloaded, rendered and visually inspected; sourceSHA2564c55c8420d207732efb281f91080c3d1a71907030a37905eabd582263b24e5d8. Receipt `test-results/one-table-movement-source.json`. The manual illustrates12seats and describes even-field/single-anchor movement; this implementation is a mechanically checked18-seat extension, not an ACC-approved18seat venue layout/certification. General multi-anchor layouts are excluded even though the manual describes other arrangements.

## Proven map and preserved identity
With one contiguous18seat table arrangement, evens2/4/.../18 above odds1/3/.../17 in a top-down diagram, paired directly across:
-Seat1 stays fixed as the anchor.
-Seat2 travels around the diagram's left end, bypasses Seat1 and goes to Seat3.
-Odd seats3through15 advance by2; Seat17 goes around the right end to Seat18.
-Even seats4through18 decrease by2. This is each seated player's right, not a universal screen-right direction.

The pure projector reads an EXISTING candidate. It does not generate, reorder, repair, draw, resample, assignIDs, publish or mutate history. It validates every one of108matches, all18people once per round,9correct facing pairs per round, unique opponents, firstseat=fixedproposedTournamentID, stationary anchor and all11transitions. The actual supplied movement must match; active-pair array order alone is not trusted or sorted to repair a candidate. Round12has no proposed Game13movement. Names are optional official-view labels; ACC numbers are never used as Tournament IDs.

## UI and integration
`src/components/one-table-movement-preview.tsx` is mounted only in the existing local anonymous and roster-bound candidate displays. It shows selected starting TournamentID separately from current Table/Seat, opponent startingID and next planned seat; the map puts even seats above odds with a table surface, explicit facing/right directions and selected-text/border indicator.18columns use intentional horizontal scrolling. Current anonymous lockedinput and immutable historical planconfig bind the two mounts correctly; editable latest config cannot reinterpret an old draw.

Unsupported multiple tables,20chair/extrachair arrangements, missing pairs, another anchor seat or malformed/fullschedule movement block this display, leaving original candidates untouched. It never silently chooses another physical layout. Whole physical-room certification and native seating publication remain unavailable.

## Executed verification
-Six focused pure tests passed, independently rerun by reviewer: literal independent18seat oracle,25pure draw calculations, all108/12opponents/11transitions, ordering/mutation/unsupported/fixedID/lastgame/frozeninput cases. No operational records or test database involved.
-Four fresh component-only browser groups at320/390/768/1440 and doubled computed text passed. A-2remainsfixed while currentSeat2→3→5; anchorA-1stays; A-17→18; Game12no13; corrupted lateGame12blocks ALL directions even while viewingGame1; unsupported layout blocks. NoAPI/external/storage activity, suppliedcandidateJSONunchanged.
-Reran existing non-database anonymous browser8groups (actual local crypto route/in-memory receipt recovery) and roster browser3groups (mock API/real recovery coordinator): all passed after mounts. No SQL or denied fixture action was run.
-Final `pnpm verify` exited0:1327app tests,6provider checks, build, lint, audit(no known vulnerabilities),8workspace; `verify:handoff`6passed. Independent model review found noP1/P2. React hooks/accessibility/readonly prop boundaries reviewed. Visually inspected selected390px player summary and1440px map: fixedA-2/currentSeat3/opponentA-6 remain distinct, odd/even orientation and anchor correct.

Receipts: `test-results/one-table-movement-browser/result.json`, `local-seating-planner-browser/result.json`, `roster-random-draw-browser/result.json`; finalverify/handoff logs named `one-table-movement-*`. Pure sourceSHA2561fcf7da827a2ef4fbfa5cc69bd83cb54b734bd4a2cdaad56bcc0710f63baf9d7. Separate source/evidenceZIP and allentryCRC/SHA manifest receipt in `test-results/one-table-movement-backup.json`; localdisk only, not off-device.

## Remaining confirmation and gaps
No new payout or competitive-policy choice is required for this bounded display. Before using it with humans, confirm the actual mock has the opposed odd/even18seat arrangement, approved stationary Seat1 occupant and safe clear end routes; walk the room once. If the room/anchor differs, this guide stays blocked until separately supported. No need to wake the owner or alter his draft now.

The guide does not prove actual room capacity, a physical walkthrough, a fresh SQL one-table roundtrip, provider-authenticated players, native ID/schedule publication/distribution or independent-human mock acceptance. Existing database generator was not changed or rerun. Source/manual matching and pure/browser display checks do not certify a sanctioned event. General multi-table/multi-anchor/odd-field movement and user-departure revisions remain separate scope. All previous financial/payout policy decisions remain pending as before.
