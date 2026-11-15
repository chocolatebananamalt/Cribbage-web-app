# Satellite financial entry isolation; remaining funded event gaps — 2026-11-10

## Inspection

The native recorded-finance assembler and playoff-recipient model already accept Main/Consolation, with strict source/version/event binding and the currently proved four/five-qualifier domain. This does not establish a funded Consolation end-to-end run: earlier two-event proof retained a zero-enrollment Consolation. The mixed-rehearsal Results projector and Main finance getter deliberately remain Main-only. Their guards were not relaxed or renamed into unsupported Consolation evidence.

Satellite has an existing manual results/report package, while its Sheet formula module remains an amount-only comparison, not operating recipient/fund accounting. The manual results UI had concrete financial isolation defects: unfinished prize/Q/Side/evidence input carried to another event, unsaved rows/notes could be discarded without warning, and only a combined award total was shown. These can be corrected without choosing a payout formula.

## Actual app changes

- Event changes require confirmation when there are unsaved rows, special hands, notes, amount/evidence fields or manually edited entrant/name. Cancel preserves the original draft; confirmation loads the selected event and clears all four unfinished amount/evidence fields. Invalid event IDs and in-flight switches do nothing.
- Existing event query URL follows explicit selection (normal router.replace, scrollfalse), so a later saved-result refresh returns to that event.
- A synchronous flight guard blocks duplicate save, event change and placement-add while a request is in flight; a disabled fieldset covers the normal controls. Live ownership blocks old save callbacks after unmount.
- Server page hard-keys ownership by tournament, actual actor and actual role. Same-owner updates compare only the selected event basis: an unrelated Satellite change preserves typed work; selected-event drift preserves local data, blocks editing/saving and offers explicit Reload Current Event with dirty-discard confirmation. Old unmounted responses cannot set status or refresh the replacement page. No additional read or access expansion; role filtering is unchanged.
- Separate **entered** regular-prize, Q-Pool and Side Pool totals plus combined entered total. BigInt addition detects unsafe aggregates; invalid amounts remain unavailable. Disclosure explicitly says these are not proof of collected funds, funded obligations or payments. No total is advertised as available funds. Existing optional blank amount parsing and legacy denomination handling are unchanged.

## Verification

Six focused tests pass: two new amount-summary groups and four existing legacy handler/denomination/replay tests. TypeScript/scoped lint pass after adapting BigInt construction to the existing target (no tsconfig change). Actual React offline about:blank390/1440 tests pass cancellation preservation, confirmed clearing, separate amounts, pre-commit held event switch/duplicate save (only one exact SatelliteB request), known rolled-back denomination rejection retainingB, unrelated-event refresh preserving typed B work, selected-event drift holding fields/save until explicit cancel/confirmed reload, actor/role remount hiding the former draft, old unmounted save callback and late completion blocked and0network. The test uses fictional records, fake router/fetch/UUID and conservative harness CSS, not live auth, real Next navigation or full app visual acceptance. Existing legacy localhost browser test was NOT run; denied navigation was not retried/bypassed.

Evidence: `test-results/satellite-event-isolation-20261110/result.json`, screenshots, tests/type/lint logs and source manifest. No new database, fixture, Main/Con simulation replay or SQL/API writer changes.

## Remaining funded work and honest limits

This is the first bounded correction to existing Satellite accounting/result entry, NOT funded Satellite awards. Need an authoritative event-scoped current fund source, receipt/cost/income review, separate optional-pool funding/eligibility and audited unpaid-award reconciliation before these amounts can be called funded awards. Do not derive the fund from count×fee or borrow optional-pool money. Satellite single-recipient/low-fund/tie/baseline/recipient-limit questions remain explicitly blocked in its comparison; no new ratio minimum, cutoff, split or rounding policy was adopted.

Funded Consolation needs a populated, current Consolation qualification/playoff-to-Finance/final-award proof and appropriate results read wiring. Generic source support or a zero-entry sibling is not that proof. Existing Main evidence is not transplanted by changing its kind label.

Legacy Satellite save/unknown-outcome recovery and real-provider account/session behavior were not replaced or proven here. In-flight duplicate prevention is not durable exact-operation recovery; do not call the full tournament financially ready. Real server refresh/navigation/source-key behavior also remains provider acceptance. Historic result amounts/receipts unchanged. No payment/disbursement, MRP or qualification effect was added. No hosted action, access activation, public upload/publication retry or dependency audit occurred; full pnpm verify unavailable.
Independent final source review: GO for this bounded entry-isolation patch, no new funding/math/authorization blocker. Dirty free-form entrant/name and overly broad workspace-remount issues were corrected before final source review; unknown legacy outcome recovery is explicitly outside acceptance.
