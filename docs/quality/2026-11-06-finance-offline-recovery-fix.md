Update: new-client completed archives now retain a checkpoint with unit/offline fresh-instance proof. See [current checkpoint evidence and limits](2026-11-06-finance-checkpoint-recovery.md). Legacy null records, actual browser storage/full navigation and authenticated provider acceptance remain open. Earlier same-instance-only limitations below are historical, not a claim that legacy/full reload is solved.

# Finance recovery: offline component proof

## Authorized scope and acceptance

Local payout setup/Finance work only; no DB fixture/execution, hosted access, grants, publication, payment or denied audit retry. Fix the two identified UI races if they can be verified through a supported independent method. No payout policy decisions or calculations are changed.

Acceptance: reproduce the defects in the actual React component; disable and guard overlapping recovery handlers; release stale-owner busy state without clearing a newer run; preserve the exact fresh-head barrier after archival, including temporary remount with the same operation instance; retain pending work on read/archive failure; never invoke a stale editor callback. No network or denied URL access is part of these tests.

## Supported offline method

Installed Playwright documentation states setContent internally calls document.write. The test bundles only repository component/fixture code using already installed Next webpack and TypeScript, then injects it inline into a new isolated headless about:blank page. Context settings: offline:true, serviceWorkers:block, abort-all route, strict CSP default/connect none and inline-only script/style. Request listeners and URL assertions must remain zero/about:blank. No goto, server, proxy, route fulfillment, host substitution, security-setting changes, download or dependency install is used. The denied localhost address is never requested. This approach was independently source reviewed before execution.

The local test CSS loader scopes the two existing CSS modules without altering their declarations and rejects url/import rules. This tests real React component behavior with fictional in-memory operation/storage ports. It does NOT establish Next route/chunk/CSP packaging, real identity/session, HTTP provider, IndexedDB, backend permission or database correctness.

## Reproduction and narrow patch

Before edits, the full offline run failed at `Check must be disabled during readback`. A separate busy-only reproduction failed after a workspace clone and read settlement because Verify never became enabled (5-second timeout). Both observation receipts show about:blank, zero requests, zero page errors. These are product assertions, unlike the earlier localhost denial before assertions.

Changed production files:

- src/components/event-finance-provider-section-v1.tsx: run-owned busy cleanup, gates on both disabled controls and held handlers, detached fresh readback, exact archive proof, preserved head barrier and same-owner-only callback. No automatic editor replacement.
- src/lib/finance/finance-provider-operation-v1.ts: conservative in-memory reviewed-head gate, archive-in-flight latch across activation epochs, exact frozen archive success proof, and reinitialization after a deactivated archive settles. Pending/archive serialization is unchanged.

The class retains the guard even if archive fails or its acknowledgment is uncertain. Source drift remains blocked. The fixture/test is not evidence that any award was approved or payment made.

## Executed evidence

Command: node tests/finance-recovery-offline-browser.mjs. Final result: four widths 320/390/768/1440, each at 100%/200% text; held Check blocked; workspace replacement during read/archive recovered safely; stale workspace blocked after archive; matching refreshed head required; failed read retained pending; same-object React hide/show during deferred archive preserved the guard. All contexts remained about:blank with zero attempted requests/errors. Each owned context/browser closes in finally; no server is created.

Commands: node --conditions=react-server --experimental-strip-types --test tests/finance-provider-operation-v1.test.mjs tests/operational-finance-provider-ui-v1.test.mjs. Fifteen tests passed after adding three operation cases for same-object remount/stale save, activation-epoch archive proof/no overlap, and failed-archive exact-byte retention. The fresh-save fixture receipt version was corrected to expectedVersion+1.

Evidence: test-results/finance-recovery-offline/result.json; observations.json; finance-recovery-offline-reproduction.log; finance-recovery-offline-busy-reproduction.log; the two reproduction-observations snapshots; finance-recovery-offline-final.log. Native control screenshots at 390/100% and 320/200% were visually inspected: labels/actions are readable and wrap vertically without clipping. These are QA screenshots, not a newly approved Finance design or accessibility certification. Full-page samples still contain inherited Finance label encoding artifacts and the old fixture's zero-award warning; neither is a new payout calculation/approval or fixed here.

## Explicit limits and enablement gates

This proof requires the SAME operation object for the account/event across temporary unmounts. A new instance/page reload cannot currently recover an archived head from the write-only archive port. The component documents this strict host requirement. Do NOT enable based only on this test. Require a tested authenticated fresh workspace and durable archive-head/reload recovery before enabling, along with real provider/storage and database acceptance. Scope/account-switch and replacement-instance scenarios remain real host acceptance work; no claim they passed follows from same-instance tests.

The wider new settings/Finance transaction remains an unexecuted SQL candidate. Rounding allocation and entry-fee comparison policy remains unresolved; mathematics was not changed. Hosted rollout and grants require separate approval. The blocked localhost navigation and denied npm metadata-export audit remain outstanding and were not retried. Full pnpm verify is still incomplete at audit; local lint/application/provider/build/integrity components are checked separately with no audit invocation. Final outcomes are appended below and recorded in the checkpoint receipt.

## Frozen final checks

2,186 application tests passed, including the three new operation cases. Fifteen focused operation/projection tests passed. Full lint exit0 with119 existing warnings; changed-file lint exit0 with no output/warnings. Provider checks and production build exit0; workspace8 and private handoff6 passed. Final offline run is explicitly full mode and includes Enter-key activation of Verify at390px plus zero stale/unmounted host callbacks. The strict URL/request/error checks passed in all five contexts. Ten native QA screenshots (eight full-page plus two recovery-control crops) were preserved; the two control crops were visually inspected.

No database execution or real provider success is claimed. Full pnpm verify remains incomplete because its required audit was denied earlier; it was not invoked or retried here. No user tab, hosted tournament, identity/role assignment or money was changed. The owned headless browser contexts closed in finally; no local HTTP server was used.
