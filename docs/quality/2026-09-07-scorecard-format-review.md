# 2026-09-07 Score Entry and Scorecard Format Review

## Scope and acceptance criteria

This review-shell change implements the user-approved visual language only. It must:

1. Show `Score Entry` / `Current Game Results`, `Game Winner:`, permanent player verification IDs, and changing per-game Table/Seat context.
2. Show both players’ plain-language result, Game Points, and signed Spread Points after a valid entry, with the skunk indicator in the spread-entry band.
3. Show a 12-game scorecard with compact grouped paper-card-inspired headers, permanent `ID #`, a vertically scrolling body, and fixed header/total/summary rows without player-facing prototype explanations.
4. Keep invalid score entry disabled and retain the existing 1–121 validation in program logic.
5. Provide a reviewable navigation prototype for Score Entry, Review Result, Scorecard, Operations, Seating, Cross Check, Flyer & Events, Financials, and Results; Seating must support capacity setup, name search, sorting, and printing.
6. Provide review layouts for tournament setup, player check-in, table-plan exceptions, judge desk, flyer editing, and qualification preview without claiming their prototype controls persist authoritative data.
7. Keep an entered but unverified game visibly excluded from the scorecard totals; show the reason near both the card status and the totals.
8. Print active seating data in sort/filter order, filling the left column before the right column, with a simple print-only heading.
9. Expose a public Rulebook route with the permitted cached, dated ACC Rulebook and label the qualifier report as a synthetic, non-official sample.
10. Place the pending-opponent total notice in the unused total-row right-side cells, keep matching large Plus/Minus header symbols, and print two repeated seating-column headings using compact assigned-seat values and one-half-inch margins.

## Executed checks

| Check | Result |
|---|---|
| `pnpm test` | Pass: 25 tests, including the new scorecard header/label regression assertions. |
| `pnpm build` | Pass: optimized Next.js production build completed. |
| Expanded screen navigation tests | Pass: Score Entry Review Result, Seating & Paper Cards, Cross Check, Flyer & Events, Financials, and Results are all represented by regression assertions. |
| Hosted Preview desktop | Pass: deployment `dpl_6pYkkG1QrRAjcTH2AMSFWJCzsBR3` rendered the Current Game Results screen, tournament context, keypad, review gate, and top-level screen navigation without a development error overlay. |
| Browser local preview | Blocked intentionally by missing local public Supabase values: Next proxy refuses to run without the two public environment variables. |
| Hosted Preview desktop | Pass: deployment `dpl_8Res9v9BjVDAz9P5G4ksqSEs7C7m` rendered the score-entry controls, 12-game grouped scorecard, four navigation sections, and no development error overlay. |
| `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm verify` | Pass after the permanent-ID, fixed-scorecard, and Seating controls update. `pnpm test`: 25 tests. |
| `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm verify` | Pass after keypad, print-layout, and additional operations/results review screens. `pnpm test`: 25 tests. |
| Hosted Preview desktop | Pass: deployment `dpl_2c7f3rE7zRtVzZkGh4ubkzrE1rLz` rendered the revised Score Entry heading, permanent IDs, current Table/Seat context, and left-aligned `Spread Points:` without a development error overlay. |
| Hosted Preview desktop | Pass: deployment `dpl_57LReyrNzTQS13uEWPx5ijZ7Jx75` rendered the revised Score Entry screen with permanent IDs and separate current Table/Seat assignments, with no development error overlay. |
| Focused high-risk review | Pass with gates recorded: Sol reviewed seating, qualifications, MRP/Q-pool, staff roles, and rulebook boundaries. Prototype text was corrected to avoid official schedule, approval, portal-parity, or payout claims. |
| Qualifier PDF render | Pass: `scripts/create-qualifiers-pdf.py` produced `output/pdf/qualifiers-summary.pdf`; Poppler render inspection confirmed one readable Letter page with prominent `SAMPLE — NOT OFFICIAL` marking and synthetic-data disclaimer. |
| `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm verify` | Pass after pending-total, left-first print, rulebook, Operations, results, and PDF-sample changes. `pnpm test`: 25 tests. |
| Hosted Preview desktop | Pass: deployment `dpl_4kb59L4Pn27hbo1RnejZDPqnZuy1` rendered the revised Score Entry view and its five top-level navigation tabs, including Rulebook, with no error overlay. |
| ACC Rulebook cache verification | Pass: downloaded the official ACC 2025 Rulebook from the dated ACC source URL. `pdfinfo` reports a 64-page, unencrypted PDF created July 9, 2025; Poppler-rendered first-page inspection matched the ACC green 2025 cover. User-recorded permission for full-rulebook copy/cache is documented in the product decision and requirements. |
| `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm verify` | Pass after total-row placement, header sizing, Game 3 label, assigned-seat print layout, and ACC Rulebook cache changes. `pnpm test`: 25 tests. |
| Hosted Preview desktop | Pass: deployment `dpl_CazZCcDRaWkRbBycZFPRbpQ5o29p` rendered `GAME 3`, the current score-entry view, and all five top-level navigation tabs without an error overlay. |

## Continued-review acceptance criteria

1. Pending-opponent messages appear only after the player submits an entry, use a consistent 16px status treatment, and are accessible to assistive technology.
2. Seating assignment/verification IDs remain unavailable during check-in and are shown as assigned only after registration closes.
3. The review layout renders all configured event types, including Canadian Doubles as a team-scorecard configuration, without claiming that unimplemented team verification is authoritative.
4. The Flyer editor opens a viewable sample; the Rulebook area opens an app quick reference, the permitted cached 2025 PDF, and the official external source.
5. Tournament setup has one reusable, director-confirmed source of information for the event tracker, flyer, seating, results, finance, and a director-assisted draft worksheet aligned to observed fields. It must offer the observed Main/Consolation/Satellite option sets without treating an unverified portal integration as available.

## Continued-review evidence - 2026-09-07

- Updated the visible prototype to keep **Events and Flyer** as the event-management and reference area, with flyer creation as an action inside that area. It is not a flyer-only workflow.
- Expanded **Set Up Tournament** with prototype options based on the observed tournament/director/venue fields, Main and Consolation styles and game-count menus, six Q-pool types, Satellite style/game/payout menus, two co-director entries, and optional additional request information. The source remains a review representation; it does not save or submit any data.
- Added the flyer-import format preview. Its input and extraction control are intentionally disabled; production extraction must require director confirmation before it becomes canonical setup data.
- Results now start from Main Event, Consolation Event, and Satellite Events categories, then reveal event details; the earlier incorrect `Topaz Satellite` example was removed. Canadian Doubles is an available configured Satellite style and remains gated on an approved team-event ruleset and verification workflow before standings use.
- Made the scorecard’s permanent `ID #` and its value more prominent. The seating print heading now places the tournament context beside `Seating Assignments`; the page targets half-inch margins, compact `A-5` values, repeated headings, and left-column-first ordering (28 entries per column, 56 per Letter-page target).
- Renamed Rulebook actions to **Quick Reference Search**, **ACC Rulebook Cached**, and **ACC Rulebook Online**. The quick reference now filters app-organized topics; the full cached PDF remains the official-text reading/search destination.
- Regenerated the synthetic sample qualification PDF so qualifiers begin with the winner and runner-up: Casey Kim, Jordan Patel, then Robin Lee. Poppler page render inspection found one legible Letter page with its `SAMPLE - NOT OFFICIAL` banner.

### Executed checks

| Check | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm test` | Pass: 25 tests |
| `pnpm build` | Pass: Next.js production build |
| `pnpm verify` | Pass: 6 workspace checks |
| `pnpm verify:handoff` | Pass: 6 handoff checks |
| PDF artifact visual inspection | Pass: regenerated `output/pdf/qualifiers-summary.pdf` rendered cleanly with Poppler |
| Hosted Preview desktop | Pass: deployment `dpl_68JMBS9YFzgGtP7aZmWyrx1USHUK` (commit `77fd8da`) reached `READY`; Chrome rendered the Score Entry panel, senior-sized keypad, permanent IDs, top navigation, and no error overlay. |

### Limitations

- Browser UI verification at both real phone and desktop sizes is still required after the hosted deployment. The local browser remains deliberately blocked without public Supabase environment values.
- Print rendering with a full 56-entry page remains an implementation target; the prototype has not yet been printed in a physical browser print dialog.
- ACC portal submission, flyer field extraction, team scoring, Q-pool calculations, MRP awards, and results calculations are not implemented or approved by this visual prototype. The flyer remains labeled `SAMPLE - SANCTIONING PENDING` until the director has an approval decision.

## Limitation

The Review Result control remains a non-persistent prototype control. This visual review does not claim that the display is wired to the authoritative two-submission/two-confirmation API workflow. A true phone-device/browser pass remains required before this format is accepted as a responsive production design.

Table C exception wording is intentionally an information-gathering review layout, not an ACC-authorized play-through instruction. The PDF is a visual sample only; production event reports must be generated only from reconciled, director-approved published results and approved award fixtures.
