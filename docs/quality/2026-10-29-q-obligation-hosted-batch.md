> **Policy re-review hold — 2026-10-29:** Recipient selection restricted to paid playoff qualifiers and the no-eligible refund assumption are disputed pending original ACC formula/example verification. This document records earlier implementation/test evidence, not proof of ACC policy correctness. Preserve all unpaid history; do not execute payouts/refunds or continue settlement integration. See `2026-10-29-q-recipient-policy-dispute-hold.md`.
# Hosted unpaid Q batch acceptance — 2026-10-29

Terminal passed outcome for the one explicitly approved fictional batch. No actual money, paid flag, executed refund, source correction, second review or final settlement. No production, migration, publication, role, credential or Gmail action.

## Scope and exact operation

Preserved authenticated primary director `de0f27a1-60d0-4449-af83-fdf360a9bc08` / pr122-director@test.invalid on the stable Preview at commit `362b83732dcf50599327e0ece3a961af193ba35d`. Exact staging tournament `e7bc6541-58b0-4465-8cde-3ccb7c2e6da6`, event `ee058815-1b68-49e4-b117-ad827b3ac505`. Preflight verified zero prior review/operation rows, qualification/source current, expected version 0 and no blockers.

One supported UI submit after filling an explicit TEST ONLY reason and reviewed checkbox. No repeated click, direct backend write, forced response loss or fabricated retry.

- Review **b5576ce8-7a59-4de5-a984-ce37f7645f2d**, version **1**, supersedes null, status **unpaid**.
- Recorded **2026-10-29T02:56:15.238567+00:00**.
- Client operation **deafe40c-31fb-4767-9d79-451cdd2056f7**.
- Accepted operation receipt **44c09d5c-61b4-4a53-b5f5-ac775171e7b9**; exact request hash verified.
- Audit **56cb07ec-7d84-480a-abf8-113d6da94d7e**, action `q_obligations_recorded_unpaid`.

## Exact server amounts and sources

| Pool | Recipient | Kind | Unpaid amount |
| --- | --- | --- | --- |
| Q1 | QPay02 | Award obligation | $6.67 |
| Q1 | QPay01 | Award obligation | $6.67 |
| Q1 | QPay04 | Award obligation | $6.66 |
| Q2 | QPay15 | Refund obligation | $10.00 |

Q1 total $20.00 equals its funding; Q2 total $10.00 equals its funding. Both remain unpaid, not financial transfers or payment receipts.

- Stored manifest SHA256 equals current source digest **392c3da81ffe67a151e0f6c23bd839c97430479c6d6376ab6e417a2f0c60a881**.
- Qualification **744a7a12-9039-4a5f-82af-5edc76afea6d**, version 1, order 02/01/04/03, no ties.
- Q1 policy **7143e973-4431-42e7-83b1-e1ec7b6fa8b7**, exact pool **6f84f58b-3593-4e7a-a6a5-4594f7d7b49d**.
- Q2 policy **a8867fc7-4ffb-4398-a1c6-6a8dc12015ab**, exact pool **a746d39d-b861-4cd3-974a-8e3632af5d15**.
- Full source snapshot binds 16 membership rows and 16 allocations (all version 1), 16 original receipt rows, 16 original obligations, 96 games, 192 effective scorelines, 16 participants and one schedule publication.

## Persistence and invariants

UI confirmed success and current unpaid review, cleared pending request, disabled another save for unchanged sources. Normal reload retained the same version, amounts, IDs and current status; no retry button/pending queue. History explicitly says old versions would be history rather than additional liabilities. Immutable UPDATE/DELETE trigger remains enabled; no hosted mutation attempt against history was performed.

Read-only SQL after reload: exactly **1 review, 1 review operation, 1 audit**, record MD5 `4453f940dc6d9715c1f5cf1b2d8210b8`. No duplicates from reload. All **194 other app tables** preserve count and deterministic row hash. The only changes are +1 each in q_obligation_reviews_v1, operation_receipts and audit_events. Thus the original $510 synthetic receipts, allocations, qualification, scoring, old fixtures and existing settlements remain unchanged.

Existing director session preserved and page left open on immutable history. Screenshot captured in task output. Ignored detailed evidence `test-results/q-obligation-hosted-batch-evidence.json` contains complete before/after table hashes and operation/source checks.

## Coverage limits / next gate

This proves one live authenticated UI → API → staging database unpaid review and refresh persistence. Hosted duplicate requests, conflicting writers, stale-source corrections and supersession were not deliberately triggered; corresponding local real-SQL/browser tests passed earlier. Actual award payment, refund execution, paid/discharged lifecycle and canonical Q settlement remain disabled/out of scope. Any source correction or second batch needs separate approval. The next design step is a bounded, source-bound canonical settlement adapter for these unpaid liabilities, without implying that recording an obligation moves money.

