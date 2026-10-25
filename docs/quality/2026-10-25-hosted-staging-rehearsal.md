# PR122 hosted staging rehearsal — 2026-10-25

## Environment and boundaries

- Draft PR122 branch: `codex/director-setup-journey`.
- Hosted code: `53feac57217595795c74bc62292ad0c4a5679c6a`.
- User-submitted Preview deployment: `dpl_93ZMQJTtHmHy493cwsNXrcazAnUW`, READY, Preview target, exact repair branch/commit.
- Preview: https://cribbage-web-fvsj5r1ad-cribbage-app.vercel.app
- Sole test backend: Supabase `nnhcnvksxgxnpvdqjgpg` (`cribbage-pr122-staging`).
- All 236 migrations applied in source order with individual CLI transactions and cumulative history. Exact version/name history and all original/copy SHA256 checksums passed; project ACTIVE_HEALTHY. Users/tournaments were zero before identity setup.
- Three branch-only Preview overrides were verified: public staging URL, its modern publishable key, and the user-entered server Secret. Existing Production/default Preview/other branch metadata was unchanged. Server key was not read.
- Automated redeploy was denied for ambiguous API target; it was not bypassed. The user personally submitted the Preview rebuild. No production migration, deployment, merge, real email or payment occurred.

## Authenticated isolation and fixture

The user personally created and signed into `pr122-director@test.invalid`, auto-confirmed without email. Staging metadata verified its exact profile, recent sign-in and sole session, without reading credentials. Independent review approved a guarded, single-transaction fixture bootstrap: director eligibility only, `acc_verified=false`, no platform administrator or invented application. An immutable audit row explicitly identifies the synthetic staging bootstrap.

The Preview's server-authorized Create Tournament page then loaded using that staging-only eligibility. A single app-created tournament subsequently appeared in the same staging database with that director. This verifies the authenticated and privileged server paths against staging rather than relying on public configuration alone.

Fixture tournament: `fd1e310a-d524-433f-a3c3-c443a5e581a5`, **TEST ONLY — PR122 Hosted Checklist 2026-10-25**. Fictional date: 2026-12-14, Hawaii. Main event: `3e106bab-a7a5-439d-9d74-4b1430ce0556`; twelve Standard Singles games, two fictional paper players, zero event fee and one explicit zero-fee Equal Q Pool. This tiny repeating schedule is synthetic integration evidence, not official tournament seating or payout proof.

## Hosted results on 53feac5

Passed through rendered app controls:

1. Create draft once; truthful disabled Creating state; name/date carried into initial setup without assumed time/end date.
2. Venue/director details save; invalid end date rejected without lost fields; corrected details accepted.
3. Twelve-game Main event and Q Pool draft save; saved values survived refresh. Finalization Cancel made no activation, followed by accepted finalization/open registration.
4. Checklist showed steps 1–3 complete and roster as next action. Roster explained that registration was open.
5. Two fictional manual paper players added without email; both tournament check-ins and event enrollments saved.
6. Separate amount-owed records explicitly saved as zero; status became paid with no receipt, charge or payment-provider action.
7. Event attendance remained locked until its window opened; unresolved attendance blocked closing. Both players checked in at desk; closing removed the QR with the intended message and no refresh-failure warning.
8. Registration closed after review; initial seating assigned A-1/A-2; twelve-row reviewed schedule validated and published.
9. Explicit start confirmation reached In Progress, unlocking scores.
10. Nonparticipant official identity confirmed. All twelve synthetic paper games captured from both cards and independently re-entered with distinct per-card references. All twelve exact confirmations accepted; no confirmation remained pending.
11. Standings showed 12/12 resolved and zero unresolved ties: Alpha 24 game points, 12 wins, +180 net; Beta 0 points, -180 net. Qualification finalized and persisted.
12. Close Event Cancel preserved state; subsequent explicit close with synthetic audit reason succeeded and persisted after refresh. Reopen was unavailable after qualification finalization.
13. Cross-check finalization correctly listed all twelve games resolved and no pending score/correction/dispute/recovery queues, but remained disabled because no cross-checker is assigned. No extra permission was granted to bypass that gate.

Read-only database verification independently confirmed one tournament, one event,
one director role, zero platform administrators, one start record, twelve canonical
games all `verified` with winner side `a` and margin15, twelve paper capture records,
twelve `approve` review records, and one `closed` event record. Initial diagnostic
queries used guessed review/close enum literals (`confirm`/`close`); grouping the
actual stored values resolved that query mismatch without a retry or data change.

Director access to a player-only scorecard returned 404; this is not evidence of player-session scorecard behavior. No physical cards were represented as real evidence: references explicitly use SYNTHETIC names.

## Bounded local fixes found by rehearsal

- Successful setup finalization redirected to the disabled registration-link page, producing 404 after a successful backend activation. The existing server feature flag now selects both the truthful success message and destination: enabled goes to registration; disabled returns to the tournament workspace. No flag was enabled.
- Manual roster and protected seating requests briefly displayed Retry labels while still pending. Busy labels now take precedence; completed uncertain requests retain exact retry behavior.
- Changed production files: setup page/client, roster client, seating client. Added focused redirect/pending-label regression tests; updated the existing finalization assertion to cover both guarded routes.
- Independent final source review PASS: authorization, scoring, accounting, request identity and recovery behavior unchanged.

Changed files in this unpublished follow-up:

- `src/app/tournament/[tournamentId]/setup/page.tsx`
- `src/app/tournament/[tournamentId]/setup/setup-client.tsx`
- `src/app/tournament/[tournamentId]/roster/roster-client.tsx`
- `src/app/tournament/[tournamentId]/seating/seating-client.tsx`
- `tests/director-browser.mjs`
- `tests/finalize-registration-and-event-change.test.mjs`
- `tests/setup-activation-redirect.test.mjs`
- `tests/pending-action-labels.test.mjs`
- `PROJECT_STATUS.md`
- This quality report.

## Fresh verification

- Initial restricted `pnpm verify` could not fetch pnpm registry metadata; no test pass claimed.
- First network-enabled aggregate found the old unconditional redirect source assertion. It was updated to require both feature-gated branches rather than removing coverage.
- Final `pnpm verify`: exit 0; **775/775 application tests**, lint 0 errors/2 pre-existing warnings, provider fallback checks, Next 16.4.2 build and TypeScript passed, workspace **7 passed/1 expected private-handoff skip**.
- Existing current-source synthetic Chrome rehearsal: **16/16 evidence checks** passed. Final expanded run: **20/20 checks passed, exit0**, including accepted activation with registration management enabled/disabled, manual roster Adding-player then explicit retry, seating Saving then explicit retry, and identical request-body/idempotency-key replay. The final repeat includes seating in the explicit 390px/1440px overflow sweep; all eleven fixture views passed without horizontal overflow. Independent review passed the rendered-test source. Initial restricted launches failed before page load with localhost `ERR_NETWORK_ACCESS_DENIED`; the first permitted expanded run then caught an exact-text test selector using a period instead of the UI's Unicode ellipsis. Correcting that selector produced the pass. These were recorded failures, not product passes. Tests use isolated mocks, no backend or credentials. Final evidence is retained locally outside the checkout in `director-browser-evidence-1792928039184`; no runtime artifacts are added to Git.
- Fresh full `pnpm audit --json`: exit 0, **0 advisories**, including development dependencies (302 development dependencies reported). Same lockfile; no advisory suppression or dependency changes in this follow-up. GitHub's authoritative record for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) reports `withdrawn_at=2026-10-23T12:53:02Z`, explaining the earlier development-only braces finding no longer appearing. Production audit in aggregate also passed.

## Remaining gates

- These narrow local fixes are not deployed; hosted evidence above applies to 53feac5, not the later working tree.
- Assigned cross-checker, final playoff/settlement/payout reconciliation, full final-results report, realistic eight-player event, digital independent sessions, physical multi-device/offline recovery and real SMTP delivery remain unverified here.
- Public registration QR/link management was disabled in this Preview; its real public submission flow was not tested. No release gate or provider setting was weakened.
- Staging database password was accidentally included by browser accessibility output from a stale reset connection dialog. The dialog was cleared; no value was copied into repository/evidence or used. User-performed staging-only rotation remains recommended and is not yet authorized/completed. Never reuse that password for another purpose.
- Next release step: publish the reviewed local follow-up only through an explicitly permitted Preview update path, then repeat affected hosted navigation. No push or alternate deployment route was attempted while the automated redeploy denial remained binding. Production release/merge remains separately gated.

## Published Preview retest, 2026-10-25 18:40 UTC

The user-authorized push published commit936717746a6083e7c5350ed348c8cfec5e587d2f
on the existing draft PR122. Both exact-SHA GitHub Verify jobs passed; normal
Vercel branch integration produced READY Preview
https://cribbage-web-ddpemvq3g-cribbage-app.vercel.app. No redeploy API retry,
merge, production promotion, or production configuration change occurred.

After the user personally signed in, staging auth metadata confirmed the sole
fictional identity pr122-director@test.invalid (last sign-in18:39:44 UTC).
The new Preview's privileged Create Tournament page succeeded. A second
fictional fixture, TEST ONLY - PR122 Published Fix Retest 2026-10-25,
9443647d-bf58-47a0-a216-ff02d4ce3f10, was created through hosted UI. Independent
read-only queries found it in staging nnhcnvksxgxnpvdqjgpg; the actor matches
the approved fictional director. This verifies the authenticated server write
path anew, without reading any credential.

Hosted results on9367177:
- Create showed Creating, carried the exact name/date into setup, and saved once.
- Required details and twelve-game zero-fee Main event saved as versions1 and2.
- Finalize confirmation accepted; disabled registration-link feature redirected
  to the working tournament workspace, with checklist1-3 Complete and roster Next.
- Manual Paper entry Fictional Gamma showed disabled Adding player during flight.
- Check-in save showed disabled Saving during flight; Checked in survived refresh.
- Database evidence: exactly one activation, one roster entry, one checked_in event
  by the fictional director, and setup versions[1,2]. No duplicate writes observed.
- One diagnostic query incorrectly assumed tournaments.created_by; it failed
  read-only. Corrected verified existing columns, with no data mutation/retry.

The hosted run additionally found disabled Retry Finalize wording during active
activation. A local presentation-only correction now shows Finalizing events
while busy and preserves the prior exact Retry label for unresolved outcomes.
Changed setup-client.tsx and director-browser.mjs only; a400ms synthetic delay
asserts the disabled busy label before navigation. Independent focused review PASS.
This additional correction is not yet published or hosted-tested. No accounting,
scoring, authorization, storage, or request identity changed.

Cross-checker assignment/final settlement, realistic larger event, digital
independent sessions/physical devices/offline recovery, SMTP delivery and the
recommended staging-only database-password rotation remain unresolved exactly
as above. No extra account permission, email, payment or production write occurred.

Fresh local rendered regression after the final wording correction: Chrome20/20,
exit0, including disabled Finalizing events before accepted activation, both
redirect destinations, exact retry bodies and390px/1440px overflow sweeps.
Evidence remains ignored/outside Git in director-browser-evidence-1792954035999.
The first invocations were interrupted before output while command lookup stalled;
explicit trusted runtime paths resolved launch. No failing product check was
reclassified. Aggregate audit passed; remaining aggregate stages tracked below.

Final aggregate rerun exit0:775/775 application tests, production audit0,
lint0errors/2existingwarnings, provider fallback checks, production build and
TypeScript PASS, workspace7pass/1expected private-handoff skip. The first
completed aggregate failed only its workspace Git-ignore subprocess because the
shortened runtime PATH omitted installed Git (spawn status null); adding the
existing trusted Git directory and rerunning the unchanged full aggregate passed.
No verification was weakened. Logs: ignored test-results/pr122-published-retest-
verify-final.log and pr122-published-retest-browser.log. Final diff-check exit0
with line-ending notices only. Four local changed files: setup-client.tsx,
director-browser.mjs, PROJECT_STATUS.md and this report. Commit/remote remains
9367177; the extra reviewed label fix and appended evidence are not published.
Next step: review/publish this small follow-up through the normal repair-branch
path when authorized, then verify its hosted activation busy label. No merge or
production release is authorized.
