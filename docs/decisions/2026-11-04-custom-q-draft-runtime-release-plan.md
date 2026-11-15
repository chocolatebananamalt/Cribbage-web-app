# Custom Q draft transaction: proposed runtime test and release gates

## Current concrete candidate (NOT executed)

`database/proposals/custom-payout-q-setup-save-v2.sql` implements a private owner-only Q draft save/read/reconciliation candidate. Full original envelope is reserved before core delegation; accepted core and intent journal commit in one enclosing transaction. Rejections reserve the global operation identity. Busy/isolation replies are nonterminal and do not authorize cleanup. Actual persisted Qevent/slot/advertisedratio is checked before journal binding. Database-derived base hashes include current setup and latest custom journal; base-read timezone is fixedUTC.

A revision-insert backstop prevents an older writer from dropping current custom intents. Explicit empty-full-protocol clearing, with no remaining custom advertisements, commits an empty journal and permits ordinary noncustom saves afterward. Until all integrations exist, other legacy revision writers (including amendments/replacements/contact-copy paths) may be blocked on a custom-bearing latest revision. This is a release limitation, not an acceptable hidden production surprise.

Capability remainsfalse. No public wrapper orEXECUTEgrant; anon/authenticated/service_role must remain unable tocall these owner-only functions. Side/Satellitecustoms explicitlyunsupported here. This is NOTactivation, operating policy, final accounting, real payment or a full CustomNrelease.

## Exact proposed disposable local test scope (authorization pending)

One new disposable LinuxPostgreSQL container using already-pinned image sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706, networknone, noports, nomounts, noprivilege, nohostcredentials. Fixed label/name `cribbage-custom-q-draft-local`; exact64hexcontainerID must be supplied and verified before use. Runner creates no container and refuses an existing `fixture_custom_q_draft_v2` database. Socket/database/image/baselinehash guards precede fixture work.

Restore pinned synthetic empty-post0236baseline, apply0237–0292 locally, then amountV3/journal/Qdraft proposals. Use only fictional auth profiles/roles/tournament records in that one local database. OwnerAuthenticated means local SETROLEpostgres with a synthetic authenticated subject to test PRIVATE logic, not actual public API access, independent people or a hosted Supabase/provider session.

Checks: validQ7fullsave/readback/journal; complete echo/receipt/hash; exactreplay/readreconcile; actor/role/source/CAS/case/coverage rejection; historicalrowsunchanged; changedrequestsusingoneop; reuseafterrejectionthrougholdendpoint; oldwriterintent-lossguard; explicitclear and oldsaveafterclear; Unicodewhitespace parity; injectedfailureaftercore withallrowsrollback and same-requestretry; unsupportedisolation; SQLfunction/tableownership/searchpath/RLS/ACLs. Two-connection barriers must verify actorop/tournament/role contention nonterminalretry, nocommittedpartialreservation/receipt, exact retryafterrelease, and no deadlock with opposite-order legacywriter.

No statement above is a runtime result. Prepared runner/acceptance source is separate from actual execution; concurrency wiring must be complete/reviewed before claiming the suite is ready. Cleanup only the identity-verified testdatabase/container and verify absence. No staging/productionconnection, invitation, realfunds or deployment.

## Further release work

After localDBproof, finish Sidecustom persistence, amendment/copy-forward, activation materialization, method disclosures, source/currentness hashes, immutable awardreviews and accounting. Satellite calculation waits for eventmethodsemantics. Expose only reviewed role-bound minimal APIs; bind futureauthenticated transport and readback to full committed intentjournal. Keep legacy receipt identities and histories untouched. Complete exact public/API/signed-in acceptance separately from owner-only SQL tests.

Only then prepare a concrete staged release manifest. Verify current staging target, fresh usable recovery throughisolatedrestore, compatibility and fixture fingerprints before any separatelyapproved migration. No current backup freshness or hosted readiness is claimed here.

## Rollback / preservation

Current work is unpublished; preserve scoped archives and revert only reviewed local files if requested, never unrelated work. Future approllback alone would NOTundo DBchanges or make an old client safe for newintentdata. Keep journals/receipts/history and the loss-prevention guard; do not drop data or weaken guards to make oldclients save. Disable new capability and restore compatible app, or use a separatelyreviewed recovery procedure from a verified backup. Any deliberate customclear uses a new audited version, not deletion/history rewrite.

### Prepared suite update (still NOT RUN)
The runner now wires all three LOCK_HELD two-connection barriers, with exact owned-process cleanup. It also retries the identical operation after injected post-core failure, verifies no duplicate committed rows, pins the original batch for history comparison, and covers explicit zero-intent clearing/legacy-save re-entry. Syntax/lint checks are not database acceptance. No container, database, SQL or fixture was executed.
