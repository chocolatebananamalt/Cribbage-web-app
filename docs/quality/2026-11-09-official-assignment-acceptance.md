# Officials assignment and acceptance: local verification

## Existing authority remains unchanged

The primary Director nominates a Co-Director, Cross-Checker or Judge through Setup. Existing SQL requires saved tournament timing, the exact invited signed-in email, an unexpired pending nomination and explicit acceptance of **each nominated role**. A delivery/link is not acceptance. The setup nomination path currently permits 12 filled/pending positions per role; that is an existing software limit, not a newly asserted ACC rule. Historic records are preserved. Primary Director authority is not a newly nominated role requiring this acceptance flow.

Canonical success is `official_accepted` with a valid tournament UUID and the exact nomination UUID. The opaque legacy co-director endpoint instead returns `co_director_accepted` with tournament/invitation UUIDs. These shapes were checked against migrations0191/0211; no SQL changed or ran. Expiry, email, per-role grants, removal and audit remain database-owned. ACC number formatting in the existing nomination form is unchanged; this flow does not verify active membership or establish MRP eligibility.

## Gaps closed locally

- The invitation client previously declared approval for any HTTP-success object containing a string tournament ID. The actual old client reproduced that behavior under fictional fetch. Service adapters and the client now require exact canonical receipt shapes and modern nomination matching.
- A modern successful POST must also read the existing accepted context for the exact nomination and expected role before showing confirmation. Pending, unavailable, malformed or wrong-role readback stays uncertain; only an explicit status check can reconcile it. No automatic second POST occurs.
- Independent review found that clearing displayed context on a failed check could erase the expected-role comparison. The role is now pinned separately for the lifetime of the invite/subject scope, including across repeated failed checks. Unknown initial context can establish its pin only from the first valid owned nomination read. A scope remount resets it.
- Component scope/subject keys, current-intent guards, unmount abort and late-response suppression prevent an old invitation callback from acting on or confirming a newly displayed nomination. Signed-out context is hidden. An uncertain read after prior confirmation no longer displays Accepted. This handles observed prop/scope changes, not an unseen live provider auth change; actual account-switch acceptance remains a provider gate.
- Opaque legacy receipts lack the modern pinned nomination/role readback. They remain explicitly unconfirmed here and direct the user to Your Tournaments; no loose secret-to-UUID comparison or new fallback authority was added. Server acceptance behavior is preserved.
- Setup summaries bind each response to its requested role and captured tournament, check HTTP success, time out/abort unmounted reads and discard old-tournament responses. Individual failures show Assignments Unavailable, never zero or a permanent Loading state after failure. A local retry epoch refetches the existing GETs without refreshing Setup, preserving its unsaved form work; old responses cannot populate a later retry. Pending entries say Awaiting Acceptance, not Not Registered. The helper distinguishes assignment from mixed rehearsal access and identity binding.
- Missing saved timing now directs the Director to Start Date and Number of Days rather than a removed End Date input.

## Mixed-trial permission and coverage handoff

| Step | Existing requirement | What acceptance does not establish |
|---|---|---|
| Nominate/manage | Primary Director; saved timing; existing form and server checks | No account creation or automatic acceptance |
| Accept a nominated role | Exact invited account; each role separately; current server checks | No mixed cohort enrollment or permanent permission guarantee |
| Identify an official | Correct participant/nonparticipant identity bound through existing authorized flow | An email/ACC number or assigned label alone is not an identity binding |
| Capture mixed paper evidence | Eligible bound Cross-Checker, current source/consent/access, nonself | Judge-only or reviewer status does not replace capture permission |
| Independently review paper evidence | Different eligible bound Director/Co-Director/Cross-Checker; neither actor plays that game | Capture and review cannot be performed by the same person or shared account |
| Play a Digital game | Own player identity and consent, normal progression/confirmation rules | Holding an official role does not bypass own-player restrictions |
| Start/draw/Finance | Their separately reviewed role/source/cohort/feature gates | A nomination acceptance does not enable those closed features |

Two eligible officials suffice for a particular paper-containing game only when both are nonself for that game. If only two officials are assigned and one is the Digital player in a mixed game, those two cannot supply both capture and independent review. Arrange another eligible person among the six or other agreed helpers; this does not imply eight attendees are universally required. Bind playing officials to their actual participant identity, not falsely as nonparticipants. The eventual random schedule and actual named roles need a game-by-game coverage check. No names, invitations or access changes are needed merely to review this local patch.

## Evidence and limits

27 focused unit/source-contract groups passed, including canonical receipt adapters, role-bound workspace reads, existing copy-link no-email behavior, two-role acceptance SQL contracts and mixed nonself contracts. These source-contract tests do not execute SQL. The actual React browser test uses fictional fetch only and preserved pre-fix source to reproduce false approval. It passed modern accepted readback, uncertain reconciliation without repeated POST, wrong nomination/role, repeated wrong-role checks after context clearing, stale callback/late response, signed-out state, honest legacy hold, role-read failure/wrong-role/stale-tournament summaries and local retry without POST at390/1440. Summary layout passed100/200% text. Zero network requests, messages or role grants. Final TypeScript/scoped lint passed; outcomes are retained alongside the final source manifest.

Evidence directory: `test-results/officials-assignment-acceptance-20261109/`. Original before-source snapshots and failed/earlier verification logs are retained. Independent review verified the role-pin correction and found no remaining P1/P2. No fresh database, full108-game simulation, hosted read/write, external message, provider activation, permission change or blocked-publication retry occurred.

Actual signed-in provider behavior, invited-account email matching/expiry/removal, six-human playing-official coverage and cohort acceptance remain real-device gates. The existing Director laptop/phone sign-in was already checked and need not be repeated as a substitute. The next appropriate user action is the bounded officials acceptance exercise on an authorized preview after the paused publication is resolved; this document does not authorize sending invitations or enabling the group.
