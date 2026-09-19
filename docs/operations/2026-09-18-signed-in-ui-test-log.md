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

## Scoring, results and finalization: now proven

Two rules blocked this and Luke asked for both to be removed on 2026-09-18.
Migrations `0222` and `0223` are applied to the live database. With them in
place the entire chain was driven to the end:

- **12 of 12 games scored.** A single director bound their own official
  identity, recorded both paper cards and approved the result. Before `0223`
  each of those three steps needed a second, different signed-in official.
- **Live standings rendered from the scores.** "12 of 12 scheduled matchups
  resolved. Every scheduled matchup has verified or corrected scorecards."
- **Finalize Qualification completed.** The locked ranking reads: qualifier
  Browser Pilot Player, 16 game points, 7 won, +49 net; high non-qualifier
  Pilot Test Player, 12 game points, 5 won, -49 net. "Finalized by Tournament
  participant."

So the full path now has evidence behind it, start to finish:

  setup, payments, roster check-in, enrollment, event check-in with a live QR,
  desk check-in, closing registration, publishing seating, importing and
  publishing a schedule, Start Play, scoring every game, standings, and
  finalization.

### What was removed, and what was deliberately kept

Removed: the requirement that two *different* officials be involved. That was
enforced in five places, four functions and one table constraint. The
constraint, `official_profile_id <> confirming_profile_id`, was found only by
calling the function; reading the code alone would have missed it, and it fails
as a raw database error rather than a handled rejection.

Kept, and re-verified by deliberately trying to break each one:

| Rule | Test | Result |
|---|---|---|
| Both paper cards must agree | recorded winner a/21 against winner b/9 | rejected, `nonreciprocal_card_claims` |
| The confirmation must match what was recorded | approved with margin 7 against a recorded 21 | rejected, `review_claims_mismatch` |
| An official may not score their own game | `paper_official_is_independent` untouched | unchanged |
| The audit trail names who did what | read back after a solo completion | recorder and approver both recorded, role `director` |

The result is still entered twice and still compared. One person may now enter
it both times, which is exactly what Luke asked for and is a real reduction in
control. It is not anonymous: the record shows the same person did both.

## An odd number of players can now be scheduled

`0222` removes the parity requirement. With an odd field exactly one player sits
out each game. Verified: three players over three games, five over two, and
seven over twelve all validate, while a player appearing twice in one game, a
game short a match, and an unenrolled ID are all still rejected.

**Byes are not handled for you.** The director supplies the schedule, so the
director picks who sits out, and a player who sits out earns nothing that game.
Rotate the byes by hand or somebody finishes a game short.

## What is still unproven, stated plainly

The lone-official path was proven by calling the RPCs and by reading the pages
back. **The new paper-game form itself has never rendered in a browser**, because
it only exists on the branch: the deployed page still gates on
`actorRole === "cross_checker" && actorIdentityConfirmed`. Its first render will
be on Dad's deploy.

That gate also means the live site cannot start paper scoring at all today.
Genesis Rehearsal's officials are two directors, a co-director and a judge, with
no cross-checker and no bound identities. Checklist item 2 carries the two-minute
fix.

Normal singles scoring is unaffected by any of this. Players enter their own
scores at `/tournament/<id>/game/<gameId>` after Start Play, and that path needs
no official.

One cosmetic thing on the finalized page: it reads "Finalized by Tournament
participant" although a director did it. `display_name` is unset on these
profiles. Harmless, but it will be on screen.
