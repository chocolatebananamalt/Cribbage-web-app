# Youth ACC Number Support - Verification Record

**Status:** Production deployed; physical rehearsal evidence pending

## Acceptance evidence

- Migration `0210_youth_acc_number_support.sql` applied successfully after an
  initial immutable-history rejection identified and removed an unsafe
  historical-row update. Existing values are now derived without rewriting
  immutable roster or claim history.
- Read-only database checks confirm `HI296` and `HI296Y` resolve to the same
  internal identity key. Genesis Rehearsal's stored youth value remains visible
  and resolves to its adult identity key.
- Focused lint and 20 focused tests passed for shared validation, form
  normalization, CSV, manual roster entry, QR check-in, malformed values,
  duplicate identity matching, and migration safeguards.
- Full local `pnpm verify` passed: audit, lint, 551 application tests,
  provider-readiness check, optimized production build, and workspace check.
  `pnpm verify:handoff` passed all 6 checks.
- Pull request #93 passed its GitHub Verify and Vercel Preview checks, merged
  as `4f2743b55c8e79419642a4e049ba201ec7630ed3`, and deployed to Production as
  `dpl_EF9Jdqj5WLz6ZasVZHx9c86hCHFN` at
  `https://cribbage-web-app.vercel.app`.
- Production smoke test: `/register` returned HTTP 200 and its no-credential
  path showed the expected unavailable-link message without browser console
  errors. The Vercel deployment log window showed 0 warnings, 0 errors, and 0
  fatal events; the observed `/register` request returned 200.

## Remaining release checks

- Perform the physical rehearsal QR check-in with an enrolled youth-form test
  value at phone and desktop widths. This requires the still-pending safe
  roster ACC-number correction UI for the Genesis participants missing an ACC
  number; no roster record was invented, deleted, or rewritten for this
  release.
