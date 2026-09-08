# 2026-09-07 Score Entry and Scorecard Format Review

## Scope and acceptance criteria

This review-shell change implements the user-approved visual language only. It must:

1. Show `Score Entry` / `Current Game Results`, `Game Winner:`, permanent player verification IDs, and changing per-game Table/Seat context.
2. Show both players’ plain-language result, Game Points, and signed Spread Points after a valid entry, with the skunk indicator in the spread-entry band.
3. Show a 12-game scorecard with compact grouped paper-card-inspired headers, permanent `ID #`, a vertically scrolling body, and fixed header/total/summary rows without player-facing prototype explanations.
4. Keep invalid score entry disabled and retain the existing 1–121 validation in program logic.
5. Provide a reviewable navigation prototype for Score Entry, Review Result, Scorecard, Operations, Seating, Cross Check, Flyer & Events, Financials, and Results; Seating must support capacity setup, name search, sorting, and printing.

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
| Hosted Preview desktop | Pass: deployment `dpl_57LReyrNzTQS13uEWPx5ijZ7Jx75` rendered the revised Score Entry screen with permanent IDs and separate current Table/Seat assignments, with no development error overlay. |

## Limitation

The Review Result control remains a non-persistent prototype control. This visual review does not claim that the display is wired to the authoritative two-submission/two-confirmation API workflow. A true phone-device/browser pass remains required before this format is accepted as a responsive production design.
