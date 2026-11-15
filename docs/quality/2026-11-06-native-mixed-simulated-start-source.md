# Native mixed simulated Start — private source candidate, runtime pending

## Scoped implementation

Parent authorized local implementation/verification, explicitly no new database fixture, SQL execution, hosted changes, grants, publication or real money. None occurred. The three prior fixture states remain cleaned/cleanupVerified. No app route imports the new handler; no Director UI/storage controller is enabled.

A separate immutable native_mixed_simulation_starts_v1 table represents a SIMULATED Start, linked to an explicitly named generic operation receipt and audit entry. The writer derives and pins the complete current native schedule publication/context, sidecars,18 fixed Tournament IDs/12 rounds/108 pending games, sealed consent/readiness and simulated funding. It never creates ordinary event_play_starts, check-in/status, payment, score or confirmation rows. NormalStartAuthorized,scoringAuthorized,humanPresenceVerified,paymentVerified,moneyMoved,payoutAuthorized andfinalizationAuthorized remain false; simulationStarted describes only this new journal.

Reuses existing global actor/operation receipt namespace and advisory lock rather than a second journal. Director/profile rows are held FOR SHARE; same event-pipeline/source locks and event uniqueness serialize fresh writes. Exact owned replay is resolved before fresh consent/source checks. Receipt, Start row and audit insert atomically, followed by a provenance postcondition; receipts are built once and never updated. All new objects are private, force-RLS/immutable/revoked and default-off.

Historical recovery has an independent default-off flag, requires the current Director and exact owned actor/event/request, and always returns historicalReceipt=true/currentSourceVerified=false. It does not reinterpret later revocation as an uncommitted Start. Current-source read separately recomputes the exact current publication/readiness capture and fails closed after changes.

Typed codecs reject extra fields, scope/request/count mismatches, altered authority flags and numeric digests. The existing authenticated Director provider and handler boundaries now have optional Start, operation-recovery and current-source methods with separate opt-in capabilities/flags. Older leases do not gain Start. Request/response snapshots bracket awaited auth checks; expiry, role/identity/target and disablement are rechecked. A lost or malformed write result stays unknown; recovery never resubmits and null history does not prove no commit. Handler POSTs are same-origin,16KB bounded and bound to the exact operation URL. Post-dispatch403/404/disablement also do not prove the writer aborted; any future controller must retain pending work and recover before clearing/retrying.

SQL SHA256: 2308778e57bde34f6532832e878c7ccff85640e49c0caafbafeac78b7e3f345b. Independent source review GO; a P2 was fixed by requiring JSON strings for both expected digest fields. No P1 found in source.

## Executed source checks

20 focused contract/provider/handler tests pass; full application2214/2214 pass; production build pass; provider-readiness pass; workspace/handoff14/14 pass. Full lint0 errors/137 existing workspace warnings; focused changed-file lint0 errors/0 warnings. Safe verify components ran separately; previously denied dependency audit was not retried. No denied browser navigation/access was attempted. Unit providers/handlers use injected doubles, not real SQL/provider sessions. Prepared six-case SQL request regression is UNEXECUTED.

Evidence test-results/native-mixed-start-source-20261106: source manifest, verification summary, logs and frozen pre-change provider/handler bytes. No historical data or payout policy was changed.

## Exact next runtime test — requires one fresh fixture approval

1. Verify one network-none disposable local target and empty baseline, no ports/mounts/passwords; install final prior112 source set (the previous111 with both schedule fixes plus this one proposal), recording hashes. Verify private/RLS/ACL/default-off behavior before temporary fixture-only grants/flags. No hosted access.
2. Run tests/native-mixed-start-request-local-regression.sql: valid request plus extra authority, missing statement, numeric schedule digest, numeric attendance digest and blank-reason rejection.
3. Use fictional18-person native Standard12 Main:6 linked Digital/12 unlinked Paper, own-account simulated consent, independent paper review, simulated funding and verified local schedule publication. Before first Start, test wrong actor/role/event/context/digest/source and extra authority fields; verify no row/receipt/audit effect. No fabricated ordinary attendance.
4. Enable only fixture-local Start path and issue a valid request. Require one immutable simulated Start, one exact generic simulated receipt/audit, derived source pins and18/12/108; all real/scoring/payout authority false. Ordinary Start, check-in/payment/score/confirmation tables stay unchanged, ordinary progression stays not_started.
5. Two SQL sessions: same exact operation, distinct operations for same event, and cross-domain actor/operation reuse in both directions. Require a single accepted Start; losers return exact historical/busy/conflict/already-started, never a duplicate. Verify ordinary namespace/history remains protected.
6. Controlled fixture-only failure during audit insert must roll back the entire new Start/receipt and preserve prior schedule. Verify outcome before exact retry; never redraw. Simulate lost acknowledgment after a successful commit; read the exact owned operation without another write and compare IDs/request/source/flags.
7. After accepted Start, revoke one Digital consent through its own authenticated identity. Current-source read must block; historical recovery must remain readable to the current owning Director even with writer disabled. Foreign actor/event or removed Director must not read it. Keep unknown/missing history unknown.
8. Remove the exact fixture, all test-only roles/grants and test triggers; verify ID/name absence and preserve evidence. No real money or app publication.

## Remaining gates / policy

No new owner policy decision is needed for the simulated Start snapshot. Actual SQL syntax, installation/constraints, concurrency, rollback, role/ACL and positive persistence have NOT run. Real provider/browser acceptance, pending-storage/UI wiring and enablement remain separate.

This is NOT the scoring bridge. Current native readiness deliberately requires prescoring emptiness; after future scoring begins it may no longer be source_available. Future simulated scoring needs a separately reviewed post-Start currentness/provenance contract that pins the immutable Start/publication roots, permits only its own proven game history and enforces revocation/identity/nonself review. Do not weaken existing lifecycle, ordinary Start/progression, admission seals, independent digital confirmations or paper safeguards. No complete18-player trial, playoff or financial closure is claimed.
