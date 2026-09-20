# Tournament Setup layout cleanup evidence

## Acceptance criteria

- The Director-information explanation occupies a full-width row above its
  fields and cannot stretch or squeeze First/Last name inputs.
- Venue State, Time Zone, Director First name, and Director Last name have the
  same height as all other single-line Tournament Details controls.
- Wide desktop keeps Director First/Last/Phone/Email in one compact row;
  screenshot-sized tablet layouts use two balanced rows; phones stack safely.
- Mailing Address for Correspondence uses the full panel width.
- No tested viewport has horizontal overflow.

## Executed checks

- `node --test tests/setup-workspace-ui.test.mjs` — 6 passed, 0 failed.
- Headless Chrome visual and geometry checks at 1200, 760, and 390 pixels —
  all 13 single-line controls measured 46 pixels; the Director help block ended
  above the field grid; horizontal overflow was false at every width.
- Visual inspection of the three screenshots confirmed the wide one-row,
  tablet two-row, and phone one-column layouts.

## Release verification

- `pnpm verify` — passed: 736/736 application tests, dependency audit, provider
  readiness, optimized Production build, and workspace checks; lint retained
  two existing warnings and zero errors.
- PR #120 passed both GitHub Verify jobs and Vercel Preview, then merged as
  `8f1d70734c93c4bea0a09e7d85931becb4b32960`.
- Production deployment `dpl_8z1uYMMxMUTfc6BqNDFqiGDLXwLM` reached READY and
  received the stable `cribbage-web-app.vercel.app` alias without error.
- Stable `/sign-in` and `/register` returned HTTP 200. The stable Production
  stylesheet contains the fixed 46-pixel field rule and the isolated
  `display:block` Director panel rule.
- The thirty-minute Production runtime-error cluster and error/fatal log scans
  were empty.

## Remaining evidence

The in-app browser was signed out during release verification. The owner must
refresh the protected Setup page in their authenticated session to confirm the
real tournament values visually; no credential was requested or entered.
