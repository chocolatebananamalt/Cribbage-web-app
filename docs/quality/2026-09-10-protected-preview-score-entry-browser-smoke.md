# Protected Preview score-entry browser smoke — 2026-09-10

## Acceptance criteria

In a real, logged-in browser session against the protected Vercel Preview,
the player-facing score-entry screen must render and provide the agreed
senior-friendly result flow: choose a winner, enter a valid spread using the
on-screen keypad, show the two card outcomes, and reject an impossible spread
without allowing review.

## Environment and scope

- Chrome profile: the user's already authenticated Chrome session.
- Deployment observed: the protected Preview at
  `https://cribbage-web-chfvizp28-cribbage-app.vercel.app/`.
- Fixture shown by that Preview: Grass Roots, Honolulu, HI, Main (12 games),
  Game 3; only sample data was viewed.
- No sign-in, account, role, tournament, score submission, or hosted
  configuration was changed. The interactions stopped before **Review
  Result**.

## Observed result

1. The Preview rendered **Score Entry** / **Current Game Results**, the
   player and opponent IDs, current table/seat labels, winner choices, an
   on-screen numeric keypad, and the **Review Result** control.
2. Selecting **Barb won** changed the prompt from “Choose the winner to begin
   score entry.” to “Enter spread points.” and kept **Review Result** disabled
   until a valid number was entered.
3. Entering `1` using the on-screen keypad showed both expected card outcomes:
   Barb Stevens won by 1 with 2 game points and `+1` spread; Steve Hall lost
   by 1 with 0 game points and `-1` spread. **Review Result** became enabled.
4. Extending that input to `122` showed exactly “Enter a possible spread point
   number.” and disabled **Review Result**. The derived result was removed,
   so an impossible margin could not advance through this interface.

## Limits

This is a desktop browser smoke test of the visible Preview fixture. It does
not prove mobile layout, persisted score submission, independent player
sessions, dual confirmation, offline behavior, or the release-gated account
activation ceremony. Those remain explicit production gates.
