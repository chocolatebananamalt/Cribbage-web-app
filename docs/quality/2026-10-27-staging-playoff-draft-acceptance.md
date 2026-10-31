# Fictional playoff and zero-ledger draft acceptance — 2026-10-27

Specific user approval at 18:40 UTC covered three explicitly simulated series outcomes, a $0 settlement working draft and duplicate/stale-save protection. It excluded payment receipts, expenses, funding, payouts, finalization, production, migration/index/settings changes and publication.

Target: staging `nnhcnvksxgxnpvdqjgpg`; tournament `c59f74ae-1174-4e3a-b1d4-4d9d0ddebc2d`; event `4af492ef-18ea-48de-91eb-9e5fa07fbcca`; qualification `a42c0fe9-6968-4635-826c-1f65ae814736` version 1. Existing director session on exact-commit Preview `https://cribbage-web-gd2rl760r-cribbage-app.vercel.app`, published head `c3eeec1ab777a6ff6411d2ec240b227c13a98824`, retained without password access or account switching.

## Baseline and simulated bracket

Before writes: 96 qualifying games; zero playoff outcomes/drafts/finals/conflicts. Global operation receipts 411, audits 473, roster payment events 4, expense events 0. This fixture's receipt/expense ledger was empty. Game snapshot MD5 `3cc87f4c90e79c311bcddbac957f1006`; qualification-row snapshot MD5 `fb86272efddb8818ec9c599c517417e4`.

Supported form entered exactly: Paper02 defeats Paper03; Paper01 defeats Paper04; Paper02 defeats Paper01. Each persisted evidence note starts `TEST ONLY SIMULATED` and states it is not an actual played series. No game scores, 2–0 claim, invented third-place match or prize ordering. One supported save created outcome `25a700a4-5ebc-49bf-82d4-868ea39bd2d7`, version 1, director `de0f27a1-60d0-4449-af83-fdf360a9bc08`, receipt `39fd43c2-3887-4393-bf28-8db157abff66`, operation `829c0b69-04a0-4cab-845c-fd63d2f2f4dd`.

UI and actual stored outcomes agree:

| Qualifier | Played series wins | Byes | Finishing band | Qualifying MRP | Playoff MRP | Total |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Paper02 | 2 | 0 | 1 | 55 | 42 | 97 |
| Paper01 | 1 | 0 | 2 | 55 | 21 | 76 |
| Paper04 | 0 | 0 | 3–4 | 5 | 7 | 12 |
| Paper03 | 0 | 0 | 3–4 | 5 | 7 | 12 |

These are persistent canonical synthetic outcomes in staging, not proof of played playoffs or ACC submission. Sources remain ACC 2025 bracket and published MRP schedule effective 2016-08-01.

## Two-tab draft protection

Two existing-auth director tabs 336434193/336434194 preloaded draft version 0 after the bracket save. Both had identical explicit reference:

> TEST ONLY zero-ledger working draft from simulated playoff v1. The $48 assessment remains unfunded; no money paid, expense bound, prize claims or final settlement.

Both forms had income allocation 0, expense allocation 0, retained balance 0 cents, empty prizeClaims and null sanctioningExpenseEventId. Their source was the exact new outcome and locked qualification above. No fees, membership, funding or prize-order inference.

Dispatched first-tab double-click and second-tab save using supported browser controls. Both showed busy UI. Server request overlap was not instrumented, so this is **two-tab stale-write/double-submit protection**, not a proven database concurrency race.

Exactly one draft saved: `5d6ce3e0-a156-48c9-a825-e9b478e2f047`, version 1, expectedVersion 0, receipt `f2f2e4d7-b022-46aa-ab34-3c1818167bad`, operation `b766d378-3bea-440c-9d0b-a2aefa20c65e`. Other operation `6b5d9583-a5f9-4f7b-88cd-41f41d0ffdd4`, receipt `daf14f65-70e9-485d-a8d3-bf1268616107`, is controlled `stale_version` rejection. Both draft attempts have identical request hash `97b9ab5ba6e6715fed9c9ef102f8a6fa0d1aeee503e6df4223f37a5155ad62e6`. No third operation receipt from the double-click and no second draft. No same-key/different-body conflict was attempted, so zero conflict rows is expected.

Both tabs automatically reconciled to draft 1. Explicit refresh then showed identical canonical evidence, zero ledger snapshot and the saved reference; empty retry/unsent queues. The adopted legacy settlement URL redirects to v5. The extra test tab was closed only after these checks; primary director tab remains open. No uncertain save remained, so no retry, forced response loss or unsupported replay route was used.

## Final accounting and preservation checks

Final global counts: operation receipts **414**, audits **476**, payment events **4**, expenses **0**. Delta is +1 outcome version, +1 working draft, +3 operation receipts and +3 audits. Each of the three operation receipts links to exactly one audit event. Finalizations and conflicts remain **0**. Operation receipts are not payment receipts.

All 96 qualifying-game rows and qualification rows retain exactly the baseline snapshot hashes above. No qualification version/result replacement or extra qualifying score was created. Refresh/read checks added no further operation receipts or audits.

Assessment remains **4,800 cents unfunded**, current and saved fixture ledger both $0 receipts/$0 expenses, no expense binding. All six finalization attestations remained unchecked; final action disabled. No finalization POST/server rejection was exercised. This is a working-copy test, not balanced full settlement or evidence of payment. Positive funded settlement, sponsor/funding representation and Q Pool accounting remain separate tasks.

Independent evidence review found no P1/P2 issue and confirmed these counting/coverage limits. No application code changed, so no new full-suite pass is claimed here; exact-commit CI and prior local aggregate/SQL/browser evidence remain separate. No additional migration, index, security configuration, publication, payment, expense, funding, payout, finalization or production write occurred. The new outcome/draft/operation-receipt/audit writes above were specifically authorized.

Remaining gates: hosted exact replay/response-loss, actual server-overlap/multi-user races, legacy writer compatibility, positive financial finalization, Q Pool membership/distribution policy, typed byes, OCR/photo evidence, physical multi-device/offline, SMTP, staging password remediation and pre-production index/load review. Reports/status remain local-only follow-up.
