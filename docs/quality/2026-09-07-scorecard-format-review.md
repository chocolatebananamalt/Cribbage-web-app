# 2026-09-07 Score Entry and Scorecard Format Review

## Scope and acceptance criteria

This review-shell change implements the user-approved visual language only. It must:

1. Show `Score Entry` / `Game Result`, `Game Winner:`, and player-facing winner buttons.
2. Show both players’ plain-language result, Game Points, and signed Spread Points after a valid entry, with the skunk indicator in the spread-entry band.
3. Show a 12-game scorecard with the requested grouped paper-card-inspired headers, player ACC number, Table/Seat, current game, opponent, and no player-facing prototype explanations.
4. Keep invalid score entry disabled and retain the existing 1–121 validation in program logic.

## Executed checks

| Check | Result |
|---|---|
| `pnpm test` | Pass: 25 tests, including the new scorecard header/label regression assertions. |
| `pnpm build` | Pass: optimized Next.js production build completed. |
| Browser local preview | Blocked intentionally by missing local public Supabase values: Next proxy refuses to run without the two public environment variables. Hosted Preview has those values and is the required browser verification target. |

## Limitation

The Review Result control remains a non-persistent prototype control. This visual review does not claim that the display is wired to the authoritative two-submission/two-confirmation API workflow.
