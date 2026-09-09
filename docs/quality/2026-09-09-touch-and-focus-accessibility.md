# Touch-target and keyboard-focus accessibility repair — 2026-09-09

## Scope

Address measurable accessibility requirements discoverable by style inspection:
minimum 44 CSS-pixel primary touch controls and visible keyboard focus.

## Acceptance criteria

1. Frequent sort and event-tab controls meet the 44-pixel minimum.
2. Score-entry winner and keypad controls retain their 56-pixel minimum.
3. Keyboard navigation has a visible focus treatment for buttons, links, and
   form fields.
4. The style contract remains covered by an executable regression test.

## Implemented changes

- Raised seating sort controls from 38px to 44px and event tabs from 42px to
  44px.
- Added an explicit 3px, offset, high-contrast `:focus-visible` outline to
  buttons, links, inputs, selects, and textareas.
- Added a static regression test for those controls and the 56px score-entry
  winner/keypad requirements.

## Executed evidence

- `pnpm lint` passed.
- `pnpm test` passed with 78 tests.
- `pnpm build` passed.
- `pnpm verify` and `pnpm verify:handoff` passed.
- `git diff --check` passed.

## Limit

This is code/build evidence, not an accessibility certification. The required
authenticated browser checks at 320/375px, desktop, 200% zoom, keyboard, and
screen-reader remain open until a safe independent test-account environment is
available. The change is compatible with the requirement; it does not claim
that those required user tests have occurred.
