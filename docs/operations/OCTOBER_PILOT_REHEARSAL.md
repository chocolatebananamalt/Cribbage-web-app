# October Standard Singles pilot rehearsal

Target completion: 2026-09-17  
Pilot go/no-go: 2026-09-18  
Live tournament: 2026-10-03

## Purpose

Prove the already deployed October-critical workflows with independent people,
devices, and browser sessions before official scores are accepted. This is an
evidence checklist, not a request for additional product design.

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

1. Confirm Vercel Production reports READY for commit `6845888` or a reviewed
   descendant containing the same application code.
2. Confirm the Supabase migration history includes `0151`.
3. Confirm the Vercel runtime-error view is empty before the exercise.
4. Create a clearly labeled rehearsal tournament and Standard Singles event.
5. Add the required fictional roster entries with explicit digital/paper
   scorecard choices; do not reuse the real October roster.
6. Keep the account-activation and Rule 12 release flags closed in Production.
   Exercise those paths in Preview first, using the same reviewed code and the
   controlled rehearsal tournament.

## Rehearsal sequence

### A. Identity, registration, and access

- Register one player through the public link/QR path.
- Add one player manually and one through CSV intake.
- Review a duplicate-looking claim and prove approve/reject behavior.
- Complete one witnessed roster-account activation with two distinct officials.
- Prove outsider, revoked-role, expired-link, replay, and self-review rejection.

### B. Check-in, seating, enrollment, and schedule

- Check in every rehearsal entrant, close registration, and confirm the signup
  link no longer accepts entries.
- Publish permanent initial Table/Seat assignments and verify those values are
  also the players' permanent verification IDs.
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

### E. Correction and dispute

- In Preview, enable `ACC_RULE12_CORRECTION_ENABLED=approved-0140` only for the
  controlled rehearsal deployment.
- Submit one valid correction, preserve the original value/editor/timestamp,
  and exercise both immediate authority and second-review policy.
- Exercise rejection, stale-policy, duplicate, lost-response, and affected-
  player notice behavior.
- Resolve one event dispute and verify finalization refuses an unresolved one.

### F. Offline and failed-device recovery

- Load the assigned game while online, then disconnect the phone.
- Enter a score offline, reload/restart, and prove the pending entry remains.
- Reconnect and verify exact-once replay and server reconciliation.
- Create a conflicting surviving entry and prove the conflict remains visible.
- Simulate a lost phone. Rebuild synchronized games on a replacement device,
  then recover one unsynchronized result from opponent/paper evidence using two
  independent officials.

### G. Results and finances

- Complete enough verified games to produce a qualification preview.
- Finalize qualification only when the readiness gate is clear.
- Enter playoff winner/runner-up separately from qualifying order.
- Confirm the high non-qualifier follows the final qualifier.
- Record and void a manual receipt and expense; verify active totals and audit
  history.
- Complete the settlement working copy, bind the reviewed sources, and prove
  finalization rejects missing scores, disputes, corrections, or source data.

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
Vercel runtime-error cluster remains. Only then enable the reviewed Production
account-activation and Rule 12 flags. Any failure leaves the affected feature
closed and the established paper process authoritative.
