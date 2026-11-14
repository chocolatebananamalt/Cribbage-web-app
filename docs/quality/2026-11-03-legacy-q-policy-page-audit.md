# Legacy Q policy page audit - source/local only

No hosted tournament records were read, no user browser navigation or data change was performed for this audit, and no application code was changed. Existing local seven-file setup clarity patch remains separate and unpublished.

## Link and feature inventory

| Visible item | Actual destination/function | Recommendation |
| --- | --- | --- |
| Back to setup | `/setup`; ordinary full-document anchor | Keep contextual return, protect unsaved work and recovery. |
| Membership and receipt allocation | `/q-pools`; elections, policy acknowledgment and partition of existing receipts, not collection or payout | Keep capability, place under relevant pool after finalization; route by active finance/policy mode. |
| Record or review unpaid Q obligations (Director only) | `/q-obligation-reviews`; legacy v1 source-bound unpaid reviews/history | Keep historical access; current equal/graduated review uses v2 path or enrolled simulation finance. Do not silently substitute v1. |
| Disclosed equal and graduated operating schedules (Director only) | `/q-operating-schedules`; newer policies/previews and link to v2 unpaid review | Preserve; this is distinct from the old equal-only writer. Enrolled multi-event simulation routes to `/payments`. |
| Equal-policy explanation and disclaimer | Legacy `equal-paid-qualifiers-v1`, permanent exact-pool disclosure, no retrospective certification | Label historical/legacy, not universal Q policy. Keep historical text bound to existing policy records. |
| Named pool / disclosure reference / attestation / Publish and freeze | Immutable audited equal-only policy write, primary Director, activated supported scope, before play and any tournament receipt/elected membership | Do not expose as a generic draft step. Do not delete prior policies or pending exact-retry recovery. |
| Retry exact policy request / automatic reconciliation | Retained request, operation identity and reconciliation survive failed response/reload | Preserve access until all pending operations are safely resolved; no blind writer retirement. |
| Read-only payout preview, fund, blockers, recipients, source digest | Requires frozen policy, finalized untied qualification and fully funded current acknowledged allocations | Keep current preview functionality near relevant pool; hide technical digest under details. It cannot pay, refund, finalize accounting or create canonical awards. |
| Sign out / Clear safe app data and sign out | Shared account/recovery controls, not Q tools | Keep normal global account location and safeguards; do not use to fix this navigation issue. |

Page wrapper permits Director/Co-director to view; server only permits primary Director to publish. `requireLegacyFinanceMode` redirects enrolled multi-event simulation to payments and fails closed on unknown mode. The setup page currently links unconditionally to this older page. Setup finalization itself checks event declarations, not this legacy policy page. Fee/type setup, policy disclosure, membership/funding, calculation, review and accounting are separate stages.

## Refund wording versus adopted decisions

`src/lib/results/q-pool-preview.ts` implements historical equal shares to fully paid playoff qualifiers and contributor refund obligations when no paid qualifier is eligible. This is executable behavior, not a harmless wording fragment. `docs/product/requirements.md` (Oct29 clarified schedules), `docs/decisions/2026-10-29-q-v2-canonical-unpaid-accounting.md` and `docs/reference/payout-policy-clarification-2026-10-30.md` explicitly retain that equal/no-eligible case. The Oct30 06:19 correction distinguishes graduated rank-down and does NOT establish a blanket equal-pool refund override. Graduated paid nonqualifier backfill is the current distinct rule; this older page cannot represent it.

Therefore remove the misleading generic entry point, not immutable evidence or only the refund sentence while the calculator still returns refunds. If the owner now intends no refunds for equal pools too, define the no-eligible recipient/count/distribution rule explicitly and version it before implementation. No blanket no-refund ACC rule was established by this audit. Existing no-money rehearsal and no actual refund execution are not proof of a general no-refund policy.

## Back navigation diagnostic

Executed `node --experimental-strip-types test-results/q-policy-back-audit.mjs` against a disposable localhost Next app with actual `QPolicyClient`, `RecoveryDocumentBoundary`, recovery coordinator/worker and fictional source fixture. All network requests restricted to localhost, policy POST count zero, task server cleanup confirmed.

- Actual ordinary anchor navigation followed by browser Back created a fresh ready document here (`pageshow.persisted=false`); the reported failure was not reproduced on that path.
- Dispatching a persisted-restoration lifecycle event to the actual coordinator reproduced the safety state: `acc-recovery-frozen`, live app hidden, reload shield shown. This is controlled lifecycle simulation, not proof Chrome used BFCache in the user's incident.
- Local reload reacquired a ready document without clearing data. Explicit Back to policy anchor also returned ready.
- Source: `recovery-write-coordinator.ts` pagehide/pageshow lines 455 onward intentionally freeze cached-restored documents; `globals.css` hides live app under the shield; `layout.tsx` supplies 'This saved page is paused ... Reload ... Do not clear pending data.'

Exact diagnostic gap: which link, whether browser Back or in-page Back, and actual resulting message were not established. A cached-document shield, unknown finance mode, unsupported pre-finalization scope or another failure must not be conflated. No hosted inspection/retry was performed. Do not remove the safety guard or clear data. Any navigation recovery UI change needs its own tested scope and approval.

Evidence: `test-results/q-policy-back-audit/audit-result.json`, `actual-back.png`, `persisted-restore-shield.png`, `server.log`; process exit0 and localhostClosed=true. This audit requires no migration/publication.
