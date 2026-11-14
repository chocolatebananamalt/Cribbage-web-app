# Setup payout control checkpoint — local only, 2026-11-04

## Latest approved presentation

Preserve existing Q-Pool, Side Pool and Satellite dropdown presets and add `Graduated 1-in-# (Custom)` for Q/Side and `1-in-# (Custom)` for Satellite. Only Custom exposes the director's initially empty `Payout 1-in-[ ]` required numeric input. Remove unsupported Equal Side Pool choices; retain both supported Q Equal choices and any saved Equal Q selection. No new operating payout policy is selected by these UI changes.

## Actual downstream support

- Side setup canonical values remain 1-in-4/6/8/10. The shared calculator and operating Side policy accept an implementation range of 2–100, but multi-event setup/synthetic accounting still restricts the four presets. Thus 1-in-7 is not an accepted end-to-end setup/accounting path.
- Q setup canonical presets remain 4/6/8/10; operating Q v4 graduated methods cover 4/6. Existing setup options do not prove complete operational support for every ratio.
- Satellite payout text is advertised configuration, not a verified automatic arbitrary-ratio award calculator. No Top 4 equal/graduated split is inferred.
- Custom entries matching existing presets save their existing canonical code/text. Other entries visibly block fresh saves. Pending exact retries retain their original request and remain recoverable.
- No business/ACC minimum 2 or 4, nor maximum 100, has been approved. These are not new policy limits.

Full arbitrary-N support remains unfinished: versioned setup serialization, intent validation, operative methods/recipient calculations, declarations, accounting snapshots and financial reconciliation must agree, with approved numeric validation and local database/provider acceptance. Do not present the Custom selector as completion of that work.

## Other setup fixes

Two equivalent save/retry controls share one operation state and single-flight behavior, one after event editors and one below Officials. Officials precede the less-used sanctioning editor. Satellite insertion is after the last Satellite. Main removal remains safely guarded without the unrelated warning appearing merely when Consolation Yes is selected. Required existing prize declaration controls remain; wording distinguishes setup parameters from later funded final awards. Workbook-based replacement presentation and registration-linked estimates are not yet implemented.

## Preservation and boundaries

No hosted records were read or changed. The user's $50 saved draft, selected Equal Q and historical fixtures were not modified by this work. No deployment, migration, new database fixture, invitations or payments occurred. Separate reviewed-seating SQL proposal remains unexecuted and must not be included in a UI-only release.
Latest label correction: Side Pool visible main heading is `Payout`; Q-Pool visible main heading is `Pool Type`. Satellite remains `Payout`. This is presentation-only; the adjacent Custom input and eligibility/calculation boundaries are unchanged.
