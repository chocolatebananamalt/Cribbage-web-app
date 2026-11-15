# Synthetic photo and offline acceptance pass

Date: 2026-10-28. Scope: tests, synthetic fixtures and documentation only. No application behavior/source, migration file, hosted session/data, role, credential, external service or deployment changed. Q Pool work remains unpublished and preserved.

## Observed results

| Check | Result and evidence boundary |
|---|---|
| Photo uncertain completion, 390/1440 | PASS actual component retains the identical capture envelope for retry on the same screen. Mock first completion aborts; second signed upload returns object-exists 409; mock completion succeeds. This exercises reconciliation UI/codec, not a real provider lost-success event. |
| Photo after reload | REPRODUCED RECOVERY GAP at both widths: unresolved file/request is absent after reload; reselecting the same image generates a different idempotency key. No duplicate backend persistence is claimed. |
| Photo network error | REPRODUCED UX GAP: aborted completion displays native “Failed to fetch” rather than specific keep-open/same-image retry guidance. Request remains in memory until reload. |
| Local simultaneous conflicting queue calls | PASS real browser IndexedDB/key-generation/queue code: two overlapping opposite results produce one fulfilled durable record and one rejection. This is one device/context, not two-device server conflict proof. |
| Exact queue duplicate | PASS returns the original intent; queue count stays one. |
| Queue reload | PASS exact signed record retained after reconnect and reload. Offline navigation/cache preparation was not exercised by this test. |
| Pending-work account switch | PASS actual SharedDeviceSignOut shows one offline entry and omits Clear safe app data and sign out. No auth/sign-out call was made in this queue case. |
| Replay transient failure | PASS real replay transport returns mocked 503 and exact queue bytes remain. Full score-entry sync controller and authoritative server acceptance not exercised. |
| Independent photo review | PASS real isolated SQL: private bucket/storage receipt replay, separate-official read, self/outsider denial, and one human-review access event. This authorizes access; it does not prove a human compared pixels. |
| Mixed separate-official review | PASS existing real rollback SQL fixture: distinct case creator/reviewer, durable review/reconciliation replay, canonical totals and service-only privilege guards. Synthetic inputs only. |

The new browser harness has nine grouped assertions, including four photo groups at two sizes. Screenshots `test-results/photo-stored-390.png` and `photo-stored-1440.png` show the synthetic card and explicit nonauthoritative status. Phone screenshot was visually inspected: image/text fit and no horizontal overflow was observed. No camera, genuine participant handwriting or external OCR was used.

## Executed commands and environment

Node 24.19.0, installed Next 16.4.2, Chrome via installed playwright-core; separate headless contexts. Local fixture ports 3241 and existing auth fixture 3237. New harness aborts requests outside its exact two loopback origin spellings. It imports actual production components and queue; responses/capabilities are fictional mocks.

1. `node --conditions=react-server --experimental-strip-types --test tests/paper-card-capture.test.mjs tests/paper-card-upload-api.test.mjs tests/private-paper-card-storage.test.mjs tests/paper-card-human-review.test.mjs tests/offline-score-queue-contract.test.mjs tests/hybrid-digital-paper-minimum-officials.test.mjs`: **34/34 pass**. Some are source contracts, not database execution; the SQL run below supplies separate database evidence.
2. `node tests/photo-offline-acceptance-browser.mjs`: final **nine groups pass**. Results saved to `test-results/photo-offline-acceptance-results.json`; server log and screenshots alongside it. The reload-gap assertion intentionally characterizes current behavior; its passing assertion does not mean recovery is complete.
3. `node tests/recovery-auth-browser.mjs`: **exit 0**, actual local Next auth/coordinator/session-cookie paths with fictional provider. Passed same-account retained recovery, unknown ownership blocking, lost auth response reconciliation, exact/unequal writer retries, exclusive/actor-change protection, 390/1440 sanitized register/update/protocol/storage failure cases, and prior-worker upgrade/reload with retained bytes. This is not real Supabase/browser crash evidence.
4. `node tests/run-photo-review-isolated.mjs <exact-owned-container-id>`: **exit 0** for existing `paper-card-capture.sql` and `hybrid-digital-paper-minimum-officials.sql`. Both rollback; final counts **0 users | 0 tournaments**. Logs: `test-results/photo-local-paper-card-capture.sql.log` and `photo-local-hybrid-digital-paper-minimum-officials.sql.log`.
5. ESLint on both new harnesses: **exit 0**. `git diff --check`: **exit 0**, existing CRLF normalization warnings only. No full build/test rerun was needed for application code unchanged in this pass; prior Q Pool 942-test evidence remains separate.

Initial default-sandbox readiness probes timed out despite Next Ready. Supported scoped loopback executions then succeeded; no denied operation was bypassed. Initial photo assertion expected the component's explicit unresolved-completion message, but a network abort actually shows “Failed to fetch.” The test was corrected to characterize that observed behavior; application was not changed. Review requested the second-upload conflict branch and exact-origin transport restriction; both were added and rerun successfully.

Independent final read-only review: GO for bounded evidence, no critical safety or overclaim issue. In particular, direct replay transport does not itself delete queue records, so its 503 test is not proof of the complete synchronization controller. Review made no edits. Final process inventory found no node command line targeting either local fixture directory; migration hash and diff whitespace check were rechecked.

## Disposable SQL environment and cleanup

Cached reviewed image `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`; reviewed empty baseline SHA256 `e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`. Unprivileged postgres, local Unix socket; network none, zero published ports, zero mounts, no privilege. Runner verifies exact ID/image/label/isolation before use, restores baseline to a new disposable database and applies existing local 0237–0243 only there before rollback fixtures. No SQL is sent to staging or production.

Owned container `cribbage-photo-local`, ID `73e127ab2641fcef7c8fe53d53c35a67967200ebfa7ae150684dc3b5fcc3d544`, was removed after inspecting isolation and successful rollback. Filtered container listing confirmed absence. Browser contexts closed and task-owned Next children stopped. No persistent test service or security setting was intentionally created.

## Proposed narrow repairs, not implemented

1. Persist a bounded photo upload intent before capture submission, associated with actor/tournament/game/side and digest. Reconcile that exact intent on reload before allowing a new capture. Decide whether the image file itself may be retained locally; do not silently persist private photographs. If reselect is required, verify digest and reuse the old intent. Integrate with existing pending-work/account-switch safety and clear only after confirmed server terminal state.
2. Normalize network exceptions into specific unresolved-upload guidance, preserve the exact request, and clearly distinguish “not confirmed” from “not stored.” Add refresh-stage and old-intent reconciliation tests before rollout.

These repairs need local implementation authorization; no new role or public-image permission is inherently required. Any local image retention or external OCR activation needs explicit privacy/retention design and separately reviewed scope.

## Not proved / next acceptance

- True physical device A/B disconnect/reconnect, two independent browser stores racing against a real backend, server stale-version conflict, full score-entry replay→two confirmations→standings, offline page reload, process crash and BFCache recovery were not run here. They remain explicit acceptance gates.
- SQL independent review is genuine authorization/score-state proof, while the photo browser uses mocks. An integrated image upload→private server bytes→two authenticated human-facing review pages remains to run locally and later in an approved new hosted fixture.
- OCR adapter remains unintegrated/default-off. No images or credentials were sent to a provider. Automatic extraction/correction is not established by synthetic manual capture or SQL results.
- No new bye support or Q payout policy was implemented. The Q migration is unchanged: 0243, 26,580 bytes, SHA256 `50B9C35E38EF56BE0540896D3AC3BD621FAA9D4C72081AB0CDDD131035E003FF`.

Morning recommendation: separately approve the reviewed Q staging rollout; authorize the small photo-intent/retry-guidance repair locally; then schedule a dedicated two-device backend acceptance fixture. Keep existing finalized funded and negative fixtures intact. See `2026-10-28-next-acceptance-and-q-pool-rollout-plan.md` for rollout/rollback and policy decisions.
