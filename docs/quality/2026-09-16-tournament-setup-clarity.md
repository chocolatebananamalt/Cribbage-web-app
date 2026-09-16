# Tournament setup clarity and post-finalization layout — 2026-09-16

## Acceptance criteria

- Phone and email labels are each one non-wrapping inline label with only the
  visible asterisk red; their inputs remain programmatically required.
- The sanctioning-fee total refreshes its server-derived eligible Main and
  Consolation count every 15 seconds while visible, on focus, after relevant
  completed director actions, and on explicit request. It must not alter an
  unsaved setup draft or rate input.
- The rate control warns that ACC Board approval is required before Start Play
  and preserves the existing immutable reason/reference audit and post-start
  lock.
- Registration QR/URL management is a visually full-width primary action after
  finalization. Exceptional post-finalization administration is separate and
  explicitly warns that it neither starts play nor erases or rewrites records.

## Executed local evidence

Environment: Windows, repository worktree, Node/pnpm project toolchain.

| Check | Result |
| --- | --- |
| `pnpm exec tsc --noEmit` | Passed |
| `node --test tests/sanctioning-fee-clarity.test.mjs tests/setup-amendment.test.mjs` | Passed: 10/10 |
| `git diff --check` | Passed |
| `pnpm verify` | Passed: dependency audit, lint, 526/526 application tests, provider-readiness check, production build, and workspace/recovery checks. |
| `pnpm verify:handoff` | Passed: 6/6 local private-handoff checks. |
| Production release | PRs #67–#71 passed their GitHub verification and Vercel preview checks. Final merge `c900186f35df9f9a665c3f2142727d5e55809a79` deployed READY as `https://cribbage-web-emz9224pt-cribbage-app.vercel.app`. |
| Browser phone review | Passed in external Chrome at 375px: `scrollWidth` = `clientWidth` = 360px, no elements exceeded the content width, required labels were `nowrap`, and the QR action matched its parent width. |
| Browser desktop review | Passed in external Chrome: the two labels remained one-line and the full-width QR action matched its 654px parent. |
| Browser error review | Passed: no captured production console errors. |
| Stable-root HTTP smoke | Passed: `https://cribbage-web-app.vercel.app/` returned HTTP 200. |

## Behavioral safety checks

- The auto-refresh uses the existing read-only setup endpoint and accepts only
  its derived participant count. It never applies the returned setup payload,
  so active edits stay intact.
- A background refresh failure preserves the last confirmed total and does not
  emit a disruptive retry error.
- The rate values remain distinct editable draft state. Saving or applying a
  valid override remains the only route that changes them.

## Release limitation

The deployed protected director form has now passed one external-Chrome
phone/desktop layout review. That does not replace the scheduled independent
multi-device physical rehearsal or prove the tournament workflow end to end.

## Follow-up responsive finding

The first Production review at a 375px viewport exposed a horizontal scrollbar.
The specific cause was the browser's default `fieldset` min-content sizing
within the nested Setup workspace; it made the 278px grid child reserve a
365px field width. The first correction allowed the containing workspace
fieldset to shrink, while the next live check identified the identical default
on each nested event-card fieldset. Both are now explicitly `min-width: 0`.
The last inspection then isolated an implicit auto-sized event-card grid track
that preserved a select option's min-content width. The event card now uses
`minmax(0, 1fr)` and static regression assertions cover all three constraints.
The next live check found that nested Q Pool/Side Pool fieldsets and their
internal label grids still retained auto minimums. The final rules constrain
the nested grid, pool fieldset, and label grid to `minmax(0, 1fr)` with bounded
widths. After final deployment, the 375px review found no remaining overflowing
element and no horizontal document scroll.
