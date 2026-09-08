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
9. Expose a public rulebook route without copying ACC content, and label the qualifier report as a synthetic, non-official sample.

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

## Limitation

The Review Result control remains a non-persistent prototype control. This visual review does not claim that the display is wired to the authoritative two-submission/two-confirmation API workflow. A true phone-device/browser pass remains required before this format is accepted as a responsive production design.

Table C exception wording is intentionally an information-gathering review layout, not an ACC-authorized play-through instruction. The PDF is a visual sample only; production event reports must be generated only from reconciled, director-approved published results and approved award fixtures.
