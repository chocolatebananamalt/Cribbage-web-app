# Larger paper rehearsal and digital-player prerequisites

## Scope and environment

Hosted build6d9fc549dd5e666e0c50ea13b3f06edc20d47738, isolated Preview
https://cribbage-web-megtq2kct-cribbage-app.vercel.app, sole approved staging
project nnhcnvksxgxnpvdqjgpg. Existing fictional director only; no new Auth
identity, credential, role, permission, provider setting or production change.

New fixture: **TEST ONLY - PR122 Sixteen Paper Rehearsal 2026-10-26**,
tournament c59f74ae-1174-4e3a-b1d4-4d9d0ddebc2d; Main event
4af492ef-18ea-48de-91eb-9e5fa07fbcca. Standard Singles,12 games, activated
digital event infrastructure with all16 roster scorecard preferences Paper.
Entry and Equal/Pays-All-Equally Q Pool fees are0. No receipt, expense, payout
or money movement was recorded. Public contact fields remain fictional/blank.

Acceptance:16 distinct fictional paper identities; independent tournament and
event attendance; explicit zero owed;4x4 permanent seats; complete validated
96-match schedule; exactly one start; bounded first-round paper capture and
independent re-entry; truthful partial standings and finalization blockers.

## Executed hosted paper checks

1. Creation carried the name/date. Details saved first, then twelve-game Main
   and zero-fee Q Pool saved. Finalization Cancel and refresh preserved the
   draft; later explicit finalization opened registration.
2. Generated16-row CSV and96-match synthetic manual schedule were validated
   and independently reviewed. Each of12 game numbers has8 matches; every
   player/seat appears once per game, same-table opponents, two pairs/table,
   no repeated pair and12 distinct opponents/player. This is a synthetic
   director-reviewed schedule, **not an ACC-approved rotation fixture**.
3. CSV file upload failed before transfer because the Chrome extension lacks
   file-URL access. No permission was changed. Used normal manual entry for
   TEST ONLY Paper01 through Paper16, all Paper, no email/ACC data. Refresh
   preserved16 rows. CSV intake itself remains untested in this environment.
4. Tournament check-in recorded all16. Refresh interrupted the final response;
   the exact saved request for Paper16 was recovered and other writes locked.
   Read-only staging SQL first showed16 committed check-in events. Explicit
   review/replay of that exact request cleared recovery; count remained16.
   This is actual interrupted-response/idempotent-replay evidence, not a
   manufactured backend error or blind duplicate write.
5. Enrolled16 checked-in players; repeated enrollment controls then disabled.
   Explicit amount-owed0 saved for each; refresh showed owed/received/remaining0.
   Independent database counts:16 zero-owed versions,0 receipt events.
6. Event attendance initially closed with16 unresolved and desk rows disabled.
   Opened it; closure remained disabled with16 unresolved. Recorded16 desk
   check-ins, never clicked Send app access. Closed after zero unresolved;
   intended QR removal message appeared without QR-refresh failure warning.
   No bearer QR/activation value was captured in evidence.
7. Closed registration after reviewed attendance. Reviewed and published16
   permanent seats A-1..D-4 at4 tables/4 seats; names matched the fixture.
8. Invalid self-pairing CSV was rejected locally with Line2 error and Publish
   disabled. Restored valid96 rows in the existing paste-CSV control, reviewed,
   and published once. File upload permission was not needed for this separate
   supported text input.
9. Start stayed disabled before final readiness confirmation. Explicit start
   succeeded: database exactly1 start and96 canonical games; UI In Progress.
10. Confirmed director identity as a nonparticipant. Mismatched paper spreads
    15/14 blocked capture. Corrected matching synthetic card claims; captured
    all8 first-round matches and separately re-entered each pair/reference.
    Each side used a distinct TEST ONLY SYNTHETIC reference; no real card/photo
    was represented. Current paper rules permit one authorized nonplaying
    official to do capture and re-entry; this does not prove two human officials
    or two digital player sessions.
11. Database:8 captures,8 approve reviews,8 canonical games verified with sideA
    winner/margin15,88 pending. Standings after refresh: Paper01–08 each1 game,
    2points/1win/+15; Paper09–16 each1 game,0points/0wins/-15. Two tied groups.
    Qualification disabled with88/96 unresolved. No final results were claimed.
12. Cross-check finalization disabled: no assigned cross-checker plus88 unfinished
    games. No role was granted or guard bypassed. Event remains In Progress.

Browser-tool observations occasionally returned a wrapper error after an action;
fresh UI/SQL established exact outcomes before continuing. No uncertain write
was repeated. A selector expecting an exact wrapped label failed before input;
the observed partial label selected the intended manual/schedule control.

Local fixture files remain ignored in test-results:make-larger-paper-fixture.mjs,
larger-paper-roster.csv and larger-paper-schedule.csv. Parser/validator exit0;
independent structural and workflow review PASS. No production rotation or
accounting code was changed to make the rehearsal pass.

## Independent digital scoring: exact missing prerequisites

Read-only staging metadata confirms one Auth user, the director; the16 paper
participants have no linked profile. Neither this director's demo scorecard nor
the paper re-entry above establishes independent digital scoring.

Minimal next setup requires **two new fictional staging-only password accounts**,
unique test.invalid addresses, email auto-confirmed, no invitation/email delivery,
and no director/co-director or manual player-role grant. Account creation has
**not been attempted** under the current no-new-credentials/security boundary;
this is an authorization/access prerequisite, not a denial or uncertain request.
Passwords must be entered through a secure user handoff, never chat/logs.

Then use a **fresh two-player Digital tournament/event**, leaving this started
paper event unchanged. Supported order: Digital roster -> both players sign in
-> director issues each private activation -> player redeems in their own session
-> existing director verifies phrase and approves -> check-in and enrollment
capture linked profile -> zero-owed/attendance/seating/schedule/start -> both
players independently submit and each confirms. Test mismatch, own-confirmation
restriction, duplicate/reload and standings only with those real separate sessions.

Three isolated contexts/profiles/devices are needed: director, playerA, playerB.
Same-origin tabs in one Chrome profile share auth cookies and are not independent.
Existing director may issue and approve another player's link:0094 rejects
approver==redeeming player,0127 canApprove uses the same predicate,0093 rejects
self-linking. There is no requirement for a second issuer/co-director. Independent
source review and57 focused tests verified this reading. Normal password sign-in
does not create users; OTP would send email, so neither is a no-email substitute
for authorized admin Auth creation. Linking after prior enrollment does not
backfill participant profiles; changing this started paper event is not valid.

## Local correction discovered

The activation page/client said a different director must approve, suggesting a
different issuer. Copy now says the approving director must be separate from the
player and the issuer may approve; self-approval remains forbidden. No server
guard, role, state, request or credential behavior changed. Source regression pins
0094/0127 and the text. Added rendered canApprove=false/true fixture: own request
has no phrase control and cannot approve; another request remains disabled until
the phrase. It performs no approval. React review found no hook/component,
accessibility, request-boundary or performance change beyond static copy.

Focused new test3/3 PASS; initial run failed only because its migration filename
was mistyped, then corrected to existing0094 approval migration. Expanded Chrome
suite21/21 PASS at390px/1440px, including witness fixture. Runtime evidence is
outside Git in director-browser-evidence-1792990079319. Independent source and final executed-evidence review PASS; aggregate results recorded below.

Local-only changed code: account-activations/page.tsx and
activation-workspace-client.tsx; tests/director-browser.mjs and
roster-account-activation-workspace-migration.test.mjs. Evidence/status docs also
updated. No push/deployment/merge/production promotion in this rehearsal.

## Limits

Paper coverage is **8/96 verified,88 pending**, not tournament completion.
No qualification, event closure, cross-check completion, settlement, payout,
ACC rotation acceptance, digital independent-session scoring, physical multi-device,
offline failure/recovery or real SMTP proof. Staging database-password rotation
remains a separate unresolved user action. PR122 remains draft at6d9fc54.

Final local aggregate:pnpm verify exit0;776/776 application tests, production
 audit0, lint0errors/2existingwarnings, providers PASS, Next16.4.2 build and
 TypeScript PASS, workspace7pass/1expected absent-private-handoff skip. New
 witness migration regression3/3 and expanded Chrome21/21 passed. Phone witness
 screenshot visually reviewed without clipping. Test now explicitly excludes an
 issuer comparison while retaining the player self-approval and canApprove checks.
 No runtime artifact or credential is tracked. Final diff-check exit0 with
 line-ending notices only. Independent final executed-evidence review PASS with no remaining findings.
# Digital sequential handoff checkpoint

This checkpoint and the original prerequisites above are historical. The completed bounded match evidence below supersedes their pending account/scoring status.

Both approved staging Auth users were verified confirmed with app profiles: player A `c7635a90-5041-426e-a404-25ef9cad729d`, player B `986c7f24-1d42-4115-8532-053fc4bef59a`. No passwords were inspected. Fresh hosted chooser and persisted creation verified the existing director and staging privileged path. Created `TEST ONLY - PR122 Sequential Digital 2026-10-26`, tournament `8ac4c809-6dfd-4695-8e4c-46c3618f7cc5`, with one zero-fee Standard Main event, 12 games, and two Digital roster entries. No enrollment yet: witnessed linking must precede it.

Issued one Player A activation, metadata ID `acaefb72-4f1a-46d2-b7ea-e3fee49f2aee`, expires 2026-10-26 08:01 UTC. Used the app Copy Link control without reading the bearer value; dismissed its one-time display before observation. The app confirmed no unsent entries or retry records, then its safe clear/sign-out completed. Player A password fallback is prepared in the same Preview tab. User must enter the password and sign in, then paste the copied activation link into the address bar (not chat). If expired or clipboard lost, inspect state and use supported cancellation/reissue; never reconstruct the secret.

Sequential distinct-account scoring remains pending, not passed. It can prove separate authenticated submissions and confirmations with server persistence, but simultaneous sessions, physical multi-device behavior, concurrency and offline synchronization remain untested. No new role grants, production actions or publication occurred. Local witness-copy correction remains unpublished.


## Completed bounded digital match - 2026-10-26 09:52 UTC

User explicitly approved two staging-only password accounts; user entered passwords and created/confirmed them without emails. Account A is c7635a90-5041-426e-a404-25ef9cad729d, B is 986c7f24-1d42-4115-8532-053fc4bef59a. Existing director performed witnessed approvals personally. Automated B approval was denied by approval review; it was not retried or bypassed. User submission was subsequently verified. A's first redeemed request expired before approval; supported reissue atomically expired its activation/rejected the old request. User approved A's fresh request before its original deadline. No guard or role was changed.

Fresh fixture tournament 8ac4c809-6dfd-4695-8e4c-46c3618f7cc5, event 4948dcfa-afab-43f0-b69c-5939e0a180f2. Standard Singles/Digital,12 games,0 entry fee,no pool or receipt/payment. Two linked Digital roster players were checked in, enrolled after linking, saved explicit0owed, desk-attended with event window closed, seated A-1/A-2, and given a synthetic12-match repeated two-player schedule. This is a bounded scoring fixture, not official ACC rotation proof. Schedule published once; actual database12games/2distinct participant profiles/1start; full refresh In Progress and no repeat start control.

Actual Game1: 0a73f294-76d3-47ec-bce5-79755c6f4346.
- A authenticated as A-1 against B A-2. Empty/zero-spread Review disabled. Entered A wins15; Edit/Review preserved values. Submitted once through normal online durable-queue path. Database1digital submission by A,0confirmations,state submitted. Full refresh locked input, waiting opponent. Authoritative scorecard0points/0wins/0spread.
- B authenticated as A-2 against A A-1, entered matching opponent win15 from B perspective. Database2submissions by distinct correct profiles,both winnera/margin15,0confirmations,state confirmation_pending. B's own confirmation persisted once. Full refresh no submit/confirm control; database1confirmation actorB=submission actorB. Scorecard still0totals/Pending Player Confirmation.
- A returned in a fresh explicit login; same accepted entry and Confirm My Entry available. Submitted A's own confirmation once. Database state verified,winnera,margin15,2submissions,2distinctsubmitters,2confirmations,2distinctconfirmers,all confirmation_actor_id=submission_actor_id. Full refresh Game Complete; no second-entry control. A scorecard Current and Verified,2points,1win,+15. Role-authorized player standings (no director bypass/login) A2/1/+15,B0/0/-15,1of12resolved,11pending. Exact database state counts1verified/11pending.

Each identity switch used Clear safe app data and sign out only after the app reported no unsent entries or retry records. One B signout failed safely, retained session, then succeeded on one retry after refresh verified unchanged session/empty queue. Observation timeouts during Clear-Site-Data navigation were resolved by observing settled state, not repeating mutations. Player A's authenticated session remains open on standings, empty queue. No new games were created after the12-match publication.

Limits: sequential distinct-account proof only. No simultaneous/physical multi-device, actual network-offline/reconnect, concurrent submissions, mismatch/judge resolution, full11remaininggames, final cross-check/settlement or SMTP proof. Earlier paper16 first round remains8verified/88pending. Staging DB-password rotation after prior exposure remains unresolved. No production, role/security/provider change, push, deployment, merge or code/release/production publication.

Local implementation status: existing witness director/player copy correction remains unpublished; its last actual checks776/776,Chrome21/21,audit0,lint0errors/2knownwarnings,build/TS/providers/workspace7+1skip remain the prior implementation evidence, not new checks run for this hosted rehearsal. Requested expiry UX is NOT implemented yet. Independent plan review recommends adding immutable expiresAt only to the existing service-only salt reader in an append-only local migration, passing it outward only on successful redemption; exact legacy/new response validators; truthful old-backend fallback. App-first rollout required. No new migration or expiry code exists yet; browser handoffs took priority.

## Final local expiry and mixed coverage supersedes earlier implementation status

Expiry UX and local-only metadata migration0237 are now implemented and independently reviewed; the earlier statement that no expiry code existed is historical. Fresh aggregate786/786,Chrome23/23 and actual PostgreSQL expiry/mixed rollback fixtures passed. Original expiry guards and privileges remain unchanged. No hosted migration or code publication. See [complete local evidence and changed-file inventory](2026-10-26-expiry-and-mixed-local.md) for rollout order, exact tests, resolved failures and hosted mixed permissions gap.
