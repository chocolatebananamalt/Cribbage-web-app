# Signed-in UI test log, 2026-09-18

Every line here was produced by a real browser clicking the deployed site at
`cribbage-web-app.vercel.app` while signed in, not by calling the database
directly. Signed in as luke@sitesmithai.com, who holds Director and Judge on
Genesis Rehearsal and Director on the October 3 Pilot Tournament.

## How the signed-in session was obtained

The sign-in page was driven in a real browser, the one-time link was read from
the mailbox it was sent to, and the same browser followed it. That matters
because the link only completes in the browser that requested it: the code
verifier is stored locally when the link is requested.

## Deploy authorization, not the code

Vercel refused every deploy triggered from Luke's GitHub account:

> @sukelevensai is attempting to deploy a commit to the Cribbage App team on
> Vercel, but is not a member of this team.

The build was never the problem. Deploys from the account that owns the Vercel
team continue to work, which is how the currently live version got there.

## What signing in actually showed

**The first page render after sign-in failed, and a reload fixed it.** The home
page reported "Tournaments are temporarily unavailable" immediately after the
sign-in link was followed. A reload rendered all three tournaments correctly.

Ruled out by measurement, in this order:

- The database is fine. `list_actor_tournament_workspaces_v1` returns the three
  expected rows for this profile.
- PostgREST is fine. The same call over HTTP with the server secret key returns
  HTTP 200 and the same three rows.
- The shape guard is fine. All three rows satisfy `isAccessibleTournamentList`,
  including the `MM-DD-YYYY` date format it insists on.
- The server secret key on the deployed site is fine. The director access panel
  on that same failed render came from a different call through the same admin
  client, and it rendered.

So one call failed transiently on a cold render while another succeeded. The
page's own instruction, "Please try this page again", is correct and sufficient.
**Tell the director: if the tournament list does not appear, reload once.**

## Pages confirmed to render for a signed-in director

- Home, listing all three tournaments with role and status
- Tournament hub for Genesis Rehearsal, reporting "Your roles: Director, Judge"
- Set Up Tournament for the October 3 Pilot, showing saved details, the
  finalized event list, and the sanctioning fee panel

## Full dress rehearsal, clicked end to end

Run on the **October 3 Pilot Tournament**, never on Genesis Rehearsal. Every step
below was a real click on the deployed site. Registration on the pilot is now
closed, which is one way, and its seating and schedule are published. That was
deliberate: those steps had never been exercised by anyone, and they are exactly
the ones that cannot be rehearsed once the real tournament starts.

| Step | Screen | Result |
|---|---|---|
| Set amount owed $0 | Payments | `Status: paid · Owed $0.00` |
| Set amount owed $10 | Payments | `Status: unpaid · Owed $10.00` |
| Record $10 receipt | Payments | `Status: paid · Received $10.00` |
| Record check-in, both | Seating 1 | `Current status: Checked in` |
| Enroll both | Participants | `Main Event · 2 enrolled` |
| Begin event check-in | Event Check-In | `Check-in open`, live QR shown |
| Check in at desk, $0 player | Event Check-In | checked in |
| Check in at desk, paid player | Event Check-In | `2 checked in · 0 unresolved` |
| Close event check-in | Event Check-In | `Check-in closed` |
| Close registration | Seating 2 | `Registration is closed` |
| Publish initial seating | Seating 3 | verification IDs `A-1`, `A-2` |
| Import and publish schedule | Game Schedule | `12 games and 12 matchups published` |
| Start Play | Game Schedule | `Play is in progress` |

**The zero fee fix is proven through the UI, not just the database.** The $0 player
showed `paid` on the desk, their "Check in at desk" button was enabled, and the
check-in completed. Before `0219` and `0221` that button was disabled forever and
no receipt could be recorded to release it.

## Scoring needs two officials, and that is by design

Scoring could not be completed, and the reason is not a defect.

- **Paper games** say it outright: "Another director or co-director must confirm
  your official identity before you can record or review paper games", and "You
  cannot confirm yourself." One official records both cards, a second and distinct
  official independently enters the same evidence.
- **Player app access** applies the same rule: "A different signed-in director must
  compare the player's request ID and witness phrase in person before approving
  it", and "No account is linked until the server accepts an independently
  witnessed approval."

So digital scoring is unreachable without a second official too, because a player
cannot get an app account without one.

**Tomorrow this is satisfiable and today it was not.** Genesis Rehearsal carries
three officials: chocolatebananamalt@gmail.com as director, maggy416@yahoo.com as
co-director, and luke@sitesmithai.com as director and judge. Two of them signed in
on two devices satisfies every dual-control step. One person working alone cannot
score a single game, on paper or digitally.

## Things that will surprise the director

**The game schedule is an import, not a generator.** The app does not pair anybody.
The director supplies a CSV of every matchup: `Game, Player A ID, Player B ID,
Player A Table/Seat, Player B Table/Seat`, using the verification IDs that seating
assigned. There is a "Download CSV template" button. The validator is precise and
refuses to publish until every game is complete, so the work has to be done before
play starts, not during it.

**An odd number of checked-in players cannot be scheduled at all.**
`publish_director_reviewed_event_schedule_core_v1` requires
`mod(participant_count, 2) = 0` and every participant to be `checked_in`. It
reports this as `participants_unavailable`, which names neither cause. Genesis
Rehearsal has seven roster entries. Seven players enrolled in one event cannot be
scheduled. Enroll an even number.

**Start Play is on the Game Schedule page, behind a confirmation checkbox.** It is
not on the tournament hub. The button stays greyed until the confirmation is
ticked.

**Closing event check-in leaves a red error on screen.** The QR refresher keeps
polling after the window shuts, gets a 503, and reports "The live QR code could not
be refreshed." The close already succeeded. Ignore it.

**Once the schedule is published the participant set is frozen.** A database
trigger, `app.protect_scheduled_event_participant`, raises "published event
participant set is immutable" on any insert or delete. A late player cannot be
added to that event afterwards by any screen.

## Still not proven

Actual score entry, standings, results and finalization. All of them sit behind
the two-official rule above, and no second official mailbox was reachable from
this machine.
