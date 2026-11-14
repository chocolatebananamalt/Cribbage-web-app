# Settings UI/transport, activation planning and ledger bridge — local checkpoint

## Implemented scope

- Disabled-by-default injected V3 HTTP handler factory, not production routes.
  Verified Director/co-director access and same-actor rechecks surround actions;
  POST is same-origin/body-bounded. Historical exact replay is preserved.
  Operation GET carries immutable actor/tournament/operation/full-envelope/outcome
  for accepted/rejected/retry results, with exact retained-request comparison.
- Controlled local recovery panel using the approved Playoff editor. Complete raw
  request retention, single-flight, lost-response reload, exact retry, ID-only
  lookup and full-acknowledgement readback precede exact compare-and-clear.
  Known rejection, busy and unknown have distinct truthful messages and retain
  work. After confirmation, edits wait for a fresh host source and new operation.
- V4 activation review plan binds current raw settings to reviewed drafts/pins,
  source/association and event-specific ACC context. Historical declarations stay
  on their existing strict path. No fabricated old weights bypass checks.
  ActivationAllowed remains false until the backend contract exists.
- Ledger projection requires a complete event registry, global pool ownership,
  unique physical sources, exact per-source event/fund conservation and current
  source agreement. Regular event funds exclude Q/Side money. Restricted or
  unreviewed income/expenses and negative funds require review.
- Native receipt/expense adapter uses current immutable source-event evidence,
  not advertised fees, and checks identity across all histories before selecting
  active heads. Void, duplicate, foreign and unallocated evidence blocks.

## Reviewed defects closed

1. Unknown event could become known-zero and pool IDs could alias kind/event:
   explicit complete event and pool registries now required.
2. Active receipt UUID could reuse another owner's voided history: history-wide
   canonical identity validation now precedes active-head selection.
3. Rejected operation GET lost full request binding: all known operation results
   now retain the immutable record; changed local bytes cannot use it for cleanup.
4. Passive scope cleanup allowed late old-actor callbacks: layout cleanup
   invalidates keyed scope before late completion effects.
5. Partial acknowledgement comparison omitted association hash: full canonical
   immutable acknowledgement agreement is required before clearing.
6. Repeated save could reuse an old source/operation: fresh validated host source
   and new operation are required after confirmation.

Independent focused reviews confirmed closure; no remaining P1/P2 in these bounded
pure/prototype contracts. This does not establish real provider or DB integration.

## Browser evidence

Mock-only browser passed at 320 and 1440 pixels, 100%/200% text, keyboard,
single-flight, lost response/reload, exact retry, mismatched lookup/readback,
association mismatch, changed retained work, late actor/capability replies and
fresh-source lock. Zero actual API writes. Screenshot pixels inspected, server
exited and port absence verified. See recovery-prototype report/result/logs.

The initial harness heading overflow and hydration mismatch were fixed before the
final run. This UI is a clearly labeled local synthetic transport; debug controls
are harness-only, not the proposed production director flow.

## Honest integration limits

No production route, client, grant, root setup replacement, hosted record or
publication was added. No new DB fixture/SQL execution occurred in this phase;
the previous approved disposable DB remains removed. Current-source/provider
identity/no-store composition, cross-document retention locking and terminal
rejection edit/discard workflow are unfinished. Existing historical setup without
a verified new snapshot fails closed rather than being treated as empty.

Per-event ACC duration/sanctioning/approval context needs authoritative persisted
data; gathering dates are insufficient. New activation writer and operational
settings bindings are not implemented. The ledger adapters do not establish an
actual ledger writer: event allocation ownership/membership, consistent source
reads, additional-income evidence, audit rebinding and disbursement remain
implementation gates. PaymentWorkspace must be fetched for this same tournament.
Posted digests/review booleans/IDs are not receipt authority.

Prepared next runtime scope is in
`../decisions/2026-11-04-public-settings-and-actual-ledger-integration.md` and
`tests/event-settings-v3-acl-carry-acceptance.mjs`. It is syntax-prepared, NOT RUN.
No new fixture may be created without separate approval.

## Final checks

`pnpm verify` exited 0 on the frozen functional source: 1,540 application tests,
six provider checks, production dependency audit, ESLint (zero errors), production
build and eight workspace checks passed. Six local handoff checks passed.
Logs: `test-results/settings-public-ledger-local-frozen-verify.log` and
`test-results/settings-public-ledger-local-handoff.log`.

One later copy-only correction replaced stale tied-group policy wording in the
leaf editor with the approved whole-group/warning rule. The final5 browser run
compiled and verified that copy at both widths/100%/200%, preserving all recovery
regressions and zero API writes. Its server exited and exact PID absence was
confirmed. No behavior changed after the full gate. Final evidence:
`test-results/event-settings-recovery-panel-browser-final5.log` and the browser
directory's `result.json`/screenshots. Older failed harness logs are historical.

Independent reviews cleared all enumerated P2s in the bounded models/handlers/UI.
No database/provider/actual-ledger acceptance is implied by these passing checks.
