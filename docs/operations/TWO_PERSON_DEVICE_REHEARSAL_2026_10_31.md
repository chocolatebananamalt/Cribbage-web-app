## Superseding November 1 single-operator clarification

Daron operates BOTH devices. This plan's independent-human witness steps must NOT
be performed or certified by him as two people. B personally accepted the exact
fixture-only co-director invitation; this does not prove a separate operator.
A local-only labelled simulation implementation0270 is verified; hosted rollout,
explicit enrollment/use and the device outage remain pending separate approval.
See `docs/quality/2026-11-01-simulated-player-links-local.md`. Preserve the draft,
both sessions and all completed finals. The earlier two-person sequence below is
retained for a future actual helper, not claimed as completed.

# Two-person, two-device rehearsal — prepared, not executed

Test Preview: https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app

Verified release: `1c3cd8ceb150cdc16138267220707c8ddb7e4472`. Availability is pending. No fixture, invitation, activation credential, role grant, sign-out, network change or browser action has been performed for this plan. The completed replacement tournaments and unpaid finals remain unchanged.

## Two people suffice for digital scoring, with a setup dependency

Two independently signed-in players can submit matching digital entries, confirm their own entries, save offline, reload and reconnect. This does **not** cover the entire paper/hybrid, mismatch/correction, failed-device or venue-outage release gate.

Recommended accounts avoid another director sign-out:

- Daron uses existing `pr122-director@test.invalid` as director **and digital Player A in the new fixture**. A is the game-side label; no switch to the separate player-A account is required.
- The other person uses existing `pr122-player-b@test.invalid` as digital Player B on their own device. Password entry stays user-operated; no password is sent in chat.
- Fresh roster-account links require an independently witnessed activation. The protected UI is **Create Private Link**, player redemption, then a different person's director/co-director session enters the **Witness phrase** and chooses **Approve witnessed match**. Daron cannot witness his own player request using another account.
- To keep that ceremony to two people, B needs a **new-fixture-only co-director nomination**, personally accepted by the helper. Daron witnesses B's link; the helper as co-director witnesses Daron's link. This requires explicit approval for the scoped role and the two short-lived single-use activation credentials. No new account or password is proposed. Without that role scope, a third authorized independent director/co-director witness is needed.

Both devices need persistent browser storage and an initial internet connection. Avoid private/Guest windows that discard recovery data. Keep the current director Chrome profile signed in; old nonplayer bindings remain confined to their original tournaments. Neither opponent is nominated as a non-playing Cross-Checker in the new fixture.

## Fresh fixture and director preparation — approval pending

Create exactly one new **TEST ONLY — Two-person device/offline rehearsal** in staging. Use ordinary digital scoring, not synthetic official-paper attestation. Two roster entrants, both Digital, linked to the actual operators' existing profiles. No Q or Side Pools.

Use the already exercised Standard Singles Main / 12-game setup, one table/two seats and 12 sequential A-versus-B matchups. Exercise only games 1 and 2; leave the other ten unplayed. This is a non-sanctioned functional rehearsal, not a qualifying tournament or proof of ACC minimum-participant compliance.

Use an explicit $3 paid-Main test setting, not a blank/implicit zero; no actual collection or receipt is claimed. Preserve any required predeclared regular schedule through normal setup. Read back the saved fee, disabled pools, schedule and event binding before activation. No prize, receipt, expense, qualification, playoff or settlement record is planned. If a normal prerequisite cannot be truthfully met, stop rather than fabricate funding or bypass it.

Group preparation before scoring: accepted co-director role and mutually witnessed links; roster check-in/enrollment; published permanent Table/Seat and Verification IDs; registration closed; event attendance closed with no pending desk requests; **Publish Game Schedule**; normal **Start Play**. Read back start, schedule and both assignments. No external email or new password is needed. Do not touch either completed replacement fixture.

## Short participant card

1. Each opens the fresh tournament → **My Games → Current Games → Open Game**. Check names, opponent, game number and Table/Seat. Wait for **Offline Ready** on both while online. Stop if it remains **Preparing Offline Use.**
2. Game 1, online: independently record the observed winner/spread. Each selects **[name] won**, uses the **Spread Points** keypad, then **Review Result → Submit My Independent Entry**. One entry alone must stay pending. If entries disagree, stop rather than guessing a correction.
3. When **Both entries match. Confirm your own entry to continue.** appears, EACH person taps **Confirm My Entry** in their own session. One confirmation alone must not verify it. After both, expect **Game verified. The authoritative scorecard is updated.** / **Verified**. Use **View Scorecard** to check reciprocal rows and totals once; game 2 should now open.
4. Open game 2 online on both and wait again for **Offline Ready**. With explicit outage approval at execution time, person A disconnects only their own device; B stays online. Users perform the brief device disconnect/reconnect themselves. No router, firewall or security changes are proposed.
5. A enters game 2 and uses **Review Result → Submit My Independent Entry**. Expect **Saved Offline, Waiting to Sync** and **Waiting for Connection**. Reload the SAME prepared page once; the entry must survive. B may submit their matching independent entry online. No game may become Verified while required entries/confirmations are missing. Confirmation requires internet.
6. Reconnect A. Expect **Connection restored. Syncing your saved offline entry.** followed by **Offline entry synchronized. Refreshing the server scorecard status.** If **Sync Saved Entry** remains, tap it once and reconcile that same entry. Both then **Confirm My Entry** online. Check two Verified games, one copy of each score on both cards, game 3 current and zero pending recovery entries. Refresh must preserve the result.

Use actual observed results if playing real games. For a shorter device-only exercise, both may independently read prepared fictional outcomes, but record **human-entered fictional results; no physical game played**. Do not claim that such an exercise validates actual paper originals or physical play. Example only: A wins by 15, then B wins by 20 gives one win/two game points each; A plus 15/minus 20/net −5, B plus 20/minus 15/net +5. Never force the example onto an actual result; spreads of 31 or more change skunk game points.

## Pass, stop and remaining role dependencies

Retain fixture/event/game IDs, actual operators, devices/browser versions, whether games were played, written outcomes, offline/reload observations and final states—never passwords or activation credentials. An authorized read-only observer should verify exactly two canonical verified games, four independent player submissions, four confirmations and no duplicate scorelines, with reciprocal totals. Confirm those counts rather than infer them from buttons.

Stop and preserve the page/data if Offline Ready is absent, identity/opponent differs, a result disappears, entries mismatch, verification happens early, authentication expires or a save outcome is uncertain. Reconcile before retry; do not sign out or clear recovery data.

For actual paper/hybrid games, two playing people are insufficient: capture and review require two distinct authorized non-playing officials, and nobody may review their own game/prior entry. Two players plus those two officials means four distinct people, not four accounts shared by two people. A paper player need not have an app account; hybrid still needs its digital-player identity and two official identities. Prepared fictional-card transcription by two non-playing people is a different limited exercise. Lost unsynchronized evidence, deliberate mismatch/correction and whole-venue outage require later scoped scenarios and the relevant independent authorities/replacement-device access.

Pending before action: participants/timing/devices; permission for one fresh staging fixture, B's fixture-only co-director invitation, two one-time roster activations and mutual witnessing, setup/start/two digital games/read-only reconciliation; and agreement for the user-operated single-device outage. Without approved mutual-witness role scope, an additional independent authorized witness is a real prerequisite. No setup has started.

Source-checked labels and guards: current `game/[gameId]/score-entry.tsx`, `games/page.tsx`, `schedule/schedule-client.tsx`; migrations 0093–0094 independent linking, 0164 start/progression, 0236 attendance; paper/hybrid independence contracts. Thirteen focused schedule/start and hybrid-independence tests passed locally. They are supporting evidence, not execution of this human rehearsal.

## Acceptance sequence clarified by Daron — November 1

Stage 1 is the single-operator, two-device TECHNICAL rehearsal. Daron operates both
fictional accounts. After separately approved staging rollout/enrollment and normal
setup, success means the two devices complete matching entries and per-account
confirmations, offline save/reload/reconnect and reconciliation with no duplicates
or lost results, with truthful simulation provenance throughout. A separate human
is NOT a prerequisite or pass criterion for this stage. Local automation is
supporting evidence; the deployed two-device exercise still needs to be run.

Only AFTER Stage 1 works will Daron recruit another person for Stage 2: whether
that person can understand and use the app, plus genuine independent-human identity
and scoring verification. Stage 1 passing is a valid technical result, not a failed
independence test. It does not by itself complete Stage 2 or production readiness.
Publication, hosted migration/enrollment/use and user-operated outage approvals
remain separate; this clarification performs none of those actions.
