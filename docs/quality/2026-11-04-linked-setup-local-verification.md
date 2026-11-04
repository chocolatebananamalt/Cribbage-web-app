# Linked Main / Consolation local verification

Local implementation only. No push, deployment, hosted record access, hosted migration, fixture enrollment, role/credential change or money movement. Published preview remains b007b0d3089e76d2c3c7bc22837d79dae7cac45a. The user's saved draft was not accessed or changed by this work.

## Implemented behavior

- Explicit optional Main-to-Consolation choices use stable setup-row IDs and operational event IDs. Multiple Main/Consolation pairs are permitted without inventing an ACC event limit. Existing Consolations can be assigned; No does not delete their editors or pools. Unknown/unassigned choices prevent finalization, not draft preservation.
- New protocol DTOs and sidecar records preserve historical codecs and whole-row source hashes. Actor/operation/full-envelope binding, expected revision, immutable audit, graph readback, read-only accepted-save reconciliation and exact recovery protect retries. Old entrypoints cannot bypass linked activation.
- Atomic activation includes typed Side Pool materialization and supported team promotion before recording acknowledgment. An injected late failure proves full rollback of events, promotion, links and registration. Fresh writes after activation are blocked while accepted historical requests still replay.
- Director-reviewed incremental Main series records derive actual participants/rounds from the current qualification and earlier series. They distinguish played results, forfeits and explicit Director-declared synthetic provenance; none is independent canonical-game verification. Corrections cannot silently invalidate descendant or admitted evidence.
- Current nonqualifiers and reviewed first/second-round played losers may enter their specific linked Consolation before actual Start. Qualification alone is not exclusion. Byes and forfeits alone are not played-loss proof. Immutable Start snapshots pin Main, qualification, roster and loss/ancestor evidence; later unrelated Main matches do not invalidate the source. Unsupported team admission fails closed.
- Separately tagged V2 Consolation source, writer, workspace and award-preview dispatch preserve V1 history/replay. Existing Main qualification source freshness remains part of the V2 digest. Whole-bracket and legacy placement writers cannot contradict incremental evidence, and known terminal rejections are scoped, recorded and recoverable.
- Early-series UI hides only for confirmed unlinked events; loading/error/storage failures remain visible. Every semantic edit requires re-review. Unknown or mismatched responses retain the exact actor-bound request; cleanup requires scoped acknowledgment and matching fresh readback.

## Completed checks

`pnpm verify` exited 0 on the final code/migration snapshot: 1,254 application tests; dependency audit; lint (existing warnings, no errors); provider checks (six); optimized build/TypeScript; workspace checks (eight). `pnpm verify:handoff` passed six. Logs: `test-results/setup-links-full-verify.log`, `test-results/setup-links-handoff.log`.

Phone 320px/desktop 1440px browser scenarios cover grouping, orphan assignment, explicit No, exact interrupted save, stale association readback retention, cleanup, early-series review resets, 409 refresh, 503/malformed reader/storage failures, synthetic correction and mismatched-operation rejection. Legacy navigation eight scenarios passed. No physical device acceptance is claimed.

Isolated PostgreSQL, exact pinned image and empty schema baseline, no network/ports/mounts:

- Foundation `b06a2d46...`: migrations, pre-migration byte-identical save replay, source digest preservation, explicit legacy-draft promotion, two Main/two Consolation plus Doubles Satellite, typed Side activation, late rollback, post-activation guards, changed-graph replay conflict and two-session competing saves.
- Evidence `db3a6220...`: actual SQL-to-TypeScript workspace/receipt/rejection codecs; real-current qualification; early played-loss/pending/forfeit decisions; immutable snapshots; null CAS; correction/descendant/Start guards; V3/V4/legacy terminal receipts; V1 historical replay/currentness; lifecycle replay; two-session lock ordering; later Main result stability; multi-pair financial rejection.
- Full supported synthetic two-event lifecycle `2346583e...`: 120 Main + 56 Consolation generated games; actual Start/scoring/final APIs; both award previews; Q-Pool/Side Pool conservation; stale Main source detection; source-bound cross-check closures; unpaid drafts/joint final; role, replay, stale-source and competing-writer guards. Association itself was fixture-inserted; setup/activation graph was separately tested. Synthetic only, no independent human review, physical play or money movement. Exact created databases/containers removed and absence verified.

Independent review cleared the SQL/UI/API/recovery findings, including lifecycle replay and known synthetic rejections. Final Main-fingerprint re-review also cleared with no P1/P2 findings on SHA256 a9cd5e6354d05f91ebf0e32c64731345b5c28cd1a1014d0fc41a7ca833d3e85e.

## Compatibility and remaining limitations

- No automatic ACC membership rejection or new MRP membership rule was introduced. Those lookup/correction requirements remain separate planned work.
- Early played-loss adapter is the existing four/five-qualifier Standard Singles bracket domain; unsupported formats remain pending, while current nonqualifiers do not require that adapter. Linked team Consolation admission is unsupported.
- Two-event financial finalization remains exactly one Main + one Consolation. Two Main/two Consolation financial finalization explicitly rejects `unsupported_event_set`; no ordinary-ledger workaround. Typed Main forfeits cannot be silently projected as played series by old whole-bracket/MRP derivation.
- No live phone/iPad acceptance, staging migration/recovery verification or hosted fixture preservation readback was performed. Those belong to separately approved rollout and user walkthrough. Existing records were protected by scope and local historical compatibility tests, not claimed hosted fingerprints.
- Workbook-based parameter UI, public pool summaries, ACC lookup and broader formats remain separate scope. No event payout method or rounding policy changed here.

## Deliverables

Local migration candidates 0290–0292 (official CLI scaffolds adapted to repository numbering), matching proposal copies, 36 code/test/migration files in the feature manifest, and this report. Final source archive is a local verified checkpoint, not off-device durability or a Library upload. Backup receipt and byte-level manifests are under `test-results/main-consolation-final-*`.
