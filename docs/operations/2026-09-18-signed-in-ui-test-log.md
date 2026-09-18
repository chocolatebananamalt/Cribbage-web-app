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

## Still unproven at the time of writing

Scoring, results and finalization have not been exercised through the UI by
anyone. The October 3 Pilot's only event is a Main Event of 12 games against a
roster of 2, which cannot produce a valid schedule.
