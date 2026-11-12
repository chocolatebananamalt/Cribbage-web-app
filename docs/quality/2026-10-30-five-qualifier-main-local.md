# Five-qualifier Main, odd field and optional-Q accounting: local milestone

Date: 2026-10-30. Branch `codex/director-setup-journey`, unchanged HEAD `c8ad2b4a8f948d9398e8681e7f58215c032d7d5d`. Everything described here is unpublished local work. No hosted database, production, credential, payment or refund action occurred.

## Source-supported outcome

[Independent source review](2026-10-29-five-qualifier-bye-source-review.md) records the actual 2025 eight-slot chart and 2019 Director Manual section 12.B. Seventeen entrants produce five qualifiers, with first-round byes for seeds 1/2/3. Four played series determine bands 1, 2, 3–4 and 5. Bye credits are separate from played wins; playoff MRP is 70/42/21/21/7. Shared bands and equal semifinal prizes are the app's disclosed representation and director-selected policy, not a literal chart label or mandatory ACC percentage formula.

The supported odd-field solution has twelve distinct sit-outs and six real makeup matches, pairing sit-out order 1/12 through 6/7. The new scheduling batch 13 is not a thirteenth qualifying result. Immutable per-side mappings retain each player's original blank card line. The narrow zero-anchor application slice verifies that each identity moves physical seats; it is not presented as a universal ACC rotation algorithm. Unsupported rotations remain blocked.

## Implemented boundaries

- 0251: private immutable v4 playoff evidence, strict four-series advancement, three server-derived bye credits, source-bound MRP, reviewed corrections, full-request reconciliation and current-role checks.
- 0252: private immutable makeup mapping and supported publisher/read/reconciliation/context operations; narrow start validation and optional assigned-game/my-games/player-card projections preserve ordinary legacy game 13 in longer events.
- 0253: explicit five-person prize rule with bands 1/2/3–4/5, positive director-entered fifth weight, equal semifinal awards, champion-only cent remainder; validated five-qualifier Q processing and canonical v6 integration. Existing chart/equal policies are preserved. Member summaries expose only current reviewed awards and explicit unpaid status.
- 0254: a separate no-Q unpaid v7 domain. No Q review or membership is fabricated. Source, ledger, regular schedule, expense classification, assessment and 85% review are bound server-side. Tournament-wide domain guards prevent competing accounting streams from consuming the same receipts. Historical accepted replay and legacy records are preserved.

No table is directly writable by human roles or service_role. New RPCs are service-only; current tournament roles are checked on the server. Existing human audiences are not expanded. Member summaries retain the existing membership check and exclude private source/funding/expense manifests.

## Executed verification

`pnpm verify` completed with **1,038/1,038 application tests**, fresh audit with no known vulnerabilities, provider preflight, production build/TypeScript, and **8/8 workspace checks** including the available private handoff check. Lint has zero errors and only the two pre-existing warnings in event-control/shared-device-sign-out. Log: `test-results/five-main-full-verify-run4.log`.

Real PostgreSQL run 10 completed all three separate 17-player cases and legacy regressions. Each new fixture has 102 verified matches, 204 independent synthetic submissions and 204 own confirmations. Counts are actual supported RPC outcomes, not inserted finalized score snapshots. Identity/setup/roster/seating foundations are explicitly direct synthetic baselines; this is not a fresh real-account registration/login or physical two-person rehearsal.

1. Named Q pools: base receipts $510 plus $35 Q income, total $545. Expenses $51 sanctioning/$102 meals/$51 hall/$25.50 cards, total $229.50. Regular awards $280.50; Q awards $25 and unpaid refund obligation $10. Base-only participant return is $433.50, exactly 85%.
2. Genuine no-Q tournament: $510 receipts, zero Q versions/memberships/allocations/reviews. The same regular accounting finalizes once as unpaid.
3. Genuine no-Q seed tie: two cards retain 24 points/12 wins/+120/net120. A recorded synthetic separate-game winner changes ranking only. There are still 102 qualifying matches. The resolved five-person bracket, bye MRP and no-Q unpaid finalization succeed without changing original qualifying scores or raw numeric ranks.

All three use explicit fictional test weights 4:3:2:2:1, producing total regular awards **$93.51/$70.12/$46.75/$46.75/$23.37**. They are not an ACC-mandated formula. The first fixture's canonical total MRPs are **125/97/66/26/12**.

Observed overlapping requests prove one accepted playoff correction versus one stale writer, one no-Q draft versus one stale writer, and one unpaid final versus one controlled duplicate. Exact replay, full-body conflict, different-key duplicates, revoked roles, wrong JWT contexts, cross-event access, immutable history, stale-source summaries and strict numeric final versions are exercised. Four-person legacy Q review/accounting regressions and all 320 existing chart cells also pass; both new qualification/final histories remain byte-identical through those regressions.

Run 11 additionally invokes the actual authenticated player-card reader for all 17 identities before and after scoring: each receives exactly original lines 1–12, with the correct pending/verified states and independently computed totals. No phantom card game 13 appears. Logs: `test-results/five-main-sql-run10.log`, `test-results/five-main-sql-card-readers-run11.log`; contracts are retained in the separate Q/no-Q/tied result JSON files.

Browser acceptance uses actual components in isolated fictional contexts at 390/1440: v4 playoff 9 groups; makeup/digital/paper/hybrid 8 groups; no-Q accounting 8 groups; existing prize recovery plus explicit five-weight dollar previews. The additional real-SQL response → strict DTO → React smoke verifies the exact $510/$229.50/$280.50/$433.50 boundary and all five awards with two GET refreshes and zero mutation requests. It uses intercepted local transport, not live authenticated database transport. Frozen rendered workspace SHA256: `ee90ed8f8cabc8ea8e39bf1281ad7366c5c5986c17eba9b076581ae8d2d309e7`.

All temporary browser servers and the exact task-created PostgreSQL containers/databases were removed; absence/listener checks are recorded. Container isolation: reviewed image `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`, network none, no ports/mounts/binds, nonroot postgres, dropped capabilities, no-new-privileges, Unix socket only. No unrelated workloads or Docker backup were removed.

Fresh independent security/source/code reviews found no confirmed P1/P2. The low-priority final-version JSON typing finding was repaired and tested. A static legacy heading assertion caught a real ordinary-heading regression; ordinary `Game {roundNumber}` was restored rather than weakening the test.

## Exact unapplied migration inventory

| File | Bytes | SHA256 |
| --- | ---: | --- |
| 0247_qualification_tie_resolution_v1.sql | 33,954 | 2AEF8ECFF490FCCE780493C9C2E8B378AE870246F0EE90A7E36BC71A25013303 |
| 0248_q_obligation_review_v2.sql | 136,154 | 726FC5E4C09584E2669B095B148906B658DB39DA518D41333012B8B01B593497 |
| 0249_q_accounting_v6.sql | 35,899 | E5B175E08534BF0C26637F8FE8DBE2B96F420E86977AD3F8D8127EE33C470DBA |
| 0250_qualification_playoff_source_bridge_v1.sql | 6,066 | C5B8A3893B9E5ACD312F2EC26A9ACB4A23066FF1ED2316B117495F668DF8AF0C |
| 0251_five_qualifier_playoff_v4.sql | 26,631 | 808CBCACAF08D6CD734292BE34D11A31042C88D9C4771DC105F40DACD07E96B4 |
| 0252_odd_field_qualifying_makeup_v1.sql | 27,196 | 02727B21A217428823CE1AB7675BDDABCBFB27053620A319CF6951B263175C01 |
| 0253_five_qualifier_prize_accounting_v1.sql | 21,483 | 2663D4919F0DD60FB908C5203EBB403A672C86A5F13E7895CEA25F9B7443029C |
| 0254_no_q_accounting_v7.sql | 31,795 | 33B50E4FFC3188A20CA42A3FE8A9EA8554EF4A9F0CAD38CE607F74890A42A20E |

## Failures corrected and verification limits

Earlier local runs exposed fixture projection updates blocked by immutability, malformed synthetic SQL spacing, a wrong test column name, the still-active legacy bye blocker in v2 Q processing, and duplicate test binding UUIDs across separate fixtures. These were corrected without disabling guards. Final runs use the hashes above. The first full-verification bootstrap failed fetching the pinned package manager from the official registry; a supported scoped retry succeeded. A read-only CIM diagnostic was denied and not bypassed; subsequent normal command completion resolved the process uncertainty without that inspection.

The approved ACC-weighted largest-remainder calculator is separately verified as a standalone module: 8 groups, 320 research goldens and 1,536 supported combinations, independent review, included in the 1,038-test run. It is not yet connected to policy publication/review/accounting. Existing policies and historical liabilities remain unchanged.

This milestone is not production readiness. Larger qualifier counts, other formats/game-count combinations, unresolved Q cash ties, actual disbursement/paid-state, physical multi-device/offline rehearsal, backup/restore and exact hosted rollout/acceptance remain tracked gates. Source snapshot updates protect code only, not hosted database/Auth/Storage state. The current backup identity/version/hash lives in the external verified snapshot receipt to avoid a circular archive hash in included source.
