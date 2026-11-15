# Proposed morning handoff for Daron

The simpler setup flow and empty-draft Save fix are live on the **test preview**. The later mock, seating, bracket and pool-summary work is saved locally and tested within its stated limits; it has not been published. We have not changed your open tab or tournament data overnight.

**The full eighteen-player weekend mock is not ready to promise yet.** The main gap is safely publishing the random draw into permanent starting seats; the final real-account/browser path and simulated payout settings also need completion. Public bracket/pool viewing is not enabled yet. Local test passes do not establish a complete human trial.

## First: finish the setup check

1. Reopen the existing setup tab. If it still contains unsaved deletions from the old version, refreshing will discard those deletions and bring back the last saved events. Preserve anything new you want to keep before choosing to refresh; the agent will not refresh it remotely.
2. After deliberately loading the updated test version, inspect which events actually appear. To clear them for the clean test, remove saved Consolation children before Main; remove Satellite first if the screen requires it. No agent deletion is planned.
3. Click **Save All Events Draft** once on the changed empty list. Wait for its version/date/time confirmation, then refresh once to confirm the empty draft stayed saved. Do not Finalize.
4. Try **Add Main Event**, finish its pools, then answer the Consolation question. **Yes** immediately opens its associated Consolation once; **No** asks for confirmation, then allows Satellite. Save before leaving. No Link/Unlink step is needed in the normal flow.

The published patch is ba2845a; both CI runs and the preview deployment passed. Authenticated hosted rendering still needs Daron's walkthrough; a signed-out automated check stopped at deployment login. No new hosted read was used to prepare this handoff, so it does not assert the current contents/version of his draft.

## Then: eighteen-person mock checklist

- [ ] Finish and review the native random-draw publisher. Prove stale roster/role rejection, exact retry, competing updates and rollback in an expressly authorized disposable local database before release.
- [ ] Verify the final integrated browser/account/backend path and preserve the standard scoring/offline safeguards. New mixed acknowledgment/official-workflow offline acceptance is still unproved.
- [ ] Review the exact test release and migrations, verify a current recoverable staging backup by isolated restore and confirm preserved fixtures. Obtain test-only publication approval before applying anything. A source ZIP is not a database recovery point.
- [ ] Approve one separately labeled mock: **18 entries, six real Digital participants, twelve fictional Paper players, twelve qualifying games, 108 matches**. Keep the first end-to-end mixed trial to one Standard Main; Main-only simulated financial closure is the proven local scope.
- [ ] Confirm each real person's own account/player link and personally accepted duties. Recommended coverage is Director plus two cross-checker-capable people, rotating duties around their own games. No new account, role invitation or enrollment has been authorized by this checklist.
- [ ] Agree the simulated fees, pool participation, payout method/parameters and expenses. No actual collection/payment; calculated awards remain explicitly simulated and unpaid. Do not force real winners to obtain a desired pool example.
- [ ] Check in truthfully, close registration and use the actual random draw. Review volunteer stationary Seat1 and the real opposed odd/even eighteen-seat arrangement. Walk the room/end routes once. Validate twelve distinct opponents per player and no sit-outs; publish and distribute fixed Tournament IDs only through the proven native path.
- [ ] Generate the twelve fictional paper cards from that frozen draw. Predetermine only explicitly synthetic Paper/Paper and Paper/Digital results; record actual Digital/Digital outcomes as played. Keep an independent answer key for game points and spread points.
- [ ] First complete one game of each pairing plus mismatch/retry checks, then continue the rest. DD needs both real players' entries and confirmations. PD needs the real player's entry/explicit synthetic-opponent acknowledgment, a nonplaying-in-that-game Cross-checker capture and a different eligible official's review. PP permits one independent official in the native workflow, but use two people for a meaningful independent paper comparison. Never claim two people reviewed if only one did. Judge alone does not replace these roles.
- [ ] Finish all108 matches, resolve actual qualification ties using the agreed head-to-head/deciding-game procedure, complete the supported five-qualifier playoffs and source-bound cross-check. Independently reconcile all game points, wins, positive/negative/net spread points and each simulated fund. No real money or official ACC submission follows from this mock.

## Approvals needed later — not being requested overnight

1. One disposable **local** verification database with eighteen anonymized entries/test identities, current migrations/reviewed proposals, concurrent recovery/permission tests and verified cleanup. Automatic approval review previously denied a fresh fixture under the no-fixture instruction; it was not executed or retried. This permission would not authorize staging or deployment.
2. The reviewed test-preview release/database changes after the verified recovery preflight; exact scope is not frozen yet because the native publisher is unfinished.
3. One exact hosted mock and simulated-finance enrollment, named real account/role invitations and any required identity-link actions. People personally accept their roles/links. Real funds remain excluded.

Safe work that can continue meanwhile: pure publication/recovery contract tests, source/lock/grant inventory, independent answer-key and paper instructions, and minimal public bracket/pool access design. No decision about equal Side Pool rules or ordinary real-money payouts is invented.

## Internal evidence for parent

- Published setup: docs/quality/2026-11-04-simple-event-flow-preview-rollout.md.
- Critical-path plan: docs/decisions/2026-11-04-eighteen-mock-staged-readiness.md.
- Mixed representative browser/backend and later scope proof: docs/quality/2026-11-04-mixed-browser-path-local.md and 2026-11-04-mixed-player-scope-local.md.
- Native publication gap: docs/quality/2026-11-04-reviewed-draw-native-preflight-local.md.
- Movement/physical limits: docs/quality/2026-11-04-one-table-movement-local.md.
- Public contract remains prepared-not-authorized: docs/quality/2026-11-04-event-published-projection-local.md.

No fixtures, hosted records, invitations, publication or denied-operation retries occurred while preparing this checklist. This is a proposed handoff, not a scheduled message or approval request sent to Daron.
