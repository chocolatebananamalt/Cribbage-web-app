# October pilot rehearsal — Singles and supported two-person teams

Target completion: 2026-09-17  
Pilot go/no-go: 2026-09-18  
Live tournament: 2026-10-03

## Purpose

Prove the October-critical workflows with independent people,
devices, and browser sessions before official scores are accepted. This is an
evidence checklist, not a request for additional product design.

The rehearsal must cover Standard Singles and, once the implementation is
available, two-person Traditional Doubles and Canadian Doubles in both captain-
selected Digital and Paper modes. Generic/custom team formats remain
paper-only. It must also cover the participant seating directory and zero
through six configurable Side Pools; these are release blockers, not deferred
post-October work.

## Required people and equipment

- one director and one co-director with separate accounts;
- two digital players with separate accounts and phones;
- two authorized officials able to act independently and never review their
  own game or their own prior official entry;
- two paper scorecards and at least one digital-versus-paper pairing;
- a second network or hotspot that can be disabled and restored; and
- one replacement phone or fresh browser profile for failed-device recovery.

Names, emails, ACC numbers, and payment details used in rehearsal must be
fictional. Do not use live October entrants until the rehearsal passes.

## Preflight

1. Confirm Vercel Production reports READY for the reviewed release candidate.
2. Confirm the Supabase migration history includes `0163`.
3. Confirm the Vercel runtime-error view is empty before the exercise.
4. Open the distinct draft **Full Rehearsal — 09-16-2026** from **Your
   tournaments** and configure its Standard Singles plus supported doubles
   events. Do not reuse Pilot
   Tournament or October 3 Pilot Tournament.
5. Add the required fictional roster entries with explicit digital/paper
   scorecard choices; do not reuse the real October roster.
6. Confirm the protected account-activation, cross-checker-assignment, and Rule
   12 workspaces load only for their intended tournament roles. These required
   October workflows are released and no longer depend on deployment toggles.

## Rehearsal sequence

Use these six fictional identities in six independent sessions:

1. primary director/player with a digital scorecard;
2. co-director who does not play;
3. cross-checker/player with a paper scorecard;
4. cross-checker who does not play;
5. player with a digital scorecard; and
6. player with a paper scorecard.

Prepare two paper scorecards, one camera-capable device, one sample roster CSV,
cash/check test transactions, and predetermined results containing one mismatch
and one correction. Every email, name, ACC number, and payment reference must
be fictional.

### A. Identity, registration, and access

- Register one player through the public link/QR path.
- Add one player manually and one through CSV intake.
- Review a duplicate-looking claim and prove approve/reject behavior.
- Complete one witnessed roster-account activation with two distinct officials.
- Assign at least two linked accounts as cross-checkers from the protected
  director workspace, then confirm each account receives only that tournament's
  cross-check tools.
- Prove outsider, revoked-role, expired-link, replay, and self-review rejection.

### B. Check-in, seating, enrollment, and schedule

- Check in every rehearsal entrant, close registration, and confirm the signup
  link no longer accepts entries.
- Publish permanent initial Table/Seat assignments and verify those values are
  also the players' permanent verification IDs.
- Verify both members see the team assignment and permanent team Verification
  ID, and verify each signed-in paper participant sees their own assignment.
- After publication, search the seating directory by partial name and exact
  normalized ACC number. Confirm results disclose only name/team,
  scorecard type, and Table/Seat; prove pre-publication and cross-tournament
  denial and private-field non-disclosure. Exercise director paper/digital,
  singles/team, and Table/Seat filters plus printable paper-card lists.
- Enroll the checked-in players in the event.
- Import or enter a director-reviewed schedule and prove duplicate player,
  duplicate seat, missing opponent, and capacity violations are rejected.

### C. Digital scoring

- Two players independently enter the same winner and 1–121 spread.
- Each player confirms the reciprocal result from their own session.
- Verify the server changes the game to Verified only after both independent
  submissions and both confirmations.
- Verify both scorecards, totals, standings, and current-game progression.
- Repeat with mismatched entries, duplicate submission, reload, and an exact
  retry after an intentionally interrupted response.

### D. Paper and hybrid cross-checking

- Complete one paper-versus-paper game through two distinct official entries.
- Complete one digital-versus-paper game using one digital submission and the
  independently reviewed paper evidence.
- Prove an official cannot review their own game or their own prior entry.
- Prove mismatched evidence stays pending and does not alter standings.

### D1. Supported team scoring

- Register a captain and partner, claim the team from the partner account, and
  reject duplicate identities, unauthorized changes, and mismatched personal
  preferences without overwriting either player's record.
- Exercise captain-selected Digital and Paper team modes, scorer replacement,
  missing linked Digital scorer resolution, and full-name team display.
- Schedule Traditional and Canadian Doubles and verify team seating, all four
  displayed members, team Verification IDs, current-game Table/Seat, and
  reciprocal scorecard lines.
- Exercise Digital/Digital, Digital/Paper, and Paper/Paper games, winner/spread
  mismatch, corrections, offline queue/reconnect exactly-once replay, and
  rejection when the creator attempts self-confirmation. Confirm only verified
  or corrected games reach team standings/qualification and both members are
  preserved in results, finance, pools, reports, and audit history.

### E. Correction and dispute

- Use the already released protected Rule 12 correction workspace; no hosting
  environment change is required.
- Submit one valid correction, preserve the original value/editor/timestamp,
  and exercise both immediate authority and second-review policy.
- Exercise rejection, stale-policy, duplicate, lost-response, and affected-
  player notice behavior.
- Resolve one event dispute and verify finalization refuses an unresolved one.

### F. Offline and failed-device recovery

- **Single-device outage:** load the assigned game while online, disconnect
  only that device, enter a score, reload/restart, and prove the pending entry
  remains. Reconnect and verify exact-once replay and server reconciliation.
- Create a conflicting surviving entry and prove the conflict remains visible.
- Simulate a lost phone. Rebuild synchronized games on a replacement device,
  then recover one unsynchronized result from opponent/paper evidence using two
  independent officials.
- **Whole-venue outage:** sign in and open the rehearsal on every device while
  internet is available. Put all devices on the same Wi-Fi/router or hotspot,
  disable cellular data, and then disconnect that router's internet, switch off
  the router, or turn off the hotspot. Record different results on the digital
  devices while paper players continue on paper. Each digital device must say
  its entry is stored locally and awaiting synchronization.
- Restore the venue connection. Confirm every queued entry synchronizes with
  no missing or duplicate score, compare reconstructed cards with the opposing
  devices and paper cards, and confirm no game becomes Verified until the
  required independent entries and confirmations arrive.

### G. Results and finances

- Complete enough verified games to produce a qualification preview.
- Finalize qualification only when the readiness gate is clear.
- Enter playoff winner/runner-up separately from qualifying order.
- Confirm the high non-qualifier follows the final qualifier.
- Record and void a manual receipt and expense; verify active totals and audit
  history.
- Complete the settlement working copy, bind the reviewed sources, and prove
  finalization rejects missing scores, disputes, corrections, or source data.
- Configure zero through six Side Pools; reject a seventh and duplicate
  normalized name, permit equal fees under different names, and verify
  elections, amounts due/received/remaining, cash/check references,
  corrections/voids, posted policy, cross-checked payouts, exact cents,
  event PDF, combined tournament PDF, CSV, and finalization.

### H. Recovery and release

- Capture the approved database backup/export and its table counts/checksums.
- Restore into an isolated environment and compare the documented totals.
- The Vercel rollback-and-forward-release drill passed on 2026-09-12; repeat it
  only if the application code changes materially after that date.
- Re-run `pnpm verify`, `pnpm verify:handoff`, phone/desktop browser checks, and
  the Vercel runtime-error scan on the final candidate.

## Evidence to retain

- date/time, environment, participants, devices, and browser versions;
- the rehearsal tournament/event identifiers (never credentials);
- screenshots of each terminal state and rejection message;
- server record counts, audit event identifiers, and scorecard/standing totals;
- offline queue state before and after reconnect, with no private data;
- backup snapshot and restored integrity summary; and
- every failure, fix commit, re-test result, and remaining limitation.

## Go/no-go rule

Go only when every section above passes, the restored database integrity check
matches, the director accepts the workflow, and no unresolved P0/P1 issue or
Vercel runtime-error cluster remains. Any failure leaves the affected workflow
unaccepted and the established paper process authoritative.
