> **Current checkpoint, 2026-10-31:** The replacement $5-policy hosted acceptance is complete on test commit `223ec1583f18979fc666cd6a26f03e9428705342`, not production. Both fresh 17-player fixtures have 102 verified games, finalized qualification, four simulated playoff series with three byes, completed cross-checking and one current unpaid accounting final. All 34 original player totals and all 223 older table fingerprints are preserved. Source evidence: `2026-10-31-explicit-fee-hosted-rollout.md`. Older cent-valued and failed-setup examples below are historical and do not define current policy.

## Current verified monetary acceptance

| Source | No-Q replacement | Q + Side replacement |
| --- | --- | --- |
| Base receipts | $510 | $510 |
| Separate graduated Q receipts/obligations | none | $170 / $85 + $55 + $30 |
| Separate graduated Side receipts/obligations | none | $170 / $85 + $55 + $30 |
| Regular unpaid awards to players 02, 01, 03, 04, 05 | $95, $70, $45, $45, $25 | $95, $70, $45, $45, $25 |
| Expenses | $229.50 | $229.50 |
| Restricted rounding hold, excluded from return | $0.50 | $0.50 |
| Total conserved | $510 | $850 |

Each regular budget rounds from $280.50 down to $280 because $280 awards plus $160 eligible benefits exceeds the $433.50 minimum return. The benefits are $51 sanctioning plus $109 meals, already within expenses. Same-round semifinal losers receive equal $45 awards. Q and Side each pay all $170 as unpaid obligations to 02/01/03; no refunds or actual disbursements occurred. Side recipients derive all paid qualifying cards, not playoff finish. This fixture's top three happened also to qualify; separate earlier tests cover graduated nonqualifier rank-down.

### Remaining release gates

- **Implementation:** the shared generic accounting link selects V8 for a Side event. V8 correctly blocks it; the supported current Side-review link selects V9 and the combined final passed. Repair and verify that navigation locally, then separately approve its test-preview publication.
- **Policy/scope:** unresolved Q-only cash ties and unsupported multiway qualification remain blocked. Define supported launch formats explicitly rather than imply all formats are accepted.
- **Physical verification:** synthetic records do not establish real paper/camera, two-human, physical venue outage or old-device rehearsal.
- **Recovery/operations:** source snapshots and synthetic restore tests do not establish hosted Database/Auth/Storage disaster recovery. Approved production backup/restore, monitoring, rollback and final exact-release preflight remain required.
- **External approval:** no production launch, production migration, actual payment or paid-state authorization has been given by this test acceptance.

## Historical checkpoints and evidence

> Current checkpoint: test commit b0005ad6c065640961b01efb3ef3497c5de075f7 deployed; current $5 hosted acceptance remains incomplete. Two fresh17-player fixtures and pending B invitations exist; no financial/scoring records in them yet. Prior cent-based acceptance below is historical only. Whole$5 standing policy is approved, including automatic regular floor/ceil and honest funding requirement. Source backup v13 predates this morning checklist; see2026-10-30-morning-readiness-checkpoint.md for actual pending gates.

> Payout-policy hold, 2026-10-30 06:24 UTC: the owner requires whole-dollar prizes, preferably $5, and the shared balanced $5 formula for graduated Q/Side Pools without per-event remainder-placement questions. Historical cent-based regular/equal calculations below prove bookkeeping only, not current product policy. Graduated rank-down remains correct; the separate equal-pool refund edge case is not a graduated refund. Preserve historical records. See docs/reference/payout-policy-clarification-2026-10-30.md for the automatic-policy proposal and unresolved real-funding residue decision. No app/hosted change is authorized here.
# Remaining production gates after hosted acceptance — 2026-10-30

This is a local planning checklist, not production approval. Current tested Preview commit: `72c1c6571e33a53e7a204927e02e9a4dae22f3f9`. No new hosted operation was performed for this checklist. Older September target dates and preflight migration numbers in the pilot checklist are historical; use the eventual approved release candidate and its reviewed schema manifest.

## Verified payout breakdown

Both 17-player events have the same five regular total awards, funded only from their $510 base entries:

| Finishing place / band | No-Q recipient | Balanced-Q recipient | Total regular award |
| --- | --- | --- | --- |
| 1 | NoQ02 | Balanced02 | $93.51 |
| 2 | NoQ01 | Balanced01 | $70.12 |
| 3–4 | NoQ03 | Balanced03 | $46.75 |
| 3–4 | NoQ04 | Balanced04 | $46.75 |
| 5 | NoQ05 | Balanced05 | $23.37 |
| Total | | | $280.50 |

Each semifinal loser receives $46.75. These are total awards, not additions to an earlier qualifying guarantee. Four expenses total $229.50, so $510 = $229.50 + $280.50. Meals and synthetic sanctioning benefits total $153; $153 + $280.50 = $433.50, exactly 85% of gross base entries. Operating costs $76.50 are excluded from participant return.

The Balanced-Q fixture has **two separate named pools**, not one 17-person pool:

- **Q Pool 1 — Graduated, 1 in 6:** Balanced01–Balanced16 each contributed $10. There are 16 paid entrants, a $160 pot and ceil(16/6) = 3 recipients. The disclosed ACC-weighted/application-balanced method gives Balanced02 **$80**, Balanced01 **$55**, Balanced03 **$25**. Graduated recipient selection ranks paid pool entrants, including paid nonqualifiers below the playoff cutoff if needed. This pool has no refund obligation; its entire $160 is owed as awards.
- **Q Pool 2 — Equal, paid playoff qualifiers only:** only Balanced17 contributed $10. Balanced17 did not qualify, so this pool has zero eligible recipients. Its separately disclosed equal-pool zero-qualifier convention creates a **$10 unpaid contributor refund obligation** to Balanced17. This is not a graduated-pool refund or failure to rank down.

Thus 17 players contributed $170 across separate pools: **$160 graduated award obligations + $10 equal-pool refund owed = $170**. Combined receipts are $680 = $229.50 expenses + $280.50 regular awards + $160 Q awards + $10 Q refund obligation. The no-Q event has no Q memberships, allocations or reviews. All liabilities and both final accounting records remain **unpaid**. No transfer or refund was executed.

Evidence: [terminal acceptance](2026-10-30-hosted17-terminal-acceptance.md), local generated `test-results/hosted17-terminal-accounting.json`, `hosted17-terminal-supporting-evidence.json`, `hosted17-terminal-dom-observations.json`, `hosted17-final-canonical-scorelines.json`. Independent review compared all 204 canonical games to exact prepared pair/round/winner/margin records and found no unsupported material acceptance claim. Both events have one current unpaid final; all 9,863 older rows across 199 tables remain unchanged.

## Prioritized release checklist

| Priority | Gate / present evidence | Concrete acceptance still required |
| --- | --- | --- |
| P0 — protect data | Source snapshot version 8 is verified; GitHub protects published source. Docker disk backup is local on the same computer. September schema parity demonstrated structure only, not current data/Auth/Storage recovery. | Approve the exact protected backup destination, retention and isolated restore scope before any export. Restore current Database rows/schema, required Auth relationships and Storage evidence into an isolated environment; compare counts/content hashes and test access/ownership plus representative recovered scores and accounting. Record recovery point/time and a repeatable restore procedure. No source archive substitutes for this. |
| P0 — physical independent-user recovery | Current synthetic hosted tests prove integrated Paper scoring, qualification/tie, byes/MRP and unpaid accounting. Local production-built digital/manual/photo recovery suites exist. | Run the applicable [pilot rehearsal](../operations/OCTOBER_PILOT_REHEARSAL.md) with distinct humans/accounts/devices: digital reciprocal entry plus confirmations, paper/hybrid comparison, mismatch/correction, single-device and whole-venue outage, reload/reconnect exactly once, revoked queued write and failed-device reconstruction. Verify no lost/duplicate score and no premature verification. Use fictional data and real device/network actions; do not label automation as two humans. |
| P0 — explicit supported launch scope | This exact hosted run accepts Standard Singles Main, 12 qualifying games and the 17-player five-qualifier/three-bye path, optional Q and unpaid accounting. Earlier four-qualifier local/historical evidence is separate. | Owner must select the initial supported formats and financial endpoint. For every included doubles, consolation, satellite, Side Pool or larger bracket path, obtain current-version end-to-end role/scoring/report/accounting evidence. Otherwise clearly block/exclude it from the initial release; do not inherit old broad support claims. Decide whether unpaid accounting is the launch endpoint or a separately reviewed paid-state/cash-disbursement recording workflow is required. No automatic payments follow from unpaid finalization. |
| P0 — unresolved tie policies | Two-person qualification H2H/separate one-game playoff is implemented and tested; the hosted seed tiebreak preserved scores. | Resolve the separate Q-only monetary tie policy with source/director approval or retain explicit blocking. Multiway/cyclic/ambiguous qualification ties must remain blocked unless separately supported. Never substitute UUID/random order or qualification tiebreaks for Q money policy. |
| P1 — final candidate security and operations | Current Preview CI/READY deployment, staging schema checks, private service RPC boundaries and preservation checks passed. These are not production rollout approval. | On the final approved candidate, rerun affected full verification, independent security review and phone/desktop smoke; verify production schema/app compatibility, monitoring/error visibility, operational owner, stop thresholds and a history-preserving rollback/forward-repair plan. Demonstrate rollback against the changed release in an approved test environment. Obtain explicit production migration/deployment approval only after these gates. |
| P1 — account delivery and capacity | Shared test accounts and manual sign-ins worked. That does not establish production invitation throughput or callback delivery. | If bulk invitations are in launch scope, verify intended email provider/callback, expiry/replay, rate limits, retries and the documented target of 600 invitations in 45 minutes without sending to real entrants during rehearsal. No provider/security/billing changes are authorized by this checklist. |
| P1 — official outputs and operating acceptance | Current accounting calculates source-versioned MRPs and preserves actual qualifying totals; this test submitted nothing to ACC. | Director-review final results, member/printable summaries and required export fields on the chosen release scope. Confirm current-effective ACC operational acceptance where the app is intended to replace an official record. Do not claim ACC sanctioning or automated submission approval from synthetic tests. |
| P2 — optional OCR | Photo upload/review recovery tests exist; automated OCR is deferred/default-off. | Keep OCR as draft assistance until separate privacy/provider and accuracy review plus human verification evidence. It is not a blocker for a release that explicitly excludes automated OCR. |

Recommended next coordinated action: agree the initial release scope and approve a protected staging backup/isolated content-restore rehearsal, while scheduling the physical multi-user/offline rehearsal. Local planning can proceed; exports, new environments/settings, real communications, paid-state design and production rollout require their specific decisions/authorization. The laptop is free; this checklist used no browser control.


## Superseding local checkpoint: Side/combined accounting
The owner settled Side recipient basis: all fully paid scorecards in that named pool, whether or not playoff-qualified. This is implemented and verified locally through new264/265 unpaid accounting, Side-only and Q+Side, with whole-$5 awards and separate exact refund/cost bookkeeping. 1,113 application tests plus full build/audit/workspace passed and independent final review has no confirmed P1/P2. This does not replace exact-release hosted acceptance: no new publication/migration occurred, and hosted no-Q scoring stays15/102 because a synthetic paper-original attestation was rejected. Prior cent-valued historical results remain immutable old-policy evidence. Production project was separately resumed and health-check1 confirmed; no application/schema production rollout. See side-pool-local-rollout report for exact proposal and remaining gates.

Local navigation checkpoint (2026-10-31): selector and settlement-wrapper repair prepared but unpublished; canonical V9 Side history is used, historical routes preserved. Focused tests/review passed. Phone/desktop local navigation attempt stopped by ERR_NETWORK_ACCESS_DENIED and remains unverified; do not treat this as rollout-ready. See 2026-10-31-accounting-navigation-repair.md for current evidence and release gates.

2026-10-31 audit recovery: fresh pnpm production audit succeeded, no known vulnerabilities. Local phone/desktop navigation remains blocked by first-page ERR_NETWORK_ACCESS_DENIED, not a returned approval-review rejection. No Chrome enterprise network policy keys or relevant environment overrides found; underlying sandbox/firewall cause unproven. Need scoped per-command escalation approval for the task-owned headless localhost rehearsal, no security changes. See navigation-repair report.

Navigation local gate completed2026-10-31: supported per-command escalation admitted;14phone/desktopnavigationchecks passed and task-owned browser/server closed. Together with1,145tests/build/types/lint/providers/14workspace-handoff/freshaudit/independentreview, the narrow repair is ready for separately approved test-preview publication. No production readiness claim; external physical/recovery/policy/launch gates above remain.
