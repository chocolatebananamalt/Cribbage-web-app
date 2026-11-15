# Flyer connection to saved Playoff, prize and pool choices

Local implementation, 2026-11-10. No hosted action, SQL execution, grants, database fixture or rejected-operation retry.

## Connected fields

The flyer page now uses the existing normal-user, gated `createEventPrizeRpcV1(...).workspace()` reader where its existing Setup project admission permits it. The new projection accepts that workspace only for the same actor, tournament, exact saved setup revision/version and complete Main/Consolation event IDs/kinds. The existing workspace decoder also validates settings/prize snapshot IDs and digests, history/absence states and non-authority flags.

For supported saved rows, the flyer shows regular/final match series; requested paid places; the selected Graduated, Equal, Winner Multiplier or Winner Takes All method; the stored factor/multiplier where applicable; and independent Regular/Q/Side rounding choices. Winner Takes All shows Winner Only. Plain Equal and Winner Takes All do not inherit stale first-round comparison fields. Graduated/Winner Multiplier comparisons remain explicitly conditional on first-round losers actually being paid and still require final field/fee-reference review. No amounts, actual recipient counts, qualifying choices, funded awards or ACC approval are inferred.

The existing saved Custom setup source has authoritative ratio/slot data but no suitable public flyer reader. `database/proposals/setup-flyer-custom-pools-v1.sql` therefore proposes a minimal read-only wrapper around that existing private source. It returns current base revision/version/digest, column-backed event/scope/slot/ratio intents and Side preset/custom fields. It excludes retained full requests, contact data, names, internal Side-version IDs and financial results. Current role/revision locking is delegated to the existing private reader. A new false gate and revoked EXECUTE permissions keep this proposal unavailable; it has not been installed or executed.

The flyer’s Custom adapter also has a literal false gate. When a verified DTO is eventually available, it requires the same actor/tournament/revision/version and shared source digest, unique event/slot bindings, actual existing pools, Q/Satellite wording compatibility, reciprocal Side ratio records and complete Side-method coverage. If the base setup supplies a Side preset, it must agree exactly with the DTO and cannot be replaced by a Custom ratio. Any conflict withholds the complete Custom-method projection, preserving base setup wording and a visible review warning. No joining by names, fee amounts or array positions is used.

Custom Q/Side ratios and existing Side presets render beside their particular pool. A saved Satellite ratio is labelled an intent whose distribution requires separate review. Missing, legacy, invalid or stale settings remain explicit warnings on screen and in print. The draft/version and no-disbursement context remains unchanged.

## Files

- `src/lib/setup-flyer-saved-policies.ts`: validated cross-source projection, no calculations or writes.
- Existing `src/lib/setup-flyer.ts`: optional public display fields only.
- Existing flyer component/page: render verified descriptions and use the established prize reader; Custom reader stays off.
- `database/proposals/setup-flyer-custom-pools-v1.sql`: two proposed functions, no table, replacement or grant.
- `tests/fixtures/setup-flyer-saved-policies.mjs`, `tests/setup-flyer-saved-policies.test.mjs`, `tests/setup-flyer-policies-browser.mjs`.

## Focused evidence

Ten combined source/model cases passed (six new plus four existing flyer cases): exact saved choices, all selected methods, conditional comparisons, missing/legacy source, actor/revision/digest mismatch, duplicate/orphan/numeric conflicts, incompatible Side presets and unchanged privacy/date behavior. TypeScript `--noEmit` and targeted ESLint pass.

Independent source review found one preset-consistency defect: a DTO could override a different preset explicitly present in the base setup. It is fixed, with matching/mismatching preset and preset-versus-Custom regression cases. Re-review GO. Model reviewed before the final warning-only text clarification: SHA256 `13a19910b934eaf46ab616f7a0e8b97f11cc2ec72c81a56c45084a802fb9cc67`. Current model SHA256 `53336bb6b4a6b846d2d1531e5b7937d898f705672b635cb3637842497857271a`; new SQL source SHA256 `e5e8c3438a210452f6bbed5eed4a01cd4f78cdd68f65160250713aa80ae4274a`.

Offline actual React at390px/200%text and1440px/normaltext passed saved-series/method/factor/rounding and Custom ratio display, unavailable-source warning without stale method reuse, draft/version reset, print-visible warnings and hidden controls, separate Satellite section, and no overflow/network requests. Print dialog was mocked; no PDF or real print was produced. Evidence/screenshots: `test-results/setup-flyer-policies-browser-20261110/`.

## Remaining gate

The existing prize path is wired locally but not verified against a real signed-in hosted page in this change. The new Custom wrapper requires separately authorized installation, permissions and runtime/provider verification before its literal gates can be opened. No database check was attempted; the earlier rejected stationary-registration test remains untouched. Full pnpm verification/audit was not repeated. This completes local projection/wiring where saved fields exist, not hosted enablement, payout calculation, final distribution approval or proof of disbursement.
