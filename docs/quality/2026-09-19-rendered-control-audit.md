# Rendered control audit, 2026-09-19

## Why this exists

On 2026-09-19 the tournament director could not create a tournament. The
Tournament name and Planned tournament date fields rendered as 26 by 22 pixel
circles. Nothing was wrong with the handler, the API route, the RPC or its
grants. A single CSS rule written for checkboxes, `.policy-settings input`,
matched every input and shrank the text fields on 20 of the 21 forms.

Every existing check passed while this was true:

- 609 of 609 tests passed. They are source assertions and never render anything.
- `next build` compiled.
- An 18 agent audit traced 49 named buttons from label to handler to API route to
  RPC to grants and reported those same forms as correctly wired. It was right.
  The wiring was correct. The control was unusable.
- Playwright `fill()` succeeded on the field, because `fill()` focuses the element
  programmatically. A too small target is invisible to it.

The lesson: **green on wiring is not green on usable.** A control can be present,
correctly wired, and reachable, and still be impossible for a person to operate.
That class of defect is only visible by measuring real geometry in a real browser.

## What the audit checks

For every `input` (excluding hidden), `select`, `textarea`, `button` and
`a[href]` that is not `display:none` or `visibility:hidden`:

| Check | Why |
|---|---|
| Bounding rectangle after `scrollIntoView` | Catches controls shrunk below a usable size. This is the defect above. |
| `document.elementFromPoint` at the control's centre resolves to the control or a descendant | Catches a control covered by an overlay, a sticky header or a mispositioned sibling. It looks clickable and is not. |
| `pointer-events` is not `none` on an enabled control | Catches a control that is visible and sized but inert. |
| `documentElement.scrollWidth > clientWidth` | Catches horizontal overflow pushing controls off screen. |

Thresholds: text inputs, selects and textareas at least 36 pixels tall and 100
wide. Checkboxes and radios at least 16 by 16. Buttons at least 24 by 24. Inline
text links at least 14 tall and 24 wide.

## Result, 2026-09-19, against production, signed in as director

Twenty pages swept on the October 3 Pilot tournament.

| Outcome | Count |
|---|---|
| Pages with covered controls | 0 |
| Pages with pointer-events traps | 0 |
| Pages with horizontal overflow | 0 |
| Controls flagged as narrow but usable | 4 |

Clean: tournament workspace (25 controls), setup (24), payments (25), event
check-in (7), seating (5), schedule (5), participants (9), side pools (13),
results (4), registration (7), account activations (5), recoveries (3), event
changes (3), games (3), score entry demo (21).

Narrow but usable, all inside table cells, all with adequate height: a roster
text input at 87 by 46, two scorecard type selects at 97 by 52, and a payment
method select at 91 by 52. Not fixed, recorded deliberately.

Score entry at 390 pixels wide: 21 controls, zero problems, no overflow.

## Known gap

This measures what renders in the page's current state. Controls that only appear
after an earlier step completes, such as controls gated behind check in being open
or play having started, were not on screen to be measured. Those are covered by a
manual critical path walkthrough, not by this sweep.

## Guards now in the test suite

- `tests/setup-workspace-ui.test.mjs` fails if a bare `.policy-settings input`
  rule reappears, and requires every full width input rule to exclude checkboxes
  and radios, so the inverse defect cannot appear either.
- `tests/sanctioning-fee-clarity.test.mjs` fails if the rate input's React key
  interpolates the value being edited, which remounted the input on every
  keystroke and made the rate impossible to type.

These are still source assertions. They prevent these two specific regressions.
They do not replace the rendered sweep.
