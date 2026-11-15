# Automated accessibility and browser proof — 2026-09-10

## Scope and acceptance criteria

This check covers the current public Preview deployment and the current working source. It is intentionally limited to automated browser evidence and source-contract checks. It does not replace testing by older players, tournament directors, screen-reader users, or real-device users.

Acceptance criteria:

- the public prototype and sign-in page load in external Chrome without console errors;
- the prototype's score-entry/review navigation remains operable without submitting data;
- phone and desktop layouts have no unintended page-level horizontal overflow;
- enabled controls are at least 44 by 44 CSS pixels;
- keyboard focus is visible on navigation and sign-in controls;
- essential text and controls meet a basic computed-color contrast check;
- narrow scorecards remain readable through a discoverable keyboard and touch scrolling region;
- a 200% desktop-zoom reflow equivalent retains content and controls without horizontal page loss.

## Environment

- External browser: Chrome profile `Daron`; the Codex in-app browser was not opened.
- Live URL: `https://cribbage-web-k1ucf5ezw-cribbage-app.vercel.app/`
- Live deployment: `dpl_EVyNj1HwzPe6Pc5BogZzqMvRSFkX`, Preview, READY.
- Live source commit and current `HEAD`: `98deb422feee601d65db4fafd96eb64dd3af3581`.
- Local tools: Node `v24.19.0`, pnpm `11.19.0`.
- Viewports exercised: 1280 by 900, 640 by 450 (200% reflow equivalent for a 1280-pixel desktop), 375 by 812, and 320 by 800 CSS pixels.

## Live Preview evidence

### Passed

- Desktop prototype at 1280 by 900: document width 1265 at a 1280-pixel viewport; no page-level horizontal overflow and no Next/Vite error overlay.
- Phone score entry at 375 by 812 and 320 by 800: document widths 360 and 305 respectively; no page-level horizontal overflow and no enabled target below 44 by 44 CSS pixels.
- Desktop keyboard order reached Score Entry, Scorecard, Operations, Results, Rulebook, both winner choices, then keypad buttons in a coherent sequence. Each sampled focused element had a visible blue solid outline (computed approximately 2.4 CSS pixels with a 2.4-pixel offset) and remained in the viewport.
- Phone sign-in at 320 by 800: the labeled email field and submit button were each 220 by 52 CSS pixels; no horizontal overflow. Tab focus moved from the email field to the button and both received the same visible blue outline.
- Read-only prototype interaction: selected `Barb won`, entered spread `12`, observed the derived 2 game points / +12 and 0 game points / -12 result, opened Review Result, returned to Scorecard, and did not submit an entry.
- Accessibility tree exposed the page heading, tournament navigation, winner choices, keypad labels, score tables, sign-in heading, email field label, and sign-in button name.
- Basic computed contrast samples passed: body ink on the page background approximately 14.97:1, headings on white approximately 15.91:1, and blue navigation/action color on white approximately 6.70:1. The low-contrast disabled Review Result state is not a WCAG contrast failure because disabled controls are exempt, but should remain part of older-player usability review.
- Browser console checks returned no warnings or errors after prototype navigation/interaction and on the sign-in route.
- At the 640 by 450 reflow equivalent of 200% zoom on a 1280-pixel desktop, both prototype and sign-in retained all content through vertical scrolling, had no page-level horizontal overflow, and retained 44-pixel minimum enabled controls. External Chrome automation did not expose a stable native zoom percentage while a viewport override was active, so this is reflow-equivalent evidence rather than a claim about Chrome's displayed zoom value.

### Confirmed live defect

At 320 by 800, the live Preview Scorecard is not readable. Header labels and row values overlap inside a 222-pixel-wide `.table-scroll` region. The page itself does not overflow (`documentElement.scrollWidth` 305 at `innerWidth` 320), and the region reports `clientWidth` 222, `scrollWidth` 222, and `overflow-x: hidden`; therefore the clipped columns cannot be recovered by horizontal panning. At 375 by 812 the same region is 278 pixels wide and still hides horizontal overflow, with the Verification header visibly clipped.

This is a deployment defect, not merely missing evidence.

## Current working-source evidence

The shared working tree already contains the narrow fix at the responsible layer; this audit did not edit the owned implementation files:

- `.scorecard-frame` now scrolls horizontally and the three scorecard tables have a 560-pixel minimum width;
- both the public prototype scorecard and protected scorecard page expose a focusable region named `Scorecard table; scroll horizontally on small screens`;
- the focused regression test asserts those CSS and accessible-region contracts.

Focused checks:

- `node --conditions=react-server --experimental-strip-types --test tests/dashboard-semantics.test.mjs tests/supabase-auth-semantics.test.mjs` — PASS, 41 tests, 0 failures.
- `pnpm lint` — PASS.
- External Chrome could not open `localhost:3119` or the machine's LAN URL (`ERR_BLOCKED_BY_CLIENT`), so the working-source fix still needs a browser re-check after deployment. Source inspection and the regression test close the implementation contract, but not the live visual proof.

## Closure state

- Closed by automated proof: live desktop and phone score-entry layout, live sign-in layout, basic target sizing, keyboard focus visibility/order, basic computed contrast samples, public read-only interaction, and console/runtime-error check.
- Fixed in current source but not closed live: narrow scorecard readability and keyboard/touch horizontal access. Closure requires deploying the current fix and repeating the 320- and 375-pixel Chrome checks.
- Requires human testing: older-player/director comprehension and comfort, true Chrome 200% zoom confirmation, real phone touch/pan behavior, screen-reader announcements and table navigation, high-contrast/forced-colors behavior, motor-fatigue assessment, and end-to-end authenticated flows using independent player/director sessions against the real test backend.
