# Physical trial print packet — 2026-11-10

Acceptance: a reproducible fictional-only packet with18 chair labels and18 blank12-game reference cards, exact roster-entry/participant/fixed-ID joins, canonical/candidate match agreement and explicit physical-chair versus immutable Tournament-ID distinction. No new draw, outcome generation or database simulation.

## Deliverables

`output/print/physical-trial-18-20261110/` contains table-and-chair-labels.pdf (4 pages), fixture-starting-directory.pdf (1), fixture-assignment-cards.pdf (18), matching standalone HTML/first-page PNGs, chair-cut-label-preview.png, print-data.json and verification.json (source/output SHA256).

Reproduce to a NEW destination: `node scripts/physical-trial-print-packet.mjs --fixture-dir test-results/native-mixed-pool-results-20261109/runtime-evidence --output NEW_LOCAL_DIRECTORY`. Existing destinations are refused. Uses installed Chrome offline about:blank, no provider/navigation/upload.

## Proof

Saved actual fictional SQL-run artifacts only: scoring-results.json, flow-results.json, current-results-source-witness.json. Candidate roster-entry IDs are joined explicitly to operational participant IDs; neither identity is guessed from position. All18 starting assignments,108 canonical matches,216 reciprocal card rows and12 distinct opponents each agree. DD9/PD54/PP45. Existing independent oracle validates the graph; existing one-table movement and initial-game validators accept it. No oracle result-generation path invoked.

Six metadata binding sets are constructed from that canonical graph and projected through the app scorecard projector:72 digital assignment rows agree. This does NOT establish captured own-player RPC/provider agreement. The native scorecard now retains each binding's current chair and opponent chair separately from fixed Tournament IDs and displays them only for the authoritative current game.

## Checks

23 tests passed: physical-trial-print-packet, native-mixed-player-scorecard-v1, one-table-movement, initial-game-seats; log `test-results/physical-trial-print-focused-20261110.log`. `node node_modules/typescript/bin/tsc --noEmit` and scoped ESLint exit0. PDF reparse confirms4/1/18 pages;23 sheet bounds fit Letter and network request count0. Actual local HTML label/card screenshots visually inspected; no PDF-viewer pixel assertion. Full `pnpm verify` unavailable (pnpm missing; denied audit not retried). Responsive native screen/real signed-in acceptance not rerun; source/SSR regression only for that app change.

## Limits and safety

This is the saved fictional fixture, not the eventual group's draw. One logical opposed A18 layout is not evidence that18 chairs fit one physical furniture table. Room capacity, joined-furniture placement and walking route require actual review. Odd/even facing convention and existing verified one-table movement are reused; no new arrows/movement rules invented. A1 is stationary in this fixture; voluntary anchor approval/fairness is not established. Chair labels stay with furniture; Tournament IDs follow players. Scores/confirmations are blank; cards are reference material, not verified results. No actor/profile/session/receipt IDs are printed. No fresh fixture, hosted operation, Library upload, access change, payment or blocked-publication retry occurred.
Independent review found a source-lineage gap; fixed by checking Start expected schedule digest and both context IDs against publication plus exact108 unique qualifying evidence-head game IDs against canonical games. Added five mutation rejections.23 focused tests still pass; post-fix builder output deep-equals retained print-data.json, preserving rendered evidence without rerender. Scoped lint passes. SSR explicitly asserts both current chair labels. Review completion recorded separately in handoff.

Independent final review: GO for bounded local fixture packet/chair-display handoff; no remaining narrow blocker. Full app, physical room and real provider acceptance remain pending. Retained output SHA256 checks all pass.


Follow-up: actual Scorecard SSR with real CSS passed offline browser390/1440 at100/200% text using deliberately different current chairs A17/A18 and fixed ID A3. Both chairs, immutable ID and authoritative current-game link present; current panel fits viewport and whole page has no horizontal overflow. Zero network.390/200% current panel screenshot visually inspected. Runner tests/physical-trial-scorecard-layout-browser.mjs; JSON/screenshots in test-results/physical-trial-print-20261110. This closes local responsive acceptance only; signed-in provider/full-reload/real device remain pending.

