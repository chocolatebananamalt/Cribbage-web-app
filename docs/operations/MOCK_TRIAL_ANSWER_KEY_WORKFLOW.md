# Independent18-player mock answer key and fictional paper packet

Local preparation only. No app imports, database connection, tournament creation, network, invitation, score submission, verification or payment is performed by these tools. Do not use a calculation sample as the eventual event draw. All fees and awards in this mock are simulated.

## Prepare input after the actual draw
Run `node scripts/mock-trial-oracle.mjs --template NEW_INPUT.json`. The template has `draw:null`, no roster/games/results, and a NONSECRET simulation-seed placeholder. It intentionally cannot produce an answer key until the actual draw is supplied. Use a nonsecret stable simulation seed, never a password, token or seating-randomness credential.

Required input version is `mock-trial-oracle-input-v1`. Supply:
-`draw.anchor:{participantId,seatId}` with the approved stationary Seat1 identity.
-`draw.roster`:18stable `{participantId,tournamentId,displayName,mode,fictional}` entries. Exactly6Digital with`fictional:false` and12Paper with`fictional:true`. Names are labels, not identity keys. Preserve the eventual draw's fixed starting Tournament IDs.
-`draw.games`:108actual scheduled `{gameId,round,sides:[{participantId,currentSeat},{participantId,currentSeat}]}` entries. Round1through12,9matches per round. The standalone validator checks complete occupancy, opposed odd/even pairs, unique opponents,12games per identity, firstseat=fixedID and independently transcribed one-table/Seat1-anchor movement. It does not generate seating or establish randomness.
-`digitalResults`:only supplied DD `{gameId,winnerId,spreadPoints}` results. Spread points are a positive integer1through121; winner must be one of that game's two participants. Missing results stay pending. A supplied result does not prove physical play or two app confirmations.
-`funds`:optional proposed simulated contributions/expenses/awards; absent means not-configured, never zero-income accounting.
-`appExport`:optional trusted read-only export with exact `oracleVersion`, `drawHash`, `planHash`; `games[{gameId,winnerId,spreadPoints}]`; and `totals[{participantId,gamePoints,wins,plusPoints,minusPoints,netSpreadPoints,knownGames,pendingGames}]`. No export means not-compared. Source mismatch, duplicate/missing rows, incorrect net or completion counts cannot report matched. There is no automatic app export/import connector here.

## Generate and preserve a revision
Run `node scripts/mock-trial-oracle.mjs --input INPUT.json --output NEW_DIRECTORY`.
The directory must not exist. Outputs are answer-key.json, paper-cards.csv, validation.json and hashes.json. Existing output is refused rather than overwritten. Keep prior directories when adding/changing actualDD results. CSV text is formula-neutralized; JSON is the canonical independent report.

PP/PD scripts are HMAC-derived only from the normalized draw, version, nonsecret seed and gameID. They never select a DD winner. Normalized array ordering and display-name changes do not reroll the script. drawHash/planHash bind the immutable script; paper cardHash binds its rows/totals/identity. ActualDD, funding and export changes affect input/result fingerprints and known standings, not paper scripts or paper-card hashes. Changing the draw/seed requires a newly bound packet, not a quiet reroll.

Digital/Digital count is x from the eventual draw; PD=72-2x and PP=36+x. There are144paper rows and72digital own-entry sides, but the draw determines the actual pairing counts. Do not reuse a prior example's counts or force winners to produce a Q-Pool scenario. Missing DD results prevent final qualification. Numeric ties stay tied and carry evidence/review requirements; no name/ID/input order or cardcut selects a qualifier.

## Render a NEW PDF
With Python plus ReportLab and pypdf available:
`python scripts/render-mock-paper-packet.py --answer-key NEW_DIRECTORY/answer-key.json --output NEW_PACKET.pdf`

The renderer requires the oracle's sibling hashes.json, or an explicit `--expected-answer-key-sha256` from the verified source, BEFORE authoring. It also recomputes plan/card hashes and independently tallies paper game points and spread columns. This is local file-integrity checking, not an official signature, identity check or payout approval. The PDF shows its verified whole-file fingerprint. Existing PDF paths are refused.

`python scripts/render-mock-paper-packet.py --template --output NEW_BLANK_PACKET.pdf` renders the unbound15page template with12fictional cards, blank DD capture log and reconciliation checklist. It contains no assigned Tournament IDs, opponents or winners. The supplied final blank template is output/pdf/mock-paper-template-18-final.pdf. Actual bound packets may add pages for long DD game identifiers/fund reports; each fictional paper card must remain on its own identified page or rendering fails.

The separate `--calculation-sample` label is for layout QA only, never the actual mock. Printable aliases are bounded to64characters for layout, full labels stay in local JSON/CSV, and fixed TournamentID is the primary identity. All review initials remain blank. Body rows are14pt; plus/minus columns use positive spread magnitudes with leading zeros below10, and net spread is signed.

## Independent checks and limits
Game-point oracle:2per normal win,3per win by31or more spread points,0per loss; double/triple skunks add no extra game points. Per-card wins, plus/minus/net spread recomputed independently. All18cards together conserve spread and known-game points/wins; the paper subset alone need not net to zero.

Standings use descending game points, games won, net spread, positive spread. Applicable qualifying head-to-head is evidence for review; otherwise a deciding game/head-judge review remains. One in four rounded up gives5qualifiers for18, not a filled-up bracket. Neither a calculated order nor a supplied result records official cross-checking. MissingDD and relevant unresolved ties prevent final qualifier IDs.

Primary source: ACC Tournament Rules2025,1.6,12.1,13.2 and AppendixA item20, https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf . Single-table movement is an18seat extension of GRManual8.1Figures1–2, separately source-checked locally; actualroom layout/capacity/routes and general multi-anchor layouts are not certified.

Fund input:each fund has fundId,currency:'USD',incomes,expenses,awards,retainedMinor and method:'unspecified'|'equal'|'equal-cohorts'|'top-double'. Every line has uniqueid, matchingfundId and integer amountMinor. Simulated contributions identify a known contributorId; external inflow is explicitly labeled. Award recipients must be known and unique; equal-cohort records supplycohort, top-double supplies topRecipientId. The oracle independently checks each declared fund's arithmetic, $5award increments and declared equality/double-share assumptions. Even balanced reports remain policy-unresolved/not-approved and moneyMoved:false. It does not invent Main/Consolation/Satellite tiers, Side/Qdistribution, refunds, retained-balance policy, pool eligibility/backfill or real payments.

A controlled Q-Pool backfill result is not guaranteed when actualDD outcomes vary. Test any forced policy scenario separately and label it scripted; do not predetermine real winners. Existing unresolved Side95/55/20versus85/55/30 and equal-pool indivisibility decisions remain pending.

## Local verification commands
`node --test tests/mock-trial-oracle.test.mjs`
`python -m unittest tests/test_mock_packet_renderer.py -v`
Python tests need Node on PATH (or MOCK_ORACLE_NODE pointing to Node24). They use pure in-memory calculation inputs, not operational/database fixtures. A local Node/Python command-line rehearsal, output hash/overwrite checks, template/sample/all-pages rendering, maximal accepted alias and card-page/bounds checks are recorded in docs/quality/2026-11-04-mock-trial-packet-local.md.
