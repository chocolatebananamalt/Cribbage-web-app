# Playoff section and input-label consistency — local checkpoint

## Acceptance and scope

The owner requested a Playoff section after Fee Includes and before Payout
Information, containing match-series settings, regular-event Payout Type and an
editable Increment Factor (default 1.5). Existing comments and inactive draft
values must survive switches. Main/Consolation Custom paid places never change
qualification. A separate semifinal format is not enabled without sourced rules.

The owner also requested consistent input-label capitalization throughout the
app. The separate literal-only inventory records 204 caption/accessibility edits
in 65 TSX files, with affected tests updated. Dynamic data, full-sentence
attestations and deliberate instructions are excluded, not runtime transformed.
See `2026-11-04-input-label-title-case.md` and its JSON manifest.

## Implemented and tested locally

- Controlled EventPlayoffParametersEditor and strict raw-draft resolver; no API,
  storage, save, approval, result or payment authority.
- Same-round versus separate Final controls preserve the inactive Final draft.
  Independent review found a hidden incomplete Final blocking Same mode; fixed
  and regression tested. Review confirmed closure, 11 event/series tests passed.
- Payout modes retain separate ratio/Top text and factor across switches. Custom
  paid-place calculations remain blocked pending cutoff/tied-band policy.
- Local composition demonstrates Fee Includes → Playoff → Payout Information;
  existing fee/comment values retained through interactions.
- Both Playoff browser harnesses passed at 320/390/768/1440 pixels and 100%/200%
  text enlargement. No non-GET requests or local/session storage writes.
  Screenshot pixels inspected at 390 normal and 320 enlarged. Native select
  text can truncate in its closed control at extreme enlargement; options remain
  available through the native select. No document horizontal overflow.
- Initial enlarged harness heading overflow was diagnosed and corrected in the
  harness container; it was not a saved-event defect. Servers on 3359 and 3361
  were confirmed absent after completion.

Evidence: `test-results/event-playoff-parameters-browser/result.json`, screenshots,
and `test-results/playoff-series-editor-browser/result.json`.

## Exact remaining limits

The new Playoff section is deliberately NOT wired into the live setup editor.
Current setup save has no compatible transactional contract for these new
series/regular-prize fields. Displaying editable fields there now would imply
they save when they do not. Old declaration controls and immutable history stay
in place until the replacement is durably integrated. Separate Finance remains
a reviewed design/model checkpoint, not a completed ledger UI.

Custom Q draft SQL/runtime acceptance is prepared but unexecuted. Side custom
activation/accounting, Satellite distribution, amendment compatibility and public
provider acceptance remain incomplete. No database fixture, SQL, hosted reads or
writes, migration, publication, invitation or money movement occurred here.

## Final integrated verification

`pnpm verify` exited 0: production dependency audit clear, ESLint zero errors
(97 existing warnings), 1,491 application tests, provider readiness check,
production build and eight workspace checks passed. `verify:handoff` equivalent
local command passed six checks. Logs:
`test-results/title-case-playoff-final-verify.log` and
`test-results/title-case-playoff-final-handoff.log`.

These results do not prove unexecuted SQL, provider acceptance or the pending
durable integration. No deployment was attempted.
