# Director walkthrough, 2026-09-19

Signed in as Luke Stevens, director, on the live deployment
`https://cribbage-web-app.vercel.app`, against production Supabase project
`fnjkwymxpnsqvxtpronk`.

Test tournament: **Verification Walkthrough 09-19**
(`fe1ef5f5-6225-4c00-840b-337be49aa8b8`), created through the UI for this pass so
Genesis Rehearsal and the October 3 Pilot keep their history.

Every row below is a control operated in the live browser, not a function read.
Where a result is recorded as PASS, the database was queried afterwards to
confirm the row the button was supposed to write actually exists.

Two of the steps say how they were driven, because it matters. Steps 30 and 31
cover 72 submissions across 36 games. Those were driven from the page itself: the
same React inputs were filled and the same buttons clicked, in the page, by
script rather than by hand. The click handlers, API routes and RPCs all ran for
real, and the database rows are the evidence, but nobody moved a mouse 72 times.
One game, Dorothy Pike against Vernon Tilley in game 1, was done by hand first,
both halves, to establish that the path works before the rest were driven.
Every other row in this log was a real cursor on a real control.

## Critical path

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Create Tournament | PASS | Tournament row created through the UI |
| 2 | Setup: save draft | PASS after fix | Blocked by a payload deadlock; `0225`. Revision 1 saved with `state_territory = Hawaii` and public contact Luke Stevens |
| 3 | Sanctioning fee rate override | PASS | Typed 4.50 with a real cursor, Save gated on a reason, DB row moved 300 to 450 with reason and actor |
| 4 | Officials: add and remove | PASS | Both wrote; `saved_setup_end_required` cleared once revision 1 existed |
| 5 | Finalize and Open Registration | PASS | `registration_status = open`, 1 activation |
| 6 | Create QR link | PASS after fix | Never worked in production before today; `0228` and `0228b`. 200 with a real QR PNG |
| 7 | View Active Link | PASS | Revealed a 125 character URL with its fragment; 1 link, 1 reveal envelope, ciphertext 128 chars |
| 8 | Public registration page loads from the QR link | PASS | Renders unauthenticated, shows the tournament name and the public contact saved in step 2 |
| 9 | Public registration submit | PASS | 6 claims landed, all `pending_review` |

### Step 9 detail

Six players registered through the public form, no sign-in, no email sent on this
path:

| Player | ACC number | Pay | Scorecard |
|---|---|---|---|
| Walter Nagel | none | cash | digital |
| Dorothy Pike | none | cash | digital |
| Harold Breck | none | cash | digital |
| Marjorie Cassel | none | cash | digital |
| Vernon Tilley | HI296 | cash | digital |
| Eunice Rademacher | none | check | paper |

Optional ACC number, the check payment method and the paper scorecard all
persisted, and the confirmation echoed the ACC number back.

## Notes worth keeping

- The public claim route is fully anonymous and uses the service-role client, so
  **the Supabase email rate limit is not on the registration path**. It still
  applies to magic-link sign-ins and official invitations.
- `src/app/api/v1/registration/claims/route.ts` collapses almost every failure to
  a bare 404 `unavailable`, including an internal error. Same shape as the 503
  that hid the QR link bug for months. Worth a named reason, after the event.
- The ACC Number field upper-cases what is typed into it.

| 10 | Roster: approve request | PASS | 6 of 6 approved |
| 11 | Roster: create roster identity | PASS | 6 identities, `source_kind = registration_claim` |
| 12 | Roster: Add Player Manually | PASS | Clement Fosdick, `source_kind = director_manual`, ACC HI412 |
| 13 | Roster: Import Player List (CSV) | PASS | Irene Balthazar, `source_kind = director_csv`, Paper scorecard honored |
| 14 | Payments: Save accepted methods | PASS | `tournament_payment_method_config_versions` v1, cash and check both true |
| 15 | Payments: Save amount owed | PASS | Clement $45.00 with a reason; status moved to unpaid, remaining $45.00 |
| 16 | Payments: Record receipt evidence | PASS | `roster_payment_events` v1, 4500 minor units, cash, note and actor recorded |
| 17 | Payments: Add Expense | PASS | $120.00 active expense |
| 18 | Check-in and Seating: Record check-in | PASS | 8 of 8 at `check_in_state = checked_in` |
| 19 | Setup: Add a later event | PASS after fix | `0226`. Consolation Event created against the amended revision |
| 20 | Registration link: Replace Active QR Code and Link | PASS | `rotate_registration_link_v3`, the other function `0228` patched. Old link retired, new link issued, each with its own 128 char envelope |
| 21 | Registration link: Close Link | PASS | Link closed, screen reverted to Create registration link |
| 22 | Close registration and disable signup | PASS | Correctly refused until the attendance confirmation was ticked |
| 23 | Publish permanent initial seating | PASS | 1 publication, 8 assignments, A-1 through B-4 |
| 24 | Event participants: Select all not enrolled, Enroll | PASS | Main Event 8 enrolled, verification IDs shown |
| 25 | Schedule: Download CSV template | PASS | Header `Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat` |
| 26 | Schedule: Import Reviewed Schedule | PASS | 36 rows accepted, validator reported the schedule complete |
| 27 | Publish Game Schedule | PASS | 9 games, 36 matchups, state `ready to start` |
| 28 | Start Main Event | PASS | Play in progress, score entry unlocked |

### Defects found while walking, not yet fixed

1. **Replace Active QR Code and Link has no confirmation step.** One click
   permanently invalidates the live QR that players are scanning. Close Link is
   the same. Close registration and Publish seating both gate on a tick; these
   two do not.
2. **The placeholder display name reaches director-facing records.** The expense
   ledger reads "Expense approved by tournament participant" and the schedule
   reads "Started by Tournament participant". That is `app.profiles.display_name`
   for the acting director. Needs the real names.
3. **`form_input` style programmatic checkbox setting does not reach React state**
   on this app. Not a product defect; a note for anyone scripting against it.

## Day of play

| # | Step | Result | Evidence |
|---|---|---|---|
| 29 | Paper games: Confirm official identity | PASS | Director bound as a nonparticipant, binding version 1 |
| 30 | Paper games: Record both paper cards | PASS | All 36 matchups recorded, two card references and a spread per game |
| 31 | Paper games: Confirm exact match | PASS | All 36 confirmed independently; every `canonical_games` row reached `state = verified` |
| 32 | Live Preliminary Standings | PASS | 36 of 36 resolved, 0 unresolved ties, ranks with game points, won, plus, minus and net |
| 33 | Finalize Qualification | PASS | `qualification_result_versions` v1, 8 participants, 2 qualifiers, high non-qualifier recorded, standings digest stored |

Final standings as the app computed them:

| Rank | Player | Game points | Won | Net |
|---|---|---|---|---|
| 1 | Walter Nagel | 12 | 6 | +80 |
| 2 | Clement Fosdick | 12 | 6 | +56 |
| 3 | Harold Breck | 12 | 6 | +51 |
| 4 | Eunice Rademacher | 10 | 5 | -10 |
| 5 | Irene Balthazar | 8 | 4 | +5 |
| 6 | Dorothy Pike | 6 | 3 | -31 |
| 7 | Vernon Tilley | 6 | 3 | -74 |
| 8 | Marjorie Cassel | 6 | 3 | -77 |

Qualifiers: Walter Nagel and Clement Fosdick. High non-qualifier: Harold Breck.
Three players tied on 12 game points and 6 wins, and the app ordered them by net
spread and reported no unresolved tie. Observed, not checked against the
rulebook: the ordering was game points, then wins, then net spread.
