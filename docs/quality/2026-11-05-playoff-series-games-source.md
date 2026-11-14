# Playoff game persistence and advancement: local source checkpoint

No SQL execution, database fixture, hosted access, publication, credential/role change, invitation or money movement occurred. Previous archives are preserved. The operational activation predicate is now literal false and is checked before new attempts or native activation calls; historical exact receipts remain readable. This source work does not enable the app.

## Implemented source

`playoff-series-matches-v1.sql` proposes immutable match identities, generations and completed series. The authoritative source derives the verified four/five-qualifier seed paths, current native playoff start, event settings, players and format. Five-qualifier byes do not create game wins. The next match source consumes current parent completions only after the private evidence validator reconstructs their actual games. Parent results, qualification, settings, native roster links and scorecard preferences are pinned. Two distinct linked digital player profiles are required.

Director/co generation creation uses exact operation replay and optimistic generation/source checks. It cannot silently replace pending/completed work or start a replacement qualification bracket over existing accepted work. Old rows are retained. Correcting such a bracket requires a separate reviewed recovery protocol, not a redraw or history reset.

`playoff-series-games-v1.sql` proposes private immutable operation/outcome, conflict, accepted-action, game, submission, confirmation and verified-game tables. An authenticated player may submit or amend only their own winner choice and confirm only their latest own submission. An amendment requires an explicit latest-own submission pin and invalidates that player's old confirmation. Two matching submissions plus two identity-bound own confirmations produce one verified game. Mismatches cannot advance. Game-version CAS, sequential game numbers and immutable verification prevent extra or post-terminal games.

The completed-series validator reconstructs actual action/submission/confirmation evidence, contiguous games, wins, final completing actor/operation and the game digest. It rejects a prefix that was already complete before a later game. First-to-wins results feed the new next-match source, using the regular format for semifinals and the selected final format for finals. These records never write qualifying `canonical_games` or `card_scorelines`, qualifying game points, spread points, MRPs or payouts.

`series-game-protocol-v1.ts` provides a pure independently exercised protocol model. It grants no database authority. The SQL's 17-field wire command uses immutable submission/confirmation row IDs; the pure model uses operation IDs. A trusted scoped adapter must resolve that mapping. Renaming or casting IDs is not normalization, and SQL/TypeScript parity has not been executed.

## Bounds and compatibility

The initial path supports linked digital/digital players and the verified native four/five-qualifier bracket only. Paper, synthetic entries, forfeits, automatic bracket replacement and other field sizes remain unsupported here. Existing legacy history is not reconstructed into game evidence. The legacy aggregate result APIs stay blocked for newly configured events; they are not proof of first-to-wins play.

There is a technical processing bound of 10,000 accepted actions per generation. A selected full best-of format must fit at least four actions per game within that bound (`maximumGames × 4 ≤ 10,000`); larger choices are rejected, never silently shortened. New actions cannot append an unreadable 10,001st record, while exact replay at the bound remains allowed. These are implementation bounds, not ACC rules.

Private generation and game reconciliation return full immutable historical request/outcome evidence and deny current-source inference. Current match/game status must be refreshed separately: a player's earlier receipt may correctly predate the opponent's later confirmation. Activation and all new routes/grants remain disabled.

## Independent review

Review closed nested-parent contention becoming a terminal rejection, an invalid redundant FK, empty games committed by rejected requests, an incorrect kill-switch reference/order, unauthorized journal writes, missing qualification/slot replay context, foreign-route conflict writes and action-boundary issues. The frozen game SQL was source-reviewed with no remaining P1/P2. Source contracts do not establish executable PostgreSQL constraints, triggers or races.

Final evidence logs: `test-results/playoff-series-final-verify.log` and `playoff-series-handoff.log`.

## Remaining verification and integration

Pending separately authorized isolated database testing: complete dependency installation/parse checks, actual-role denial, two-session submissions/confirmations, races and exact retry, lost responses, mismatches/amendments, stale parents/generations, first-to-wins boundaries, rollback of rejected first entries, completion-trigger proof, next-match derivation and cleanup. No database test was attempted. A standalone PostgreSQL parser is also unavailable in this environment; no parser proof is claimed.

The live authenticated transport, current game workspace, offline queue/reconnect handling and UI are not wired. New series results are not yet connected to the old public bracket/result projections, linked Consolation eligibility or finance/MRP finalization. Automatic next-match publication and reviewed correction/amendment recovery remain integration work. The existing 15-path finance backstop still blocks unsupported authoritative accounting. This checkpoint is not evidence that the 18-player mixed mock or real-money tournament is ready.

## Completed local gate

Passed 1632 application tests, six provider checks, dependency audit, ESLint, production build and eight workspace checks. Six handoff tests passed. Independent source reviews closed the match retry and game-write findings; no remaining P1/P2 was reported. These are source/model checks, not database runtime acceptance.
