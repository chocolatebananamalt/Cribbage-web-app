# Genesis Rehearsal — corrected steps through registration closure

**Purpose:** Get the existing **Genesis Rehearsal** safely from its already
finalized/open event setup through the registration-closure test. This replaces
the confusing earlier ordering. It does not create fake payment, check-in,
seating, score, or sign-in records on anyone’s behalf.

## Current verified starting point

- Registration is open and the finalized event list is authoritative.
- The six intended roster identities are active: Daron, Maryn, Gabe, Ian,
  Shonni, and Luke. Maryn’s original identity is reinstated.
- There are zero payment records, check-ins, seats, event enrollments, event
  starts, and roster-account links. This is correct before the rehearsal.
- Daron is the director and one co-director is assigned. No cross-checker role
  has yet been assigned.

## Step 1 — setup and public registration (complete)

1. Keep the existing finalized event list. Do not finalize again or create a
   replacement QR link unless you intend to invalidate the old one.
2. The current registration link remains usable. Use it only for a deliberate
   rejection/possible-duplicate test; the six test players already have active
   roster identities.
3. For a same-name-only or shared-email test, submit a new registration with a
   different ACC number (or no ACC number) and a different first/last/email
   combination as appropriate. It becomes **Possible duplicate—director review
   required**, not an active player.
4. In **Players and Registration**, choose either **Same person — reject
   duplicate** or, only when true, **Different person — approve for roster**,
   check the confirmation, then choose **Create approved roster identity**.
   Matching ACC # and exact first/last/email remain hard blocks.

## Step 2 — sign-in and account activation

Each person uses their own email sign-in on their assigned device. A shared
family email is contact information only; it never creates a shared app
account.

1. Daron opens **Player account activation** in Genesis Rehearsal.
2. For every person who will enter a Digital scorecard or serve as an official,
   select **Create Private Link** beside the active roster identity.
3. Send that one-time private link directly to that individual. They sign in
   with their own email on their own device, open the link, and select
   **Confirm activation**.
4. The player reads the request ID and witness phrase to a *different*
   director/co-director who is signed in separately.
5. That different official enters the phrase and selects **Approve witnessed
   match**. The roster account is now linked.

Required links before the scoring rehearsal:

- Daron — Digital player and director.
- Maryn — Digital player/co-director when she is acting as the independent
  witness.
- Gabe — Digital player and cross-checker candidate.
- Shonni — cross-checker candidate; link her as well if she will use the
  signed-in seating directory.

Ian and Luke may remain accountless while they use Paper scorecards. Link them
only if they will sign in to exercise the participant-facing seating directory.
Never use a single account or a single live browser session for two Digital
scorers.

## Step 3 — assign tournament positions

1. Daron confirms the active tournament officials in **Officials**. A
   co-director accepts their own invitation before receiving authority; do not
   share Daron’s sign-in.
2. After Gabe and Shonni each have a linked account, open **Cross-checker
   Assignments**.
3. Select Gabe, then **Assign as Cross-checker**. Repeat for Shonni.
4. Confirm that a director/co-director is not selectable as a cross-checker and
   each cross-checker sees only this tournament’s cross-check work.

## Step 4 — set test payment methods and obligations

This is the first operator-entered financial work; it is not completed
automatically.

1. In **Manual payment evidence**, confirm Cash and Check are enabled.
2. For each rehearsal player, set a made-up amount owed that matches the event
   test you are running. Payment selection at registration is only an intent;
   it is not a receipt.
3. Record one Cash receipt, one Check receipt with a harmless test reference,
   one partial receipt, one void/correction, and one replacement receipt.
4. Confirm received, remaining, status, actor, timestamp, and audit history.
   Do not record a real payment in Genesis Rehearsal.

## Step 5 — readiness checkpoint before closure

Before closing registration, confirm:

- exactly one active roster identity per intended test person;
- any possible duplicate is either rejected or explicitly approved as a
  distinct person;
- Digital scorers and officials have distinct linked accounts;
- Gabe and Shonni are assigned cross-checkers;
- payment-test entries are reviewed; and
- no one has started play, been seated, enrolled, or checked in.

## Step 6 — the registration-closure test (your next click)

1. Open **Check-in and seating**.
2. Select **Close registration** and confirm the warning. This is reversible
   only through the controlled director workflow; it is intentionally not a
   routine toggle.
3. From a different browser/device, open the active registration URL and make
   one harmless test attempt. The app must reject it because registration is
   closed, without revealing the roster.
4. Capture the rejection message. Then return to the director workspace.

## Step 7 — only after closure passes

Check in the six rehearsal entrants, publish the three-table/four-seat initial
plan, verify the directory and printable Paper list, enroll the relevant event
participants, publish schedules, and start each event independently. Those
are later steps; do not start play merely by closing registration.

## Non-negotiable device rule

Signing out preserves unsent offline/retry evidence. Do not clear app data or
hand a device to a different person until the app reports no pending offline
entries or retries and the server has acknowledged them. A personal player may
sign out and later return to the same device without losing their safe local
recovery copy.
# Day-of-play QR check-in update

The old two-official player-account activation ceremony is no longer the
target day-of-play flow. For each event, a director/co-director opens **Day of
Play Event QR Check-In** and displays the live code on an iPad, laptop, or
monitor. Test that it changes after sixty seconds and rejects a stale code or
a wrong event. A valid scan immediately opens a private five-minute completion
session: enter required First name, Last name, Email, and uppercase ACC #
(`HI296` format), then submit before the visible countdown expires. A scan at
the end of a sixty-second display period remains valid for the full five-minute
form window; the original QR secret is removed from the address immediately.
Test the one-minute and thirty-second warnings, expiry, reload retention,
one paid/enrolled exact match, and desk routing for every other case. At the
desk, first record the cash/check evidence and event enrollment, then use the
event-specific check-in action. Do not claim email delivery as tested until the
ACC-controlled Resend/Supabase configuration and 600-in-45-minute evidence are
present.
