# Approved player restoration — local verification milestone

## Authorized scope and outcome

Daron approved the reviewed design in Sentinel_f0c0f48ffc408191844b29921a786240 (November 2, 22:22 UTC). Implementation is LOCAL ONLY. No commit, push, deployment, migration, hosted score, role, credential or payment change occurred. The selected September demo route/component and authentic logo file are unchanged.

Entry uses own-player WON/LOST, positive spread input with existing skunk rules, centered value/right-hand indicators, inline review summary and a truthful Submit result action. The summary is visible before submission; submission never replaces separate matching entries and explicit confirmations. Existing mutation, replay, receipt and idempotency controllers remain in place. Plain display wording distinguishes saved/waiting from completed; unknown rejection/recovery explanations remain intact.

Card uses one-line scheduled rows, game points versus signed spread points, visible rules, real opponent IDs and footer totals. Net Spread spans the first two columns; the signed net is centered over the merged spread columns. Only the existing protected scorecard reader supplies values and totals. Pending rows come from that reader; actor-scoped My Games only enriches exact matching opponent identities. Missing legacy makeup mapping cannot create a fictitious Game 13. Current-game links use protected progression, not sequential guessing; finished/ambiguous schedules have none.

Shared player presentation has the approved black event header and authentic CSS-cropped logo, active top tabs, fixed Home/Scorecard/Profile controls and reserved page space. Entry has no selected bottom destination; card selects Scorecard. Home uses the existing authorized tournament workspace, preserving assigned-role filtering. Profile is a read-only dialog for this signed-in player's tournament identity, not a new global profile editor. Sign-out remains the unchanged guarded control under Help and account options. Broader Home/Profile functions/design remain follow-up work, not claimed complete.

ACC metadata limitation: the existing live own-card RPC does not currently supply an ACC number. The presentation shows only a real valid optional number if supplied; it never infers one or reads staff-only roster data. A self-scoped metadata reader addition needs separate design/review and any required schema authorization. The local screenshot's HI99999 is explicitly fictional test data, not a user number.

## Review findings and corrections

Independent Sol review identified browser Back draft loss, a makeup shortcut using scheduling-batch numbering and an empty-draft recovery blocker. All were fixed and re-reviewed with no outstanding P1/P2 findings.

Raw unsubmitted choices use strict actor/tournament/event/game/side binding under the existing recovery-owned acc-score prefix. New immutable snapshots pass through setAppRecoveryItem before old owned snapshots are removed; the immutable recovery writer was not weakened. Empty choices are not retained. Accepted server entries, exact retry envelopes and durable offline queues take precedence. Raw drafts cannot submit, confirm or acquire score authority. Cleanup occurs after durable queue creation; cleanup failure does not discard that queue. Explicit navigation cancellation and real Next Back/Forward restoration are browser-tested.

## Executed evidence

- Final pnpm verify passed: production dependency audit (no known vulnerabilities), ESLint, **1,173 application tests**, provider checks, production build and **8 workspace checks**. Log: test-results/player-restore-full-verify-final.log.
- Private handoff: direct equivalent command node --test tests/handoff.test.mjs; terminal result recorded separately. The pnpm wrapper was stopped after startup stalled without running tests; no dependency/security settings changed.
- Actual-component browser: **8 groups** at 320/390/768/1440 CSS px, four canonical-side/outcome cases, inline review before one submission, no local verification, draft cancellation/Back/Forward/empty cleanup, own Profile identity, table/totals, completed schedule and enlarged text. test-results/player-restoration/result.json.
- Existing score refresh regression passed its baseline reproduction and both 390/1440 fixed paths: offline replay, automatic confirmation availability, explicit own confirmation, remote completion refresh and no duplicate POST. test-results/player-restored-sync-refresh.log.
- Existing production-build connectivity regression passed **23 groups**, including durable offline save/reload, malformed receipt/session/503/lost-response retries, online-only confirmation and **12 genuine origin-down/worker/owner/lock cases**. test-results/live-score-connectivity-result.json and player-restored-connectivity-final.log.
- Existing odd-field browser regression passed **10 groups**, preserving per-player makeup card lines, no fictitious Game 13, paper/hybrid flows and initial-seat publication rejection. test-results/odd-field-makeup-browser-results.json.
- Independent focused review tests **13/13**; no outstanding P1/P2. TypeScript and diff whitespace checks passed during integration.

The early Windows editing helper introduced text encoding corruption; affected files were repaired and all final checks rerun. Early local browser startup was blocked by environment localhost access; supported per-command escalation enabled only task-owned localhost/headless checks. No approval denial was bypassed. Test selectors were updated for the approved inline summary, uppercase own-result controls, Help placement and renamed heading; authority/rejection assertions remain.

## Review images and limits

Working images are from actual components with fictional local transports, not the earlier static mockups. Expanded screenshot height shows all content and the actual fixed bar without hiding middle rows; separate ordinary viewport renders verify the fixed bar. Images were visually inspected. Native delivery identities are retained separately in the current task's working-implementation-library.json receipt.

This is not hosted acceptance, real independent-human play, Safari/iPad certification or production readiness. No physical device/network action was performed. Existing staged tournament evidence and sessions were not used or changed. Publication requires review of the exact local manifest and separate approval.
