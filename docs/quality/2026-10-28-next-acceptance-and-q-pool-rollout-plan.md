# Next acceptance gates and Q Pool rollout proposal

Date: 2026-10-28. Read-only code/source review after the local Q Pool implementation. This document is a proposal, not rollout or business-write authorization. No application source, hosted session, records, settings or migration was changed in this review.

## Priority and classification

| Order | Gate | Actual gap | Next bounded action |
|---|---|---|---|
| 1 | Q membership/allocation | Local implementation verified; hosted acceptance absent | Separately approve Preview publication and 0243 staging rollout, then approve a new synthetic Q fixture |
| 2 | Photo evidence | Private upload/review exists; interrupted upload and real two-official image review not established | Local synthetic-image acceptance through capture/upload/completion and independent review; diagnose failures before repair |
| 3 | Offline/multi-device | Queue implementation exists; actual simultaneous devices and connectivity lifecycle unproved | Dedicated fictional digital fixture with prepared offline pages and independent authenticated devices |
| 4 | Byes | Arithmetic/qualification preview exists; canonical persisted outcome/settlement supports only four qualifiers/no byes | Source-reviewed bracket/bye evidence design and local implementation approval before hosted bye results |

These gates do not invalidate the completed 96-game funded rehearsal or bounded mixed match. They also do not turn simulated paper evidence into photo/OCR coverage.

## Q Pool: rules versus choices

Authoritative source checked: [ACC Tournament Director Manual, February 2019](https://www.cribbage.org/NewSite/sched/Directors%20Manual%20-%202019.pdf), section 8A, printed pages 12–13 (PDF pages 12–13). The official director resources continue to link that edition. It describes optional qualifying pools, equal or graduated awards, and director selection of the payment method. The method must be disclosed before entry/payment and stated on the flyer; pool count is announced before play and scorecards identify participation. Section 8B treats Side Pools separately. The sample playoff payout table is not a universal Q Pool formula. No universal cent-rounding or tie formula was established by these passages.

Before automatic payouts, choose a posted, versioned method with worked examples: equal versus graduated; award population/count and cutoff; qualifying-rank tie handling; integer-cent remainder treatment; and any explicitly desired top-qualifier variation. The wording about fractional award populations must not be silently converted into an invented denominator. Qualification rank must not be substituted with playoff finishing order. These are the remaining director choices, not a request to repeat manual-defined rules.

Current approved app choices are explicit pool-version consent, full base-plus-pool allocation for paid-entry status, a start lock, reasoned director corrections of existing pre-play records, and a single Standard Main/no Side Pool scope. They are not all ACC mandates. First late elections and first late payments are blocked. Admitting a previously unrecorded election/new receipt, refund entitlement, multi-event cash allocation or CSV migration needs its own evidence/policy design. Automatic Q payouts and canonical Q settlement remain disabled.

## Exact migration and morning approval

Canonical file: `database/migrations/0243_q_pool_membership_v1.sql`.

- Size: **26,580 bytes**.
- SHA256: **50B9C35E38EF56BE0540896D3AC3BD621FAA9D4C72081AB0CDDD131035E003FF**.
- Byte-identical proposal: `docs/quality/2026-10-28-proposed-q-pool-membership-v1.sql`.
- Adds two immutable private tables, two private helpers, and three public RPCs restricted to existing `service_role` execution. Tables have enabled/forced RLS and no direct client/service DML grants. Existing financial writers, grants and history are unchanged.
- This **does expand the trusted service role's callable API** by three narrow functions. It does not create human roles, credentials, public read access or direct table access. Existing director/co-director authorization is checked server-side; a Cross-Checker role alone does not gain the financial workspace.

Evidence already completed: 942 application tests, audit/build/types/providers/workspace checks, rollback SQL, four real SQL-to-TypeScript states, seven ordered overlapping database races, phone/desktop component-browser checks and independent GO/no P1/P2. See `2026-10-28-q-pool-membership-local.md` for commands and limits. These are not a full browser→API→database or hosted Q acceptance test. No expensive retest was repeated for this documentation pass.

Proposed approval wording: **May I publish the reviewed local Q Pool membership/allocation patch to the existing draft PR, verify its Preview, then apply only migration 0243 to cribbage-pr122-staging and perform read-only checks? It adds three service-only functions and two private tables; it will not create elections, receipts, payouts, roles or final settlements, and will not touch production.**

Rollout prerequisites: reconcile remote/base and reviewed inventory; final secret/private-artifact scan; non-force push to the existing branch; exact-commit CI and normal Git Preview READY; authenticated privileged runtime isolation to `nnhcnvksxgxnpvdqjgpg`; verify migration history/hash, inactive writers and recovery queues. Publish the compatible app first (missing RPC is unavailable/fail-closed), apply additive database support, then inspect access catalog, owners/search paths/RLS/guards and unchanged fixture fingerprints before any separate Q business test. Do not reapply older migrations. Stop on drift, unknown outcomes or isolation failure.

Rollback: prefer a reviewed forward repair; never drop new history after writes. An authorized app rollback may leave additive tables/functions intact. A stable-alias rollback alone does **not** disable API writes on the immutable newer Preview. If an actual writer shutdown is necessary, request that specific action rather than claiming alias rollback is sufficient. Older deployed recovery counters recognize the nested Q retained-request key, but older pages cannot reconcile its content: keep pending data until the Q page is available, never clear it to force an account switch.

Separate hosted foundation proposal, not approved: NEW TEST ONLY one-Main/two-paper-player fixture, base $30, Q1 $5, Q2 $10. A elects both, B declines both. Initial cumulative receipts A $37.50/B $30; explicit A allocation $30/$5/$2.50 proves Q1 paid-entry and Q2 partial. Void/replace A's cumulative receipt with $45 (not an additional $45), then allocate $30/$5/$10: total receipts $75, base $60, Q funds $5/$10. Complete this before start; test start lock and reasoned correction using the same pre-play receipt. No payout/qualification/final settlement is needed. This requires separate explicit fictional receipt/void/election/allocation/start approval; no actual sanctions or money. Do not repurpose the finalized funded fixture.

## Photo capture and cross-check review

Code: `src/components/private-paper-card-photo.tsx`, `paper-card-review-links.tsx`, `src/lib/paper-games/private-card-storage.ts`, `src/lib/api/paper-card-capture.ts`, paper/hybrid game clients, protected `paper-card-review-image` route and migration 0162.

The existing flow hashes a JPEG/PNG/WebP up to 10 MiB, creates capture metadata, authorizes a private signed upload, then verifies completion. Protected image reads check independent-official authorization and verify stored bytes; no public read URL is needed. Completion explicitly does not request OCR, change scores or verify games. A different independent official must perform the substantive review; opening an image is not score confirmation.

The selected file and capture intent live in component memory. Reload/close between metadata creation, upload and completion is therefore an interruption risk to reproduce, not a proven hosted defect. Test exact retry/lost completion response, duplicate clicks, refresh at each phase, wrong game/side, wrong actor, self-review, digest mismatch and orphan reconciliation. Preserve original image/evidence and never invent a replacement score.

`src/lib/paper-games/openai-ocr.ts` provides a bounded nonauthoritative draft adapter. Inspection found no application route/job caller of `extractPaperCardDraft` beyond its definition/tests. Thus automatic extraction needs integration, not merely enabling a flag. Existing adapter tests mock provider responses. Activation additionally needs approved private provider credentials, model availability, privacy/retention/cost review and actual false-read evidence; `store:false` is not a guarantee of no provider retention.

Recommended next implementation-independent slice: local end-to-end synthetic clear/blurry/rotated/cropped cards, ambiguous 2/3 and spread signs, image capture/reload/retry, two independent officials viewing and correcting a manual transcription, and unchanged totals until required review. If interrupted capture fails, propose the smallest durable-intent repair. Only afterward design persisted OCR draft→human correction→independent verification, with no automatic authoritative scoring.

## Offline and multiple devices

Code: `offline-score-queue-contract.ts`, `offline-score-queue.ts`, `offline-score-page-cache.ts`, `public/offline-score-sw.js`, digital `score-entry.tsx`, and `api/v1/offline-score-replay/route.ts`.

Prepared offline pages can retain signed submission intent with actor/session/device/game/version scope. Queue state is not server verification. Replay reconciles exact operation receipts and retains uncertain/transient outcomes. Actual confirmation UI requires reconnection; the broader type contract must not be mistaken for implemented offline confirmation support. Distinct player submissions and confirmations remain required.

Next acceptance matrix: two independently authenticated supported devices; prepare while online; disconnect only the test context through approved controls; queue and reload without lost bytes; reconnect in both orders; verify exact-once receipts and totals. Include stale version, mismatched entries, expired capability, wrong actor, same-account reauthentication, 401/423/429/500/unknown response, concurrent official correction, repeated clicks and two tabs. Verify terminal receipt deletes only its matching queue item. Then separately test worker update, BFCache, navigation and process termination. Prior local lifecycle tests and sequential hosted player tests do not prove physical-device/crash behavior. Do not extract sessions, force production response loss or change system security for testing.

## Byes

Code: `src/lib/qualification.ts`, `src/lib/results/playoff-rounds-won.ts`, `src/lib/api/playoff-outcome.ts`, `src/lib/results/acc-payback.ts` and canonical 0240/0241/0242 guards. Qualification computes bracket size/top-seed bye previews; the arithmetic helper separates won rounds and byes. Current canonical outcome persistence is the four-qualifier, three-series, zero-bye slice. Payback and structured prize paths explicitly reject unsupported byes. A preview or helper passing tests does not establish supported saved bye evidence.

Next design must represent the seeded bracket, explicit bye award, real played series and elimination band separately, bind them to the exact qualification version, and carry that evidence through MRP, award coverage and settlement. Test five/six/seven qualifiers plus power-of-two brackets, invalid seeds/multiple byes, changed qualification, champion credit and equal elimination cohorts. Never encode a bye as a fictional played win or rewrite legacy exit rounds. Official rulebook/bracket instructions must be rechecked for the exact format before implementing; this pass's rulebook web fetch failed, so no new page-specific bye rule is asserted. Historical design documents with withdrawn blanket writer revocations are not a current rollout plan.

## Stopping point

This review saved documentation only. Existing director session, final funded rehearsal and older negative fixture are untouched. No new source feature, external provider call, browser interaction, business record, publication, migration or permission change occurred. Remaining blockers are explicit rollout/business approval, director-selected Q payout policy, missing OCR integration, unverified physical connectivity behavior and unsupported canonical bye persistence—not missing passwords or permission to guess rules.
