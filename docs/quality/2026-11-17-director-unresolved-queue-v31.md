# V31: director unresolved-game queue

Base V30 695b2fa5c05bd3a5e734e2fe20810d88a72f7c7e / tree dd2dded4eec30a9ca51dc855ac00cb32a2797aaf preserved. Separate isolated workspace unresolved-games-v31-20261117.

## Authority and scope
Ordinary schedule RPC exposes raw game state, which is insufficient: recovery and forfeit may leave a pending state after authoritative resolution (0230 comments and0169 function). New LOCAL SQL proposal uses exact app.game_is_authoritatively_resolved_v1 for a read-only queue. It joins ordinary director_csv/director_entry publication, active Standard Singles digital-scoring event, round and both immutable participant bindings, directory names/fixedIDs and saved game chairs. It does not infer individual scorecard mode from an account. No winner/margin/submission or player/profile IDs are returned.

The scope excludes native rehearsals, manual/team/retired events and other source families. This is NOT the complete11-condition cross-check count or a tournament completion decision. Future/not-started games can appear without any lateness/failure inference. Raw verified/corrected state can remain in the queue when required authoritative scorelines are incomplete.

## Functional slice
New dynamic /unresolved-games page, strict DTO, current verified actor/user/issuer/SID/expiry and TD/Co read boundary, read-only view, cursor pagination100rows and source-time display. Links route officials into existing event disputes, paper/digital, paper/paper or device-recovery workflows; no assigned-player game entry or new review authority. Missing/malformed/foreign/stale replies never mean zero. Per-page SQL total/rows share a statement snapshot, while separate pages may change; explicit first-page refresh is provided. DTO rejects impossible first-page total/hasMore, nonadvancing/duplicate rows and normalized internalUUID/TemporaryID display text.

App gate directorUnresolvedGamesEnabledV31 returns false before Auth/client creation. Independent SQL gate also returns false; function execute revoked from PUBLIC, anon, authenticated and service_role with NO GRANT. Existing final-check navigation adds a link only when the new gate is true. No other gate/permission/SQL installation/writer changed.

## Executed proof and limits
Native PostgreSQL17.12:9groups pass for closed gate/ACL, exact0169 predicate exclusions, incomplete verified retention,100+12 pagination/no duplicate IDs, foreign actor/tournament/Co read, ordinary/native/manual/team/retired scope and rollback/committed evidence readback. Minimal synthetic dependency schema is NOT the mature schema/RLS catalog. Recovery approval helper reads a fixture Boolean; the real recovery approval writer/audit is NOT verified. Native acceptance is separate from Auth/PostgREST.

35focused/audit groups (7newqueue groups plus current signature/navigation audits),3836fullapp tests,14Chrome groups390/1440. Actual page-sourceVM, reader and view render captured native first-page row data; sample timestamp is set by fixture and its clock is pinned. Auth/SDK ports and page2 continuation are synthetic; no live database call during browser or real Next production request. Browser has only GET and get_* calls, no inputs/forms/other-player score entry, no overflow, denial suppresses identities. Captured data is fictional. No user browser, storage/session, draft or practice records accessed.

Initial native run could not connect/probe under sandbox (EACCES); owned server stopped. Separate original normal escalation verified pid absent, port refused and data removed before a fresh successful fixture. Successful run also stopped owned PID, verified port closure and removed owned data. No Docker/install/security bypass.

Independent review found privacy and pagination gaps; both fixed and tested. Final bounded source PASS, not activation clearance. Aggregate REPORT/CHECKS/MANIFEST record final lint/type/provider/build/workspace, patches and identities. pnpm/dependency audit unavailable, private handoff absent; existing Next16.4.2 advisory retained, no upgrade.

## Remaining gate
Reconcile new read-only proposal against the exact mature schema and authoritative helper fingerprints; review the smallest service-only grant with verified-session server path and all current role denials. Do not open generic dispatcher or player impersonation. Genuine Auth/PostgREST and actual Next runtime/session-revocation/pagination review still required. Native rehearsal queue needs its own origin-retaining adapter; no fallback is present. Production/practice/checkpoints preserved; no hosted SQL/grants/flags/deploy, denied retry or sign-in email.
