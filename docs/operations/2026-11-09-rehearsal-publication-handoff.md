## 2026-11-12 — GitHub connection/publication troubleshooting lesson

Source: Codex chat **Explain GitHub connection workflow**, as verified by the coordinating thread; [PR #122](https://github.com/chocolatebananamalt/Cribbage-web-app/pull/122).

A fresh, bounded, disclosed upload was explicitly approved and PR #122 was merged. The original interrupted operation's exact outcome remains **unknown**, not a proven automatic denial; its original cause was not definitively diagnosed. The older handoff below is historical, not the current publication blocker. Production remains held: a merge is not production acceptance, and later local additions are outside that reviewed release.

For future connection or publication failures:

1. Inspect actual connector/repository access and remote branch, commit and PR state first.
2. Distinguish an unknown interrupted outcome from a confirmed denial. Recover and reconcile completed side effects before retrying.
3. Use an explicitly approved, bounded, disclosed publication scope through the supported approval path; never bypass a real denial or infer blanket permission for future uploads.
4. Verify the resulting branch, commit and PR. Preserve unpublished parallel work and review deployment scope separately.

# Next step toward Daron's tournament test

The immediate blocker is publishing the already approved **Setup-only** app update. Its test database installation succeeded; it must not be reapplied just because the app upload stopped. The full tournament rehearsal is a separate later release and acceptance step.

## What is known about the stopped upload

- Public destination: `chocolatebananamalt/Cribbage-web-app`, branch `codex/director-setup-journey`.
- Last reconciled branch head: `2686815e8a28a7baf31beb08d9ffc81fa7161c34`. This is recorded evidence, not a new live check.
- Approved package: the frozen **216 files** in `test-results/native-mixed-finance-release-20261109/candidate`, listed and hashed in `frozen-public-manifest.json`. It contains code, tests and SQL source, not player records, credentials or backups.
- Six code blobs were uploaded. No new commit, branch update or preview deployment was created at reconciliation. An uploaded blob alone does not update the running app.
- The next six expected blobs were not found at readback. The original batch's completion/rejection response was not retained, so its exact rejected action and reason remain **unknown**, not a confirmed new denial or a successful publication.
- Successful test database updates are `20261109105943` and `20261109110538`. Existing Setup enablement stays as-is. Production is unchanged; native rehearsal gameplay, participant access and Finance/payout activation stay off.

Original reconciliation: `test-results/native-mixed-finance-release-20261109/PUBLICATION-RESOLUTION.json`. The interrupted batch is exec cell **89**, second six-file batch. It contains these source paths:

1. `database/proposals/event-settings-custom-pool-transaction-v4.sql`
2. `database/proposals/event-settings-operational-activation-v1.sql`
3. `database/proposals/event-settings-playoff-gate-v1.sql`
4. `database/proposals/native-mixed-bootstrap-workflow-v1.sql`
5. `database/proposals/native-mixed-latest-prize-admission-v1.sql`
6. `database/proposals/native-mixed-main-finance-v1.sql`

## What Daron can safely do now

Open the original conversation's tool activity/review details, if available, and locate that stopped batch. Read the exact status and rejection text; do **not** press Retry or upload files. Share the action name, outcome and reason, excluding passwords or tokens. If the original event is not visible, ask platform support to retrieve it using the request below. The executor cannot currently retrieve the missing original event; Personal Context returned unavailable.

Separately, Daron can open the GitHub branch in his own browser and **read** its current commit ID or see whether an unexpected newer commit exists. This does not require changing the branch, deployment settings or app data. Report any different commit before a publisher proceeds. There is no need to sign out, repeat the two-device sign-in, enter a database password, run SQL or make another backup for this read-only check.

Draft for platform support (not sent):

> Please recover the original tool/review result for exec cell 89, second six-file GitHub blob-upload batch, in Cribbage project conversation 01a1a546-e8fe-7397-9f57-1a9db485a0f4. Destination was the public repository chocolatebananamalt/Cribbage-web-app, branch codex/director-setup-journey; the first six blobs uploaded but the branch was not updated. We need the exact action, outcome (executed, denied, pending or uncertain), rejection reason and any applicable retry condition. Please do not replay the operation. The six interrupted source paths are listed in the project publication handoff.

No manual upload, alternate transport, force push or renamed/split batch is proposed to work around the unresolved operation. If it was genuinely denied and is known not executed, a supported retry can be considered only under the applicable new-evidence rule. A pending or uncertain action must first be reconciled.

## Once that event is resolved

An authorized publisher—Daron himself or the assistant through an allowed path—can finish **only the exact frozen 216-file package**, reusing the six confirmed hashes, checking the current branch against the expected head and verifying the final tree and commit. This is a review/release plan, not an instruction to upload while the block remains unresolved. Do not publish the active development folder wholesale. It contains additional private, unapproved work.

Verify CI and the READY test preview, then have Daron check the new normal Setup screen once: Main/Consolation Playoff settings replace the unwanted declaration editors, existing values survive save/refresh, and no games, participants or payouts become enabled. His existing laptop/phone sign-in need not be repeated. Database migrations, grants, full restore, 108-game test and backup capture need not be rerun merely to finish this publication.

The newest Results follow-up alone has **18 selected source/test files**: 14 absent from the approved 216-file package and four different from that package. `test-results/native-mixed-pool-results-read-20261109/next-release-boundary-inventory.json` records this bounded comparison. It is **not** the complete rehearsal dependency closure, a release manifest or permission to publish these later files. Completing Setup publication therefore will not deliver the newest Results/paper/MRP/OCR work or make the whole trial playable.

## Smallest next rehearsal acceptance sequence

1. Review and freeze one coherent later play/Finance/Results package and its actual schema/permission differences. Reuse local evidence; run a new database test only for a material unproved change. Reassess the recovery point before broader write-enabled testing, honoring the fresh-backup commitment rather than capturing backups for every harmless check.
2. Separately approve a bounded event/cohort, its named accounts/roles and expiry. Names are needed when the test is scheduled, not to finish the closed Setup release. Six players each use their own account/consent; twelve paper identities remain explicitly fictional. At least two authorized people must independently capture/re-enter paper evidence, never for their own game and never through shared credentials. Playing officials need nonself coverage. The actual six-human playing-official role/nonself coverage and device acceptance remain unproved; two nonplaying fixture officials do not imply eight humans are required.
3. Under real provider sessions, test one DD, one mixed and one PP game, their disagreement/correction/recovery paths and role/consent revocation before expanding the session. Local SQL and offline UI proof do not replace this.
4. Use the actual random draw, fixed Tournament IDs and reviewed one-table movement. The current 18-player graph has 108 unique matches/12 distinct opponents per player; physical movement/anchor handling remains a distinct human acceptance check. Do not force the draw to make all real players meet.
5. Finish the tournament and reconcile qualifying cards, playoff outcomes and separately funded regular/Q/Side unpaid simulated awards. Current pool reader proof passed one 108-match run and $690 across 12 unpaid obligations, plus an exact empty pool. Unknown/stale sources stay unavailable, not zero; historical receipts do not establish current awards. No new refunds, actual payments or official MRPs are implied.

Remaining checklist work includes real provider/device/offline acceptance, broader event-format and payout-policy limits, photo/OCR human review and active-membership/audited MRP determination. Those must retain their existing pending/unsupported labels. The exact parent 15-item numbering was not recovered from the sources checked, and Personal Context was unavailable; these are prioritized acceptance steps, not a reconstructed or renumbered master checklist.

Prepared through local read-only source/evidence review. No upload retry, hosted read/write, new permission, account action, database test or message to another person was performed for this handoff.

