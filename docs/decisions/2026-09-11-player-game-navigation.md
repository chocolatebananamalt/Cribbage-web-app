# Player game navigation

## Pilot acceptance criteria

- A signed-in, linked participant can open **My Games** from the tournament
  workspace without knowing a database game identifier.
- The reader returns only games in the requested tournament where the signed-in
  account is one of the two assigned participants.
- Each row identifies the event, game number, current game state, opponent,
  current Table/Seat for both players, and both permanent Verification IDs.
- Unresolved games appear before completed games. Unresolved rows link to the
  existing protected score-entry workspace; verified or corrected rows and
  every represented event link to the verified-only scorecard.
- A role assignment without event participation, an anonymous request, and a
  cross-tournament request reveal no game list.
- The response shape is exact and fail-closed. Database errors or malformed
  data render an unavailable screen with no score-entry action.
- The page works without horizontal scrolling at 375 CSS pixels and remains
  usable on desktop.

This slice does not activate the real pilot or invent a tournament schedule.
It makes already-published, director-reviewed games discoverable by their
assigned digital players.
