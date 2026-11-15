Update: new-client completed archives now retain a checkpoint with unit/offline fresh-instance proof. See [current checkpoint evidence and limits](2026-11-06-finance-checkpoint-recovery.md). Legacy null records, actual browser storage/full navigation and authenticated provider acceptance remain open. Earlier same-instance-only limitations below are historical, not a claim that legacy/full reload is solved.

Update: the two original races have now been reproduced and fixed in an independently reviewed offline React test, scoped to a reused operation instance. See [current evidence and remaining gates](2026-11-06-finance-offline-recovery-fix.md). The earlier denied localhost attempts and unit-only assessment below remain historical evidence; localhost access, new-instance/reload recovery and live provider acceptance are still not proven. The candidate remains disabled.

# Setup and Finance: focused review and acceptance plan

## What can be reviewed now

The [previously prepared Playoff layout image](../../test-results/playoff-prize-plan-v2-browser/playoff-prize-settings-review.png) remains the current visual review artifact. Its bytes were rechecked against the original SHA256 in this phase. This phase changes no layout, payout formula or product code. The image is a local proposal, not evidence that the app can save or pay these settings. The Main/Consolation settings and separate Finance source have substantial local groundwork, but the new integrated experience is not enabled or published.

Keep the existing saved tournament and any open unsaved form intact. No clearing, refreshing, replacing or re-entering that draft is part of this plan. Use fictional in-memory data for the following checks; do not use real receipts, people or payments.

## The next useful slice

Finish the existing Finance save/recovery screen before adding features. The sequence should be: prepare a proposal; Save Proposal to Server; resolve any uncertain save; verify the exact saved proposal; review the matching refreshed workspace. A saved proposal is not an approved award or a payment.

Two known source defects remain in the paused provider component:

1. During deferred readback, Check/Retry/Rediscover are not all guarded against an overlapping operation. Both disabled controls and held/stale handlers need protection.
2. Replacing workspace/editor props during verification can leave verification.busy latched. Simply clearing it is unsafe: if archiving already succeeded, the verified saved-head guard must survive so an old workspace cannot start another save. Never overwrite an editor changed in the meantime.

No production patch was made in this phase because browser execution was blocked before the behavior could be reproduced. The source diagnosis is strong, but runtime reproduction and a passing regression are still required.

## Focused acceptance script

| Check | Expected visible result and data protection |
| --- | --- |
| Prepare one fictional proposal with a reason; simulate one lost reply | Exactly one submission; message says outcome unknown; exact pending operation remains retained. |
| Check This Save once and receive a bound accepted receipt | Still one submission, one reconciliation. Accepted does not yet unlock another save. |
| Start Verify Saved Proposal and hold readback open | Check/Retry/Rediscover and editing cannot race it. Calling a captured old handler also makes no request. |
| Replace workspace/editor props while that read is pending | No archive or editor replacement from the old owner. Busy state is released for the current owner; pending work remains. |
| Verify again; pause archive; replace props; finish archive | If exact archive succeeds, retain its verified-head evidence. Old workspace remains blocked; do not call an old host callback over a changed editor. |
| Supply the matching refreshed workspace | A deliberate new save becomes available only when all head/source pins match and the current editor remains valid. |
| Reject/fail readback or fail archiving | No success claim, no extra submission and no pending-data loss. Retry/check remain possible after the active verification settles. |
| Switch account, event or operation owner during either await | Hide foreign values; no late callback, archive or new operation under the new owner. |
| Phone 320/390, tablet 768, desktop 1440; 100% and 200% text | Readable status/labels, no clipped actions or horizontal page overflow; keyboard operation and announced status. |

Count submissions, reconciliations and retained records independently. Do not calculate a new payout to test this recovery slice. Verify a literal zero override stays different from an absent override using the already existing Finance tests when that wider path is resumed.

## Executable regression harness and actual outcome

`tests/finance-provider-readback-browser.mjs` prepares a dedicated localhost app with fictional data and deferred read/archive controls. Its implemented assertions cover overlapping Check including a held callback, workspace replacement during read/archive, retained-head blocking, deliberate adoption of the fresh head, and four viewport sizes at two text sizes. Failure/account-switch cases above remain additional acceptance work; they are not claimed by this harness.

The harness is unverified. First, Node's localhost readiness fetch could not reach a Next server that reported Ready. A second readiness method used the server's Ready output and attempted the actual isolated Chrome page. That failed immediately with `page.goto: net::ERR_NETWORK_ACCESS_DENIED at http://127.0.0.1:3397/`. No product assertion or screenshot ran. Stop there: no proxy, host substitution, alternate transport or security-setting workaround was attempted.

The owned headless browser/server were closed in finally. No Node process remained on the subsequent normal process check. Only the dedicated generated app's .next cache was removed after checking its absolute path. Generated TS files were frozen as non-source .frozen evidence to keep them out of the app build. No user tab, account, database, hosted record or payment was accessed. Harness syntax check passed; that is not behavioral proof.

## Readiness and next gate

Ready: a precise small recovery slice, existing review image, executable fictional-data regression harness, and explicit test criteria. Not ready: the paused recovery UI, database-backed new settings/Finance save path, calculated/final awards or a weekend money event.

First unblock supported local browser access and execute the regression, then make the narrow recovery fix and repeat the relevant UI checks. Independently, the database writer/guard candidates still require separately authorized isolated PostgreSQL acceptance and real signed-in provider tests. Rounding and first-round fee-comparison decisions remain calculation gates. No publication or hosted migration is authorized by this plan. The denied dependency audit remains incomplete and was not retried.

Independent review confirmed the scope and blocked status. Its harness wait was tightened to the specific Verify Saved Proposal button; this was a source-only correction, not a browser rerun.

## Follow-up: source and existing unit-test assessment

Twelve existing non-database tests passed in `finance-provider-operation-v1.test.mjs` (8) and `operational-finance-provider-ui-v1.test.mjs` (4). They test real operation-class behavior and projection guards: exact retention before sending, lost replies, immutable retry, foreign/stale inputs, current-head archive requirements and no award/payment authority. They do not import or mount EventFinanceProviderSectionV1 and therefore do not verify React lifecycle behavior, rendered disabled states or held onClick handlers.

Source confirms both defects at the owning UI layer. During a pending read, a changed workspace/editor reference makes current()/sameOwner() false. The finally block clears the ref but conditionally skips clearing React verification.busy, which remains the edit/button gate. Separately, Check/Retry/Rediscover use snapshot.busy and current() but do not gate the independent verification run, so the operation snapshot can change while readback is pending.

A safe fix must scope each verification run to its owner, stop overlapping recovery actions at both rendered-control and handler levels, and release a stale run without touching a newer run. It must also preserve verified-head evidence if archiving succeeded while props changed. Simply clearing busy on every prop change could unlock a stale workspace after archival; replacing the editor or discarding its pending record is not acceptable. No change is needed in payout math or database policy to test this.

The existing dependencies do not include react-test-renderer, jsdom or @testing-library/react. None was installed. Adding an artificial state model or source-string assertion would not prove the component fix, so no such substitute was added. No production edit was made and no browser/network retry occurred. The exact gate remains supported isolated Chrome navigation to the local fictional-data app at http://127.0.0.1:3397/, which previously returned ERR_NETWORK_ACCESS_DENIED before any assertion. This does not require a database fixture, hosted data or a payout decision. Execute the prepared deferred read/archive tests, make the narrow UI fix, then pass phone/desktop and stale-owner regression checks before enabling or publishing anything.

Evidence: test-results/finance-recovery-unit-assessment.log and finance-recovery-unit-assessment.json. Production component SHA256 was checked against the prior preserved checkpoint and is unchanged.
