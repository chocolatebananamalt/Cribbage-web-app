# Player-facing playoff display — local non-fixture checkpoint

Acceptance: names plus fixed Tournament IDs, simple round sections and next-opponent lookup; no ACC number or table/seat assignments. Use literal verified ACC charts only; highest-seed first-round byes distinct from actual results, unresolved feeds never advance. Block missing/unreviewed/tied/stale sources and invalid descendant results. Public allowlist excludes official notes, contact/payment/MRP data. No public-access change, database fixture or official result creation.

## Scope and rule evidence
Primary source: https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf, 2025 Rule13.2 printed51–52, charts printed56–57. Official PDF downloaded locally and printed57 rendered/viewed. Independent reviewer visually transcribed literal4/8/16/32/64 slot orders. Multi-column64 chart is appended column-by-column vertically; text extraction order alone is unsafe. Topseed byes are next power-of-two minus reviewed qualifiercount. One-in-four rounded up must match explicit reviewed qualifiercount; missing exported players cannot become byes.

This bounded display implements4–64qualifiers only, consistent with ordinary verified chart sizes. One/two/three qualifier display remains an implementation limitation, not a claim ACC forbids it; charts begin at12 originalentrants and threequalifier handling can be verified separately. Above64placement is unverified and blocked, including100+qualifiers from400–500entrants. Main/regularConsolation only; ConsyLite random grouping is separate and blocked. No match length, MRP, payout, forfeit, tie ranking or eligibility policy is invented or changed.

## Implemented core
Strict public DTO pins tournament/event, explicit qualifiercount, qualification version/digest, current/reviewed/tiesresolved flags, stable participant IDs, names, fixed TournamentIDs and unique seeds. Raw Director workspaces/private extra fields are rejected. Results bind exact match/ordered sideA/B, bracket version, qualification version/digest and both parent resultID:revision (or qualification-bound bye tokens). Duplicate/unresolved/stale/path-invalid results block the complete projection. Byes have no result receipt or played-win record. Names are never lookup keys. Resultprovenance is caller-projected metadata, not proof of authority; output always says officialAuthorityEstablished:false. A trusted live adapter/access boundary is NOT implemented by accepting this DTO.

Standalone puretests cover literal chart sentinels, all61supportedfield sizes, highestseed byes, pending-versusbye distinction, duplicate names/IDs, strictprivacyallowlist, q-1syntheticplayedresults through champions, missing sourceplayers, unsupportedfield/types and correctedparent revision invalidating descendants. Pure calculation examples only; no database fixture.

## Verification status
Core focused tests passed6groups. Final UI/browser/full verification and review remain in progress; do not claim complete/published until appended evidence.

## UI and final executed verification
Added a dedicated default-off local preview route/component/scoped CSS, not a production player/public-data route. It requires explicit CRIBBAGE_LOCAL_PLAYOFF_PREVIEW=1, development/test environment, absent/development Vercel environment and loopback host. It generates only clearly labeled fictional5/33/64-qualifier examples, one explicitly synthetic result and a blocked125-qualifier case. No fetch, API, auth, storage or record action exists. Match sections preserve order in groups of four; forward-path text and Show this match round/focus navigation preserve competitive edges. Full names and TournamentIDs remain visible; duplicate names distinguishable by ID. No table/seat assignments, membership numbers, score entry or role actions.

Browser receipt passed4groups at320/390/768/1440, including doubled computed text, fixedID search, duplicate names, wait versus known opponent,31topseedbyes in33field,64chart/championship,125blocked, matchfocus/roundnavigation, no pagehorizontaloverflow and zeroAPI/external/storage. First browser attempt failed on an overly exact select-label locator; changed to accessible combobox prefix. Final harness has no extra outermain wrapper; finalregionalcaptures improve visualQA, not productbehavior. Port3339 absent after cleanup. Final receipts/logs are test-results/player-playoff-browser/result.json and player-playoff-browser-final3.log.

Root visually inspected390normalfullpage,390doubledtextnextpanel,320doubledtextlongnamematch and1440normalmatch. Large type wraps; very long words may break at320px/200% instead of clipping or shrinking. This is not accessibility certification or older-person usability acceptance.

Final pnpm verify and pnpm verify:handoff exited0 (session10012):1,350application tests,6provider,8workspace,6handoff plusbuild/lint/audit. Logs player-playoff-verify-final.log/player-playoff-handoff-final.log. Independent source review cleared pureprojector and independently6/6tests; UI final verdict recorded separately below when received.

## Remaining integration and decisions
No trusted live qualifying/results-to-publicDTO adapter, publication/access policy, real-user/provider/browser-to-database path or human play was tested/implemented. Input current/review/provenance metadata is not proof of official authority. Actual results must come from reviewed source; no synthetic outcomes may be relabeled as real play. Existing native playoff writers still have their original bounded support; display chart capability does not extend scoring/recording/MRP/payout backends.

Fields above64need a verified authoritative placement source before generating competitive paths. Multiple screen sections are display only, not independent competitions. One-to-three qualifier display, ConsyLite grouping and any match-length/forfeit/MRP/financial policy remain outside this slice. Qualification ranking/ties are supplied reviewed inputs; the accepted head-to-head/deciding-game/deal-cut workflow is unchanged. No new owner decision is required merely to retain this local preview.

No database fixture, hosted record, migration execution, publication, invitation, money or denied-operation retry. Prior checkpoints remain separate.

Final independent UI/page/CSS/receipt review CLEAR: no remaining P1/P2. Pure projector independently6/6tests passed. Final regional screenshots and source remain frozen; final browser session33544 exited0. This closes the LOCAL display checkpoint only.
