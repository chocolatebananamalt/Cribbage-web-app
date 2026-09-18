# Tournament day checklist, 2026-09-19

Written 2026-09-18. Every claim was measured by running the real RPCs against the
live database, or read off the code at a named file and line. Nothing here is
inferred.

Players do not sign in. They scan the QR code on the event display and type their
name, email and ACC number. Only directors and officials sign in.

## Which database the live site uses

The deployed site at `cribbage-web-app.vercel.app` talks to the Supabase project
named **"ACC Tournament Pilot Integration"**, ref `fnjkwymxpnsqvxtpronk`. Despite
the name, that is the live database. Verified from the deployed site's own
Content-Security-Policy header, which `src/proxy.ts:26` generates at request time
from `NEXT_PUBLIC_SUPABASE_URL`:

```
connect-src 'self' https://fnjkwymxpnsqvxtpronk.supabase.co
```

It holds the real roster and the Genesis Rehearsal tournament with five activated
events, and its registration is open.

The other project, `donfxulkliuyteiannir`, is **not** used by the deployed site.
It holds twelve synthetic test tournaments, all with registration closed. Do not
judge readiness by looking at it, and do not be alarmed by its state.

## The click order, start to finish

Each step names the page and the button. The order is not optional: every step
below is enforced by the database, and skipping one produces a refusal later that
usually does not name the real cause.

1. **Setup** page: "Finalize & Open Registration", then confirm the dialog.
   Success looks like "All events are finalized; registration is open".
   This sets both `status='open'` and `registration_status='open'`. Nothing else
   in the system sets either, and **there is no reopen path.**
2. **Payments** page, first section "Accepted payment methods": tick Cash and/or
   Check, then "Save accepted methods".
3. **Roster** page: add every player, with a real **email and ACC number** for
   each one.
4. **Payments** page, second section "Player payment status": for **every**
   player including anyone playing free, enter the amount owed and click "Save
   amount owed". The line must stop reading "Status: not configured".
5. **Payments** page, bottom section: enter the amount received, pick Cash or
   Check, click "Record receipt evidence". Skip for free players, step 4 is
   enough for them.
6. **Seating** page, section 1 "Record check-in": set each present player to
   "Checked in" and click "Save check-in status". **Re-read the status line after
   every save.** Do not touch sections 2 or 3 yet.
7. **Participants** page: choose the event, tick the players, "Enroll selected
   players".
8. **Event Check-In** page: choose the event, "Begin event check-in". Leave the
   live QR on the display. It re-issues every 60 seconds.
9. Players scan and check themselves in. Anyone the QR cannot match lands in
   "Desk requests"; find their row below and use "Check in at desk".
10. "Mark no-show" for absentees with a reason, then "Close event check-in".
11. **Last of all**, back on Seating: close registration, set the table plan, and
    publish the initial seating.

## The traps that will actually cost you

**The Setup "Entry fee" field is not the amount owed.** Setup entry fee is flyer
and configuration data (`setup-client.tsx:146`). The number that gates check-in is
set separately at Payments, "Player payment status", "Save amount owed". Setting
the Setup fee creates no obligation for anybody.

**A failed roster check-in shows no error at all.** `seating-client.tsx:51`
treats a rejection like a success for every code except a closed registration. It
clears the form, refreshes, and says nothing. The row just still reads "Not
checked in". Re-read the status line after each save, every time.

**Mark people "Checked in", never "Late".** The dropdown offers Late, but
enrollment requires the literal state `checked_in`. A player marked Late vanishes
from the Participants list with no explanation.

**Close registration last.** It is one way. Once closed, roster check-in is
refused for the rest of the day, so a late arrival can no longer be admitted. The
schedule amendments page does not rescue this; it records a refund for turning
someone away.

**Every player needs an amount owed set, including free players.** With no
obligation row the desk shows them as unpaid and the button greys out, and
nothing on that screen says why. The diagnosis is only visible on the Payments
page, which shows "Status: not configured, Owed Not set" for exactly those
players.

**Every player needs an ACC number to use the QR.** The QR matches on name, email
and ACC number together. A roster entry with a blank ACC number can never match,
whatever the player types. On the current roster three of seven entries have no
ACC number. Fill them in, or plan to check those people in at the desk.

**A second payment replaces the first, it does not add.** Void the current
receipt, then record the new cumulative total.

**Only digital Standard Singles events can be enrolled through the UI.** Team and
doubles remain paper scored.

**The Consolation event's window will not open until the Main event has
qualification results.** The screen reports this as a generic "not changed"
message.

## When a player is refused at the QR screen

The screen now names the cause. Match it to the row below.

| What the player sees | What happened | What to do |
|---|---|---|
| Could not match those details to the roster | Name, email or ACC number matches no active roster entry | Check spelling and the email on file, or check them in at the desk |
| Not enrolled yet, or fee not recorded as paid | On the roster, but not enrolled in this event or the fee is unset or unpaid | Enroll them, set or settle the fee, rescan |
| Still checked in to another event | Checked in to an event that has not finished | Close that event out, or use the desk |
| Marked as a no show | A director recorded a no show | Reinstate from the desk |
| Time expired, or check-in closed | The five minute session ran out, or the window closed | Reopen the window if needed, then rescan the current code |

## The desk is the fallback

The desk picks the roster row directly, so it does not care about name matching
or a missing ACC number. If the QR refuses someone and the cause is not obvious,
check them in at the desk and keep the room moving.

The desk still needs the player enrolled and their fee set, because it uses the
same money gate.

## What was fixed the night before

- A comped or zero fee player could not be checked in by either route. The money
  gate demanded a payment row instead of treating a settled balance as settled.
  `0219`.
- The desk screen refused the same player even after the gate was fixed, because
  its "paid" indicator was computed separately and still used the strict form. A
  zero dollar receipt cannot be recorded to work around it, so the player was
  stuck. `0221`.
- A voided payment still counted as paid, so a player could self check in after
  their payment was reversed. `0219`, pinned by a test.
- Four unrelated check-in failures all told the player "your time expired". The
  server now reports which one happened and the form explains it. `0220`.

All four are applied to the live database and verified there.

## Four things that will stop the tournament

Each was measured on the deployed site on 2026-09-18. They are ordered by how
early they bite.

### 1. The site must be deployed from Dad's account first

The live site is running the build from 10:38 UTC and is missing the seating
directory fix. Every deploy triggered by Luke's commits was **refused before any
build ran**, with `Git author sukelevensai must have access to the project on
Vercel to create deployments`. Eleven commits, no exceptions: every commit
authored by Luke was blocked, every commit authored by
chocolatebananamalt@gmail.com deployed.

**Merging a pull request is not enough.** GitHub keeps the original author through
a squash merge, so a merge performed by the owner still carries Luke as author and
is still refused. This already happened once and was worked around without being
understood.

What works, and was proven in production today at 09:58 UTC: **Dad pushes any
commit of his own to `main`**, or presses **Redeploy** on the latest `main`
deployment from his own Vercel dashboard. Either one carries everything already
merged, including the seating directory fix.

### 2. Scoring alone works, but only after the deploy

Paper scoring used to need two different signed-in officials: one to confirm
your identity, one to record the cards, one to approve them. That is removed.
A single director can now confirm their own identity, record both cards and
approve the result. Proven end to end on the pilot, through to a finalized
qualification ranking.

Both cards are still required and must still agree, and the approval step still
compares your re-entered result against what you recorded, so the score is still
typed twice. The record names you for both steps.

**The database half is live now. The screens that show the forms only appear
after Dad deploys** (item 1). Until then the paper game page still hides the
recording form.

If the deploy does not happen, the fallback that needs no deploy is a second
official signing in: Genesis Rehearsal already has Dad as director,
maggy416@yahoo.com as co-director and Luke as director and judge.

### 3. An odd number of players is fine now, but rotate the byes

The parity requirement is removed, so seven players in one event is no longer a
problem. With an odd field exactly one player sits out each game.

**Nothing picks the byes for you and nothing compensates them.** You write the
schedule, so you choose who sits out, and a player who sits out earns nothing
that game. Spread the byes evenly or somebody finishes a game short through no
fault of their own.

As with item 2, the database accepts this now; the page stops refusing it once
Dad deploys.

### 4. The schedule is a file you supply, not something the app works out

The Game Schedule page imports director-reviewed pairings. The app pairs nobody.
Prepare a CSV before play starts:

```
Game,Player A ID,Player B ID,Player A Table/Seat,Player B Table/Seat
1,A-1,A-2,A-1,A-2
```

The IDs are the verification IDs that publishing seating assigns, so the file can
only be finished after seating is published. There is a "Download CSV template"
button. Every game number from 1 to the event's game count must be present, with
every player appearing exactly once per game. The page lists each missing piece.

**Start Play lives on this same page**, below the schedule, behind a confirmation
checkbox. It is not on the tournament hub.

## Smaller surprises, none of them faults

- **Closing event check-in leaves a red error.** "The live QR code could not be
  refreshed" is the QR poller still running after the window shut. The close
  already worked.
- **The tournament list can be empty on the first page load after signing in.**
  It says "Tournaments are temporarily unavailable". Reload once and it is there.
- **Once a schedule is published, that event's player list is frozen.** The
  database refuses to add or remove a participant afterwards.

## Known, not fixed

- **Seating Directory returns 500 for every signed-in user on the live site.**
  Confirmed twice on 2026-09-18, on two different tournaments, one of them with
  seating actually published. The fix is merged into `main` as `02d2234`. It is
  not deployed. Item 1 above is what deploys it.
- The first thing to do tomorrow morning is load Seating Directory and Event QR
  Check-In **while signed in as a director**, after the deploy. Every route
  redirects anonymous requests, so no amount of signed-out checking can see past
  the sign-in gate.
