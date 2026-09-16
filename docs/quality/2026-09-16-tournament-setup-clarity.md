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
| Browser phone/desktop review | Pending production deployment; local external-browser verification is blocked by the host's localhost client policy. |

## Behavioral safety checks

- The auto-refresh uses the existing read-only setup endpoint and accepts only
  its derived participant count. It never applies the returned setup payload,
  so active edits stay intact.
- A background refresh failure preserves the last confirmed total and does not
  emit a disruptive retry error.
- The rate values remain distinct editable draft state. Saving or applying a
  valid override remains the only route that changes them.

## Release limitation

No protected director form or physical rehearsal result is claimed as passed
until the deployed build is reviewed in independent browser sessions at phone
and desktop widths.
