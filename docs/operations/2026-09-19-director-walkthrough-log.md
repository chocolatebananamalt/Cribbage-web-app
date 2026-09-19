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

## What happened after this log was first written

Everything below was measured after the walkthrough, on the same tournament and
the same deployment, and is recorded here so the log is not read as the last
word.

### The three defects above

1. **Replace and Close now confirm first.** Both controls open a panel naming
   exactly what stops working, and both state that registrations already
   received are kept either way. Merged as PR #115 and confirmed present in the
   production bundle `2ulpngs2l8m7u.js`, which carries all three confirmation
   strings. The behavioural click test still needs a tournament with an open
   link; this one's link is closed.
2. **Display names are still the placeholder.** Deferred by the owner. The two
   accounts that need real names are `chocolatebananamalt@gmail.com` and
   `maggy416@yahoo.com`.
3. **The `form_input` note stands.** Not a product defect.

### Automatic MRP: a correct refusal, not a defect

Step 33 finalized qualification, and the settlement screen then said "Automatic
MRP calculation is blocked: unsupported game count." That was recorded as an
open item. It is not a bug.

The ACC published schedule `acc-published-mrp-2016-08-01` defines a minimum
qualifying game-point figure only for Main events of 12, 14, 16, 18, 20, 21 or
22 games, and Consolation events of 7, 8, 9, 10 or 12. This tournament's Main
Event is configured for 9 games, read from
`app.tournament_setup_event_versions.game_count`. A 9-game Main has no published
row, so there is no MRP to calculate and adding a row would be inventing rating
points. The `case` expression in
`0190_automatic_standard_singles_mrp_results.sql` and the TypeScript table in
`src/lib/results/standard-singles-mrp-reference.ts` were compared line by line
and agree exactly; a test now holds them to each other.

What was actually wrong is that the screen printed the raw enum, so a director
could not tell a broken feature from a correct refusal. Every blocker the server
can return now has a sentence naming the cause and the next action. Merged as
PR #116 and verified live on the settlement screen.

**Operational consequence for a real tournament: a Main event must be configured
for 12, 14, 16, 18, 20, 21 or 22 games, or MRPs will not calculate
automatically and must be reported to the ACC by hand.**

### Two findings from the earlier audit were false

- **The 409 on roster removal is accurate.** "This player has payments,
  check-in, seating, enrollment, or score activity. Use the applicable financial
  or event workflow instead." That is what the guard checks. The remove flow
  also already has Reason, Note and Cancel.
- **The officials and cross-checker pages are reachable.** Both top-level routes
  are redirect shims to `setup/officials/<role>`, which
  `setup-official-summaries.tsx` links for every role. This matches
  `docs/product/requirements.md` line 72, which retires the old workspace links
  and keeps the bookmarks redirecting. A route reachability test now walks all
  31 routes under the tournament workspace and allowlists exactly these two,
  with that reason.

### Also verified live since

- **`0226`**: a Consolation event was created against the amended revision.
- **`0227`, both halves**: Cancel and Retire succeeded in the UI on a
  not-started event with registration closed, and the roster-scoping half was
  proved by a rolled-back production probe returning
  `old_guard_would_block=t | clean_player={"status":"roster_entry_withdrawn"} |
  enrolled_player={"code":"downstream_activity_requires_event_workflow"}`.
- **Create Private Link** works: one `roster_account_activations` row and one
  event row. Full account activation still requires a second signed-in director
  witnessing the request ID and witness phrase in person, which is by design.
- **Registration does not touch Supabase email.** The public claim route is
  anonymous and uses the service-role admin client, so the rate limit that
  matters is magic-link sign-in, not registration.
- **Vercel is deploying commits authored by Luke again.** PRs #113, #114, #115
  and #116 each produced a Production deployment that reported success. The
  earlier rule, that only a merge commit authored by the repository owner would
  deploy, no longer holds.

### Not exercised by this walkthrough

The digital scoring path. All eight players were paper participants with no app
account, so two independent digital submissions plus two confirmations were
never run end to end. That remains the largest untested surface.

## Migrations 0229 to 0232: applied, probed, merged, deployed (07:20 UTC)

Applying a migration is not evidence it works. plpgsql does not parse-analyse a
function body at CREATE time, so a migration can apply cleanly and still raise on
first call. Every function below was therefore called inside a transaction that
was rolled back by a deliberate `raise`, forcing each branch to execute against
live production data. After each probe the tables were re-counted to confirm zero
residue, and all four came back clean.

### 0229 pause and close

Gate moved `open -> paused -> open -> closed`. Closing the Consolation event,
which has no scheduled games, was refused `event_not_started`. Reopening the Main
after it had downstream activity was refused `downstream_activity`. Calling close
with `p_confirmed` false was refused `invalid_request`. Main readiness read
36 scheduled, 36 resolved, 0 unresolved.

### 0230 finalize cross-checking

All 11 conditions evaluated. On the walkthrough tournament the only outstanding
one was `cross_checkers_not_assigned`, which is a true statement about that
tournament rather than a defect. Assigning a cross-checker inside the probe made
`canFinalize` true, and the happy path then wrote its receipt, its finalization
row with an 11-element conditions snapshot, and its audit row. Replay under the
same operation id returned the identical payload; a second operation returned
`already_finalized`; the immutability trigger refused an update with
`immutable history`.

One fix went in before applying. The games condition counted
`state not in ('verified','corrected')`. Forfeits and approved device-failure
recoveries leave `canonical_games.state` at `pending` forever by design, so that
test would have left Finalize Cross-Checking permanently unpressable on any
tournament with a single forfeit. It now calls
`app.game_is_authoritatively_resolved_v1`, the shared predicate. The team-game
half deliberately keeps the state test.

### 0231 retire a side pool

Money is refused first (`side_pool_has_money`, reporting `collectedMinor` 2000 in
the probe), then any history at all (`side_pool_has_activity`, firing on a lone
reconciliation row with no money). No receipt is written on any rejection;
exactly one was written for the one accepted retirement. Replay identical,
`idempotency_conflict` on reused id with different arguments,
`side_pool_already_retired` on a second attempt.

The pool left the director's screen, which is the defect this fixes: the
workspace went from `$10 | $20 | $50 | $100` to `$20 | $50 | $100`. The slot
freed too, active count 4 to 3, and adding `$15 Side Pool` succeeded.

**Correction to that file's own header.** It claimed retirement also frees the
pool NAME. It does not. Re-adding `$10 Side Pool` was refused
`duplicate_pool_name`, even though that function's newest-version name check
evaluates to false; the refusal comes from its trailing
`exception when unique_violation` handler firing on
`event_side_pool_active_name_unique_idx`, which is unique over ROWS
`(event_id, lower(trim(display_name))) where active`. Retirement appends version
2 with `active=false`, but version 1 still says `active=true` and stays indexed
forever, and `event_side_pool_definitions_immutable` means that row can never be
updated or deleted. No change to the function can free the name; only the index
can. The header now records this with the measurement. The remaining dead end is
narrow, since the pool is off the screen and the slot is back, so the index
change is deferred to after the tournament rather than made on the morning of an
event.

### 0232 tournament day CSV import

Every rejection branch returned its own code with the right row number and wrote
nothing: `not_director`, `invalid_batch` for an empty batch, a non-array, an
81-character name part, a blank name part and a bad scorecard type,
`duplicate_in_batch`, `withdrawn_roster_entry`, `event_unavailable`,
`side_pool_unavailable`, `received_exceeds_due`, `q_pool_unavailable` and
`registration_closed`. A two-row batch whose second row was bad correctly
reported `rowNumber 2`.

The happy path, three rows: 2 roster entries created and 1 matched, 4
participants created at status `registered` with `source_kind` `director_csv`, 3
obligations (5500, 2000, 1500), 2 payment events (the unpaid row correctly got
none), 1 side pool election at due 1000 / received 1000 / cash, 3 audit rows.
Replay under the same key returned the identical payload. Re-running the same
file under a NEW key wrote nothing and reported every item as existing, which is
the case a director actually hits when they upload twice. Changing a paid
player's total was refused `payment_conflict`.

Three fixes went in during the port from PR #106: the obligation guard now
refuses a silent downward rewrite of a recorded balance, a side pool election for
an event the row is not enrolled in is refused with its row number instead of
failing at write time, and an over-long or blank name part is caught in the
validation pass rather than as a bare 503 at the desk.

### Whole-app checks

- All **193** RPCs called anywhere in `src/` exist in production and are
  executable by `service_role`. Zero missing. That rules out the entire
  "the migration was never applied" class of failure for every screen, not just
  the new ones.
- Every new RPC is granted to `service_role` only. The single exception is
  `get_game_play_gate_v1`, additionally granted to `authenticated` by design,
  because the scoring screen reads it as the player.
- Parameter names on all nine new functions match what the routes pass. The
  reopen branch correctly omits `p_confirmed`, which `reopen_event_play_v1` does
  not take.
- 710 of 710 tests, `tsc --noEmit` clean, `next build` compiles.
- Merged as PR #117 and deployed: `event-control`, `cross-check-finalization`
  and `tournament-day-import` all return 307 on production while a nonexistent
  route under the same tournament still returns 404, so the 307 is real.

### MRP: not a bug

The ACC published schedule covers Main at 12, 14, 16, 18, 20, 21 and 22 games and
Consolation at 7, 8, 9, 10 and 12. Checked every activated event in the database:
the only one without a published row is this walkthrough tournament's own Main,
configured for **9 games**. The Genesis Rehearsal and October 3 Pilot Mains are
both at 12 and are fine. The settlement screen used to print the bare enum
`unsupported game count`; it now explains which counts are covered, which one
this event is set to, and that MRPs must be reported by hand while payouts and
the result package are unaffected.

### Noted, not fixed

The close branch of the play-close route hardcodes `p_confirmed: true`, so the
server-side unconfirmed-close guard can never fire in production and the
confirmation step lives only in the client. The guard works when called directly,
as the 0229 probe showed.

### What is NOT verified

The live signed-in click-through. Everything above is server-side and static
verification. No one has pressed these buttons in a browser as a director.
