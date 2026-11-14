# Event settings recovery — isolated local prototype

This is an unwired controlled panel and dependency-injected handler factory.
There is no production route/provider client, new grant, root setup wiring,
database write or payment integration in this slice.

The panel receives the entire V3 envelope, explicit capability and injected
recovery/transport ports. Capability false shows unavailable and no Save. Raw
canonical recovery retains the actor, operation and entire request. Duplicate
clicks share one in-flight operation. Unknown outcomes and retry responses retain
the exact request; known rejection is labeled rejected and also retained.

Operation lookup is GET-style with only an operation ID. Its immutable record
retains actor/tournament/operation/full envelope/outcome even on rejection or
retry. Local decode compares its own retained request before considering cleanup.
Accepted responses require complete canonical acknowledgement equality with a
matching readback, including the association hash. Clear is compare-and-clear
against the exact raw request. Actor/tournament/capability unmount uses layout
cleanup so late replies cannot clear recovery or call confirmation in an old scope.

After confirmation the mounted panel locks until its host supplies a validated
fresh source and new operation ID. It never invents a source digest or operation.
The host must load fresh authenticated workspace state on a future page load;
there is no provider-backed reload/activation contract here. The host must also
coordinate shared recovery writers across documents. The injected test port is
not evidence of production cross-tab storage safety.

## Executed checks

- Ten focused handler groups passed, covering gate/origin/access/bounds, exact
  V3 envelope, historical replay without freshness prefilter, role rechecks,
  source-pinned workspace, full operation records and unknown response retention.
- TypeScript and focused ESLint passed on the integrated local source.
- Isolated browser acceptance passed at 320 and 1440 px with 100%/200% text,
  keyboard actions, duplicate clicks, lost response/reload, exact retry, operation
  lookup with ID only, changed recovery/readback mismatch, association mismatch,
  late actor/capability replies, and fresh-source gating after confirmation.
- Browser storage is synthetic sessionStorage in isolated contexts. Callback
  “server” responses are simulated. No real application API writes occurred.
- Initial sandbox readiness GET returned EACCES. Supported scoped escalated
  runs proceeded. A fixture heading overflow and browser-storage hydration
  mismatch were diagnosed and fixed before final acceptance.
- Final run: `test-results/event-settings-recovery-panel-browser-final5.log`;
  receipt and screenshots under `test-results/event-settings-recovery-panel-browser/`.
  Task-owned server PID 14696 exited; exact-PID absence checked afterward.

## Remaining limits

Terminal rejection has no edit/discard workflow in this prototype; recovery stays
locked for review. Real provider identity, API transport, durable server readback,
cross-device concurrency and production browser/storage integration are not
proved. This is not activation, financial-ledger or payout authority. Root setup
and historical declarations remain unchanged.
