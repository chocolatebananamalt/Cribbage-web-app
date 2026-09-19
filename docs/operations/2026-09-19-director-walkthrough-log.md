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

## Setup page, clicked end to end in the live browser (08:00 to 08:25 UTC)

Test tournament `57516b95-4d6e-455d-b448-d7f72b3fed64`, "Button Audit 09-19-2026",
created through the UI and walked control by control on
`https://cribbage-web-app.vercel.app`. Every line below was pressed, not read.

### The reported defect, and what it actually was

Luke: "i still cant adjust main rate or adjust consolation rate ... dosen't allow
me to click it".

`setup-client.tsx` gated both buttons on `canAdjust={!!revisionId && !pending}`.
`revisionId` is null until a setup draft has been saved once, so on every newly
created tournament both buttons were disabled, and since `.secondary` has no
`:disabled` styling they looked pressable. Pressing one fired zero network
requests, which is what "does not work" looked like from the outside.

No server rule required it. Probed against production on a tournament with zero
setup revisions, with the rollback `raise` idiom:

    revisions=0  currentRate=300  source=setup
    override={"status":"sanctioning_fee_rate_overridden","version":1,"rateCents":150}

`override_tournament_sanctioning_fee_rate_v1` checks tournament status, the
director role, whether play has started, and whether the rate changed. It has
never looked at a setup revision. The director row exists from tournament
creation (`0194_finalize_registration_and_event_change_lifecycle.sql:79`).

Second half of the same defect: the panel read its rates from the setup payload,
and a tournament with no revision falls back to `blankPayload`, which carries the
$3.00 and $1.00 defaults. A director who recorded an override would have watched
the panel reload and show the old rate back. The panel and the running total now
read the effective rate from the setup workspace, which is what
`current_sanctioning_fee_rate_v1` resolves and what Start Play snapshots.

Verified live after deploy: Main 3.00 to 4.00, Consolation 1.00 to 2.50, both on
a tournament with no saved setup. Confirmed in the database:

    version 1  main         300 -> 400  "ACC Board approved rate for the 2026-09-19 event"
    version 2  consolation  100 -> 250  "ACC Board approved consolation rate"

### Second defect found while clicking, same class

The Co-Director form left Save greyed out with all four fields filled. Save is
gated on `isAccNumber`, which wants `[A-Z]{2}[0-9]+Y?`, so a bare member number
such as 99001 never enables it. The input carries a `pattern` attribute, but a
disabled button never submits, so the browser never shows it. The event check-in
form and the roster already print the HI296 example; this form was the one that
did not. It now prints it and names the field holding Save back.

### Everything pressed, and the result

| Control | Result |
|---|---|
| Create Tournament | works, tournament created |
| Tournament name, City, Venue | typed and persisted |
| State/Territory select | Hawaii selected, and it auto-set Time zone to Hawaiian |
| Starts, Ends | 09/19/2026 09:00 AM and 05:00 PM accepted |
| Tournament Director name | typed and persisted |
| Contact phone, contact email, mailing address | typed and persisted |
| Refresh total | timestamp advanced, rates held |
| Adjust Main rate | FIXED, full round trip, DB row written |
| Adjust Consolation rate | FIXED, full round trip, DB row written |
| Cancel rate change | closes the editor, no write |
| Co-Directors Add/Remove | page loads, add wrote a nomination, Remove removed it |
| Cross-Checkers, Judges Add/Remove | pages load with the same form |
| Back to tournament setup | returns with version 2 loaded |
| Add Main Event | Main Event 1 created |
| Style, Games, Entry fee, Fee includes, Payout information | all accepted |
| Add Q Pool | Q Pool 1 created, pool type, fee and note all accepted |
| Add Q Pool a second time | limit honoured, button reads "Add Q Pool limit reached" |
| Remove Q Pool | removed pool 2, left pool 1 intact |
| Add Side Pool | created, name and fee accepted |
| Add Consolation Event | created, inherited the tournament start time |
| Add Satellite Event | created with its own Payout ratio select and no Q Pools |
| Remove event | removed the satellite only |
| Save All Events Draft | "Tournament setup version 1 was saved", then version 2 |
| Unsaved-changes guard | a navigation away raised the browser Leave site prompt |
| Finalize All Events / Open Registration | confirmation lists both events |
| Cancel on that confirmation | returns to the editable form, nothing lost |
| Yes, Finalize & Open Registration | activated, routed to the Registration Link page |
| Create Link | active link and QR issued, expires 2026-10-19 18:18 UTC |
| Begin event check-in | OPENS CHECK-IN, live QR displayed, button flips to Close |

### Not pressed, deliberately

- **Sign out** and **Clear safe app data and sign out** would end the signed-in
  session being used to test. Both render and both carry accurate warning text.
- **Archive tournament** is saved for last, since it removes the tournament from
  the list.
- The player side of registration needs a second account and is not covered here.

### Open, not a blocker for today

Adding the co-director returned "The official was saved, but email delivery could
not be confirmed." The address used was `@buttonaudit.test`, which cannot receive
mail, so that outcome is expected and the message is honest about it. Whether
invitation email delivers to a real address is untested.

## Section 2, Registration and roster

Tournament `57516b95-4d6e-455d-b448-d7f72b3fed64`, "Button Audit 09-19-2026",
pressed control by control in Chrome against production.

### Verified working

| Control | Result |
|---|---|
| Add Player Manually, 4 times | "Player added to the roster." Alice HI911, Ben HI912, Carla HI913, Dan HI914 |
| Scorecard Type on the add form | Selecting Paper for Ben was accepted and stored |
| Download CSV template | File landed at `tournament-player-list-template.csv`, header `First Name,Last Name,Email,ACC #,Scorecard Type` |
| Player CSV chooser plus Import Players | "2 players imported." Elena HI915, Frank HI916 |
| CSV Scorecard Type column | Honored per row: Elena digital, Frank paper |
| Source provenance pill | Manual on the first four, CSV on the imported two |
| Per-row Scorecard Type select | Changed Carla and Dan from paper to digital. Both moved to `scorecard_preference_version` 2 in `app.tournament_roster_entries` |

### Defect found and fixed: the add form kept the previous Scorecard Type

Adding Ben as Paper left the select on Paper. Carla and Dan were then both
filed as Paper although nobody chose it, because every other field cleared
and the form read as empty.

Fix in `4248201`: reset the select to Digital alongside the other fields, the
same default the CSV import documents. Pinned by a test in
`tests/manual-roster-intake.test.mjs`. Suite 717 of 717.

### Not verified: Remove from active roster

The resolve form never opened. The click that should have opened it signed
the director out instead, and the page redirected to `/sign-in`.

That sign-out was an accident of this audit, not an application defect. The
evidence rules out an expired session: every cookie was gone while
`localStorage.__acc_walkthrough_link` survived, which is
`signOut({ scope: "local" })` and not the "Clear safe app data" button; the
`auth.sessions` row was still alive with its refresh token unrevoked; and the
session had run 7 hours 18 minutes with writes succeeding minutes earlier.

### Worth noting: Sign out sits directly under the last roster row

`roster/page.tsx:19` renders `<SharedDeviceSignOut />` immediately after
`<RosterClient />`, with no separator. The bottom roster row's "Remove from
active roster" button and the "Sign out" button are therefore neighbours. A
director reaching for the last player's Remove button on a tablet can sign
the desk out mid-event. Recorded, not changed.

### Carried forward

Tournament Day CSV Import is a section 3 feature and is separate from the
roster Import Player List verified above. It is still untested.

## Section 3. Check-in and seating

Every control below was pressed in the live browser against tournament
`57516b95-4d6e-455d-b448-d7f72b3fed64`, signed in as the director.

| Control | Result |
| --- | --- |
| Record check-in, five roster rows | Alice HI911, Ben HI912, Carla HI913, Dan HI914, Elena HI915 all moved to checked in |
| Withdraw with reason | Frank HI916 withdrawn, reason recorded |
| Close registration | Registration closed, seating controls unlocked |
| Auto-assign table plan | 2 tables of 4 seats, five players placed in roster order |
| Publish permanent seating | Published. A1 through A4 and B1 issued as permanent verification IDs |
| Enroll roster entries in Main Event | 5 enrolled. Consolation left at 0 |
| Event selector | Switches between Main and Consolation, counts follow |
| Participant status, mark absent then reinstate | Round trip clean, both writes recorded |
| Schedule CSV validation | Rejected a bad file with a precise per game reason |
| Publish schedule | 12 rounds, 24 matchups, 24 games created |
| Game selector | Lists all 24 games with both sides |
| Start Main Event | Play state moved to in progress |
| Desk check-in, four rows | All four checked in at the event desk |
| Check in and send app access | Private activation link issued and shown once |
| Refresh QR | New QR issued, prior one invalidated |
| Close event check-in | Closed, and the reopen refusal was honest about why |
| Account activations page | Lists the issued activation, status correct |
| Pause All Play, then Resume Play | Both recorded with the reason text supplied |
| Close Event, before games were done | Refused with the outstanding counts named |
| Tournament Day CSV import, preview | One row validated, preview totals correct |
| Tournament Day CSV import, submit | Refused with 409, registration is not open |

### Defect found and fixed: the schedule page called digital players Paper

`schedule-client.tsx:137` read `participant.profileLinked`, which is whether an
app account is attached, and labelled it Digital or Paper. A player set to a
digital scorecard with no account yet read as Paper, contradicting both the
roster and the participants page. Fixed in `a79a45d` to say "App account
linked" or "No app account", which is what the field actually holds.

### Defect found and fixed: desk check-in rows sat dead with no reason

Every check-in control on a row is gated on `row.paid`, and the desk rule
behind it needs a recorded amount owed to exist at all. A player nobody had
priced yet read as "$0.00 received of $0.00", which looks square, while all
three buttons sat dead and said nothing. Fixed in `8389d70`.

The first version of that fix told the director to record a receipt for a zero
fee player. Testing live showed a $0.00 obligation with no receipt already
flips the player to paid, so the copy was wrong. Corrected in `4155ea3`.

### Defect found and fixed: the CSV import outcome rendered a screenful away

The refusal was not silent, which is what it looked like. The message rendered
after the preview and the Active events panel, roughly 500px below the Import
button, so pressing Import left the visible part of the page unchanged. Moved
directly under the button in `2462939` and confirmed live in production: the
409 now appears beside the control that caused it.

### Defect found and fixed: three director controls refused without a reason

`f63e55f` named the reason for the seating publish gate, the locked payment
row, and the play close confirmation. On seating the publish button greys out
when the plan holds fewer seats than there are checked in players, and a
director reading a page of filled dropdowns had no way to see which rule was
holding it.

## Section 4. Cross-check and recovery

| Control | Result |
| --- | --- |
| Confirm official identity | Bound, and required before any paper entry |
| Paper versus paper, record both cards | All 24 games recorded |
| Paper versus paper, independent confirmation | All 24 confirmed |
| Failed device score recovery | Empty for a director, see below |
| Digital versus paper games | Empty for a director, see below |
| Independent scorecard corrections | Empty for a director, see below |
| Correction policy settings | Saved, version 0 to version 1 |
| Finalize Cross-Checking | Correctly disabled, and said exactly why |
| Event dispute register, open | Dispute opened against Game 1.1 |
| Event dispute register, resolve | Resolved by the same director who opened it |

### Defect found and fixed, three times over: a screen empty by role said nothing

Recoveries, Digital versus paper games and Independent scorecard corrections
are all built on the server for `cross_checker` only. A director opens each one
and sees an empty page. Corrections was the worst of the three, because it said
"No eligible scorecards need a correction" to a director looking at 24 verified
games, which states something false about the tournament rather than something
true about the reader.

Fixed in `82b8e2f`, `e9388e4` and `ee3c793`. A first pass pointed the reader at
a `/cross-checkers` screen that is a redirect only legacy route with no inbound
link. Corrected in `cc71a13` to name the path that works: Set Up Tournament,
Tournament officials, Cross-Checker, Add/Remove. That path was then opened live
and confirmed to render the add form.

### Defect found and fixed: a saved correction policy confirmed nothing

Every failure path on that screen said something. Success cleared the envelope
and refreshed, so the only evidence a save had landed was "Active policy
version N" moving by one, in a sentence above the controls. Fixed in `ddbb37f`.

### Defect found and fixed: the dispute register overstated its own rule

The page said "A different authorized official who is not either player must
resolve it". `resolve_event_dispute_v1` rejects only an actor who is one of the
two players in the disputed game, at
`0138_event_dispute_register_and_finalization_guard.sql:347-351`. There is no
check against the opener.

That mattered, because an open dispute blocks qualification finalization. The
old line told a lone director that opening one would deadlock the event. Tested
live: a dispute was opened and then resolved by the same director, and the
register returned to "No open disputes". Fixed in `43ac046`.

### Defect found and fixed: the guide promised a second official that 0223 removed

`0223_one_official_can_complete_a_paper_game.sql` removed the separation of
duties on the paper versus paper path on 2026-09-18, at Luke's instruction. The
how-to guide still told directors and players that "a second distinct cross
checker, co-director, or director" was required. Fixed in `143c50a`.

The digital versus paper paragraph was left alone on purpose.
`0148_hybrid_digital_paper_authoritative_completion.sql:264` still rejects the
first official as the reviewer on that path, so two distinct officials are
genuinely required there.

### Working as intended: Finalize Cross-Checking

This screen is the standard the rest of the app should be measured against. It
lists every condition, marks each outstanding or met with a count, and prints
the disabled reason as a sentence naming the one condition that is short:

> This is disabled because one condition is still outstanding: No cross-checker
> has been assigned to this tournament.

`0230_finalize_cross_checking.sql:102-105` counts only real
`app.tournament_roles` rows, and its own comment says a pending nomination is
deliberately not counted. Nothing else in the codebase reads this finalization,
so it is a record keeping step and does not gate Close Event, results or
archiving.

## Section 5. Results and reporting

| Control | Result |
| --- | --- |
| Tournament Results, event list | Both events listed with enrolled counts |
| View Results, Main Event | Live standings rendered, 24 resolved games, 0 ties |
| View Results, Consolation Event | Empty state correct and explained |
| Qualification Preview | 2 qualifying places, 4 player bracket, 2 byes |
| Provisional High Non-Qualifier | Dan Iona, numeric rank 3 |
| Side Pool Status | Early Bird Side Pool, 0 elected, $0.00 collected |
| Finalize Qualification | Permanently disabled, see below |
| Open Event Dispute Register | Opens, lists all 24 published games |
| Seating Directory | Dead end, see below |
| My Games | Renders, three empty sections all explained |
| Team Scorecards | Renders, "No Traditional or Canadian Doubles event has been activated yet" |
| How to run this tournament | Renders |
| ACC Rulebook | Renders. Both PDF links return 200 and the cached copy is byte identical to cribbage.org |
| Event Changes | Renders, controls correctly hidden for the started event |

### The most important finding: an event can be configured so it can never finish

Main Event is configured for 12 games per player. The published schedule is 12
rounds of 2 games, which is 24 games and 48 player slots across 5 players, so
the players got 9, 10, 9, 10 and 10 games. `scheduledScorecardsComplete` in
`src/lib/results/preliminary-standings-contract.ts:87-92` requires every row to
equal the configured count, so it is false forever, and Finalize Qualification
is disabled forever.

Nothing in the publish path checks that a schedule can satisfy the configured
games per player. The page then said "Standings are still in progress" and
"Resolve every completion notice and ranking tie before finalizing", neither of
which points at anything.

This is not a synthetic case. With an odd number of players somebody sits out
every round, so the configured count and the achievable count diverge by
default.

`a1f1948` makes the screen name the unmet condition in the order the contract
evaluates it, list the players short of the configured count with their actual
totals, and say plainly that playing on will not close the gap, so the way out
is to republish the schedule or change the configured count.

The publish time check is not built. It is the recommended next change and is
recorded here rather than guessed at during the audit.

### Defect found and fixed: the Seating Directory had no way to choose an event

The client freezes `eventId` from its prop and has no picker, so with no
`?event` it sat on "Choose a specific event to open its published seating
directory" with nothing on screen to choose. Both inbound links reach it that
way. Only `team-operations-client.tsx` passes an event, and only once a doubles
event exists. Fixed in `3a05195`.

### Defect found and fixed: labels overlapping their own fields

Seen on three screens, two of them on the payment path: "Required director
reason" on Event Changes, "Optional reason for change" and "Optional receipt
note" on Payments, and "Reason (*required)" on Side Pools. A label that wraps
its own control rendered the control inline after the label text and the two
collided. Several containers already set the grid by hand. `b29b82e` declares
it once by shape, excluding checkbox and radio labels so those keep reading
inline.

### Defect found and fixed: a destructive confirmation that did not name its target

Cancel/Retire and Cancel/Replace render inside the list item they act on, but
they float beside a bulleted list of every event, and the confirmation only
asked "Retire this event?". It now names the event and its enrolled count.

The same file had a ternary whose two branches carried the same sentence, so a
co-director read a neutral policy note and was never told the screen was closed
to them. Both in `b29b82e`.

## Still open

These were found and are not fixed. None of them blocks running a tournament.

1. **`display_name` is the literal string "Tournament participant"** in five
   places now: the expense audit trail, the play start audit line, the pause
   record, the paper games Official selector, and the dispute register's
   "Opened by" line. This is data, not code. The five real profiles need real
   names.
2. **No publish time check that a schedule can satisfy the configured games per
   player.** Described in full above. This is the one worth building next.
3. **"Save accepted methods" on Payments saves with no confirmation.** Same
   class as the correction policy save that `ddbb37f` fixed.
4. **Resolved disputes disappear.** The register shows open disputes only, so a
   director cannot show what was raised and how it was settled.
5. **"$ 40.00 USD" has a stray space** in the payments receipt history.
6. **"Statu / s" wraps mid word** on the seating check-in rows.
7. **Em dashes remain in app copy**, against the project copy standard:
   `roster-client.tsx:118`, the withdrawn records summary line,
   `schedule-amendments`, and `setup-official-summaries.tsx:17`.
8. **Side Pools "Participant election and payment" is dead** with an empty
   select and no explanation.
9. **Published seating rows print the seat value twice**, once as
   `initialTableSeat` and once as `verificationId`, with no column labels.
10. **A withdrawn player still appears** on the Payments page and the seating
    check in list. Whether that is correct is a tournament rules question, not
    a code question.

## Not verifiable by one person

These need a second human, and the audit stopped rather than faking them.

- **Adding a cross-checker sends a real sign in email.** The route calls
  `signInWithOtp` before returning. It was not fired, because a bounced send
  still spends the project's email rate limit, and that limit is what a
  director needs on tournament day.
- **Every cross-checker only screen** therefore stayed empty: recoveries,
  digital versus paper, corrections proposals, and the cross-checker side of
  Finalize Cross-Checking. Authority arrives only after that person completes
  an email sign in.
- **Digital versus paper games need two distinct officials**, a cross-checker
  to record and a different official to confirm. With zero cross-checkers
  assigned, a mixed digital and paper game cannot be completed at all. Paper
  versus paper does not have this problem since 0223.

## Not yet pressed

Close Event and Archive tournament are one way. They were left for a decision
rather than taken during an audit.

## Read this first if a tournament runs today

**A digital versus paper game cannot be completed without two different
officials signed in, and this tournament has zero cross-checkers.**

`0148_hybrid_digital_paper_authoritative_completion.sql:264` rejects the first
official as the reviewer, and line 265 requires that first official to hold the
`cross_checker` role. So a mixed game needs a cross-checker to record it and a
second, different official to confirm it. Neither exists here. Paper versus
paper does not have this problem: `0223_one_official_can_complete_a_paper_game.sql`
removed the separation of duties there on 2026-09-18.

The unblock is one action, and it also unlocks four screens that stayed empty
through this whole audit: add a cross-checker at Set Up Tournament, Tournament
officials, Cross-Checker, Add/Remove, using an email address Luke controls, and
have that person complete the emailed sign in. The add form was opened live and
works. It was not submitted during the audit because the route calls
`signInWithOtp` and a bounced send still spends the project's email rate limit.

Until then, plan for every game to be scored the same way on both sides.

## Correction to an earlier entry in this log

Two claims elsewhere in this file were checked again and one was loose.

**Verified properly.** "Nothing else reads this finalization" was first checked
by grepping the function name. It was rechecked at table level:
`0230_finalize_cross_checking.sql` creates exactly one table,
`app.cross_check_finalizations`, and that name appears nowhere else in
`database/migrations` or `src`. `0229_pause_all_play_and_close_event.sql` and
`0224_archive_and_restore_a_tournament.sql` were read directly and neither
mentions cross-checking in any of its rejection paths. Close Event and Archive
genuinely do not depend on it.

**Corrected.** A first reading of this session concluded that `ddbb37f`, the
correction policy save confirmation, did not work in production, because a
click produced no message and left the version display behind. It does work.
Re-tested with the DOM polled every 400ms for 2.8 seconds: the confirmation
appears, the displayed version moves to 3, and both persist. The earlier read
caught a `router.refresh()` race in which the page briefly re-rendered with the
pre-write version. Worth knowing because a director who hits that race and
presses Save again gets a `stale_policy` refusal; the confirmation sentence,
which names the version it just wrote, is the reliable signal.

## Found after the section 5 pass

### The Seating Directory was returning nothing at all

Following the new event chooser through to a real event produced "Published
seating is not available for this event yet" on an event whose seating is
published. The RPC was queried directly and returned five correct rows. The
route was answering `404 not_found`.

The player branch of `get_tournament_seating_directory_unbounded_v1` builds
`isSelf` as `l.profile_id=p_actor_id` across a LEFT JOIN on
`app.roster_account_links`. A seated player with no app account puts a null on
the left of that comparison, so `isSelf` comes back null, and the guard's
`typeof entry.isSelf === "boolean"` then fails for the entire payload.

That is the ordinary case, not an edge. A paper player never links an account,
and one such player is enough to take the printed seating list out completely.
Fixed in `d4c51c3` by normalising null to false at the route, which is exact
rather than lenient: for an unlinked roster entry the answer is definitively
false. Verified live afterwards: five assignments render, the Table filter
fills with A and B, and Print Current List is usable.

The SQL should `coalesce` at source. That is a change to a production function
and is left for Luke to approve rather than applied during an audit.

### Event Play Control looked available and was inert

The readiness line read "All 24 scheduled games are recorded and verified.
Close Event is available." while nothing on the screen could be operated. The
confirmation tick box reported `disabled:false` in the DOM and still could not
be ticked, because both fieldsets carry `disabled={busy || !reasonUsable}` and
the disabled attribute therefore sits on the ancestor.

The gate itself is correct: a reason is kept with the record. Nothing said so.
Fixed in `0635cca`: the field is marked required and a line above both
fieldsets names the rule.

### The label and field fix was verified on the deployed site

`label:has` is present in the served stylesheet. Five screens were then audited
in the live page: setup, payments, side-pools, event-check-in and
correction-policy. No horizontal overflow, no control sitting outside its
label, and checkbox and radio labels still compute to `display: flex`, so they
still read inline beside their box. Correction Policy was compared against a
screenshot taken earlier in the same session and is pixel equivalent.

One limit worth stating: the browser tooling would not change the viewport
width, so this was confirmed at 1920 only. The rule replaces a side by side
layout with a stacked one, which is the direction that helps a narrow screen
rather than the direction that hurts it, but it has not been seen on a tablet.

## Close Event and Archive: attempted, not completed

Both were reached and both were correctly gated up to the final press.

Close Event: the reason was entered, the confirmation tick accepted, and the
dialog opened reading "Close Main Event? Every scheduled game is recorded and
verified. After this, no player can submit a score for this event, and the
event belongs to cross-checking." The dialog names the event, which is the
behaviour the Event Changes screen was missing.

The final confirmation was refused by the session's own permission layer as a
change to a shared resource. That is a stop rather than something to work
around, so neither Close Event nor Archive was completed. Everything up to the
last press is verified.

## Still open, added after section 5

11. **`isSelf` should be coalesced in the seating directory SQL.** The route
    normalises it, but the null originates in the function and any other caller
    would hit the same 404.
12. **A `router.refresh()` race leaves a saved correction policy showing the
    previous version.** The next save then fails with `stale_policy`.
13. **Resolved disputes vanish from the register**, so there is no record of
    what was raised and how it was settled.
14. **Em dashes in more app copy:** the seating directory's empty Team cell and
    the Event Changes event list, which `b29b82e` changed to a colon.
15. **"Main Eventcompleted" runs together** in the Event Play Control summary
    list, with no separator between the event name and its state.
16. **`display_name` "Tournament participant" now seen in six places,** the
    newest being the dispute register's "Opened by" line and Event Play
    Control's "Last resumed by" line.
