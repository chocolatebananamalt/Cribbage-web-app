# 2026-11-10 Late Consolation add-on payments — private backend checkpoint

## Outcome

Implemented an event-bound additional receipt stream. A valid original Main receipt is not voided, replaced or edited. The selected full-fee ordinary-digital path passed locally:18 original Main receipts remain54000minor;16 later Con receipts add16000minor; Con16/$10 entries less1600sanction and400printing produce14000 unpaid awards5500/3500/2500/2500. Same actual Con Start/72qualifying games/4qualifiers/3playoff matches and source-bound final record/reconciliation passed. No real payments or bank evidence.

This is PRIVATE/default-off backend work, not a mounted Director payment screen or real-provider acceptance. No hosted changes, new public grants, publication or access activation occurred. Do not add these working-tree dependencies to the paused/frozen public upload without separate review.

## Implementation / data preservation

- New private proposal: database/proposals/consolation-addon-payments-v1.sql. Two forced-RLS immutable tables: explicit event scope and unique event/roster receipt with a separate durable charge stream. Existing app.operation_receipts actor/nonce namespace, exact request hash, audit and historical reconciliation are reused.
- Requires the correct active linked Main, current qualification/eligible loss or nonqualification, event enrollment, current full published Con fee and a current full Main-only base receipt/classification. Cash/check acceptance is captured at receipt time using the established method configuration/trigger; later method changes do not erase valid receipts.
- New tagged native source contract has addonBindings and independent history kind/charge heads. Main-only base eligibility and Con-only addon eligibility plus conservation prevent reclassifying Main money as a second Con payment. Existing source output remains unchanged with no addons. New-source capture reserves complete source inputs and advertises locked_source_snapshot.
- New event-specific paid check accepts a real addon or genuine combined prepayment covering BOTH full Main and Con fees. It never infers Con paid from Main30/30 alone. The Finance consumer also requires strict scoped-event paid proof for every active entrant, closing an allocation-only bypass.
- Main base receipt void/replacement and obligation rewrites are blocked after an addon until an audited correction path exists. Reciprocal income evidence guards prevent receipt/income aliasing. Workspace explicitly separates base receipt/legacy obligation, this Con prepayment/addon, all additional receipts and total recorded receipts.
- src/lib/finance/consy-addon-source-contract-v1.ts and native-ledger-allocation-plan-v1.ts enforce typed stream/scope/event/roster identities; operational-finance-source-adoption-transport-v1.ts accepts only the explicit validated source domain. All capabilities remain false.

## Evidence

Integrated path: test-results/late-consy-2026-11-10T06-36-27-584Z.
- Restored exact fictional Main-only checkpoint d3ca6de1... with no Main replay.
-16 later receipts (15cash,1check after methodconfig change), no duplicate for a second operation; exact historical replay including gate-off; shared legacy-operation nonce conflict; Main void rejected; income alias rejected; typed34receipt planner and allocation pass; Main30→20/Con10 reallocation rejected after addons.
- Original payment AND obligation rows equal prior JSON snapshots. New workspace proves30base/10Con/40total per entrant. Normal Con play and unpaid14000 final accounting/reconciliation pass.
- Run exit0; DB/container removed, absence byID/name verified. The subsequent Finance paid-consumer wrapper was verified in the focused guard phase below, without replaying games.

Final focused guards: test-results/late-consy-guards-2026-11-10T07-06-27-841Z (trace.json, cleanup.json and late-con-finance-bypass-rejected.json).
- Default-off, forcedRLS2tables and private execute ACL for anon/authenticated/service_role pass.
- Direct writer wrong-role denied; injected failure AFTER generic accepted nonce creation leaves no receipt/operation, then exact retry succeeds.
- Observed overlap: first writer paused inside insertion; competing actor getsretry_exact; first commits once; retry getsalready_recorded, with one physical receipt.
- All16 Main30 receipts deliberately reclassified20Main/10Con in a fictional reviewed allocation demonstrate old Finance delegate source_available, but strict Con paid false and new Finance source blocked(consy_event_payment_unverified). Classification restored before addon tests. This tests the actual allocation-only bypass, not just a partial unpaid field.
- A separate restored genuine combined40(Main30+Con10) checkpoint remains Con-paid/Finance-available and rejects another addon. No gameplay replay.
- Both sequential disposable databases and container removed and verified; run exit0. No real data or sessions in checkpoints.

Final source review GO: SQL SHA50038fd3e77847f58766b7ac36aef92c75529d87c265269e5dad171ed735a3b6; typed contract SHA53be0e44f767f9d9015243f2f4457fb6487ca633ca284de68f7c5cb0287f85bb.28 focused source/transport/handler/receipt tests pass, TypeScript and scoped ESLint pass. Full pnpm verify unavailable/not claimed; denied audit/browser operations not retried.

## Remaining gates / limits

- No mounted Director form, new public authenticated receipt RPC/HTTP adapter, signed-in provider/device acceptance or hosted installation. Existing base-only payment UI must not present its30subtotal as the combined40 total or suggest voiding Main; wire the new split workspace before any activation.
- Selected support is full-fee standard-singles native/nonmixed linked Con. Partial/discounted/waived entries, receipt voids/corrections, scope/price amendments, mixed-simulation funding and existing optional-pool allocation evidence remain unsupported/fail closed. No refund policy introduced and no ACC numerical event limit imposed.
- Main payment/obligation/qualification/series history remains; a new global allocation revision can legitimately require re-review of Main's earlier Finance proposal. Simultaneous current finalized Main+Con awards and post-final amendments are not proved here.
- Physical play, separate humans, bank reconciliation and real transfers remain unproved. Stored awards are unpaid, with no payment authority.

