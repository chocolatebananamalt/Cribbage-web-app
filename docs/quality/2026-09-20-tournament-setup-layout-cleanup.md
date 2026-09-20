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

## Remaining release checks

- Run `pnpm verify` from the final diff.
- Pass reviewed GitHub checks, merge, deploy to Production, inspect the actual
  signed-in Setup page, and scan Production runtime errors.
