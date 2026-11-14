**Dependency update:** See [51-source atomic closure](2026-11-07-native-mixed-sql-closure51.md). It supersedes this historical57-source prerequisite package; the same23-file UI overlay remains valid. Use the new closed-install artifact, never sequential raw proposals.

# Preparation-Only Package — Local Isolation

This replaces the earlier 49-file UI proposal in `2026-11-07-native-mixed-staging-test-plan.md`. No staging installation, access grant, cohort creation, deployment or real-money action is authorized or performed.

## Acceptance and deliberate exclusions

Deliver only Director preparation, each Digital subject's own consent, and a separate paper review through the existing bootstrap provider/controller/API. Build exactly that overlay over published commit `ba2845a92a484ec66e360817709c5c6ed43aa296`. Enable only bootstrap in the isolated build; preserve default-off workspace behavior. No draw, Start, scoring or Finance screen/route is added. Verify the same preparation with the five current accounting functions untouched, plus populated-history preservation.

The Director now uses `/tournament/<tid>/rehearsal-participation/<eid>/director`; players use `/consent` and the independent checker uses `/paper-review`. All three modes reuse one existing page/provider. The full preparation/draw/Start page is excluded, not merely hidden with backend flags. The existing source gate remains false; only the isolated candidate changes `bootstrapWorkflowEnabled` to true. Fixed staging project, current subject/session, exact event cohort and roles still gate each RPC.

## Isolated source/build result

`test-results/native-mixed-bootstrap-only-inventory-20261107.json` contains **23 changed source files**, 153,627 bytes, with zero unresolved relative imports. The standalone build was created from a read-only Git archive of ba2845a plus exactly those 23 files. The only isolated enablement changes the bootstrap gate from false to true, with before/after hashes in `test-results/native-bootstrap-isolated-20261107/overlay-manifest.json`.

Next production build succeeded, including TypeScript. A post-build source comparison confirms no other tracked baseline file changed. Build output adds exactly four routes: one participation page and three bootstrap source/write/recovery routes. No draw, Start, scoring or Finance route is added. The built source is preserved at `../native-bootstrap-isolated-build-20261107`, outside the main app's broad TypeScript scan; the move did not change its bytes.

Real React SSR verifies all three page modes show unknown access without exposing preparation controls before provider acceptance, rejects an invalid mode/event, and confirms the default-off page rejects before awaiting route parameters. See `verification.json` and `verification.log` in the isolated evidence folder. This is not browser, hydration, IndexedDB, signed-provider or HTTP-network acceptance. The existing browser/audit denial was not retried.

## Accounting replacement investigation

The first reduction experiment removed eight `CREATE OR REPLACE FUNCTION` statements in four proposal files, representing these five published functions:

- `app.calculate_q_obligations_v2`
- `app.prize_accounting_source_v9`
- `app.q_obligation_sources_v2`
- `app.side_pool_graduated_source_v2`
- `public.get_q_operating_workspace_v2`

It retained existing private guard helpers and did not substitute an empty result or weaken a source guard. The first packaging script accidentally normalized line endings, breaking an exact closure-definition anchor before preparation. The guard correctly rejected installation. Failed fixture `b228fe82149e76f39efd9842b070aa4ffbd014a48d7dd24cb1e0dab057aae92e` was removed with verified cleanup; it proves no accounting preservation or workflow success.

The corrected package preserves untouched bytes: **47 of 51 derived files are byte-identical** to their source; only four files differ, solely for the eight named removals and explanatory comments. Six unchanged confinement/lease/preparation/reservation/status/bootstrap proposal files complete the currently tested 57-source dependency set. Original proposal files are not edited. Exact removed statement hashes and source/derived hashes are in `test-results/native-mixed-bootstrap-min3-20261107/derived-schema-manifest.json`.

This is a narrow object-level exclusion, not proof the whole remaining 119-table dependency footprint is minimal. Finance-related tables/guards remain private dependencies; no Finance UI or finalization permission is enabled. The native test-event binding/preparation remains a prerequisite, not a capability silently added to this package.

## Runtime result

Final fixture **04d309a99a2f8a33d678474b3927c55902cf102d45b3150a3d8e135831b78b58** passed the current byte-preserving package. All **30 actual API-factory/SQL preparation operations** and exact operation readbacks passed. Six own-account consent surfaces constructed zero privileged clients; the preparer could not self-review; a different checker approved the declaration; revoking consent changed readiness to waiting and the probe rolled back.

All **five existing accounting functions** were compared before/after for exact definition, signature, owner and ACL equality. All matched. All 45 prior fictional rows were retained with unchanged values, using existing-row-multiset containment across 254 monitored tables; new rehearsal rows may also exist. Draw/publication, Start, game writer/transport and operational activation flags stayed false. A separate read-only probe found nine installed Finance/award flags false and the broader Finance provider flag absent. These functions were not enabled to make the test pass. The fixture was removed with verified cleanup; independent metadata verification covers all **26 tracked containers**, including failed attempts.

Min2 reached the end of the 30 operations, but its final compatibility assertion failed because the harness did not import `state`. It was removed: **8e9d0a856ec1a4e6766db6e4471e5f911ad44c55af8a794ef966f9d726fb54ee**. This is not substituted for the successful min3 comparison. The missing import was corrected, an explicit five-function baseline count assertion added, and the new harness passed `no-undef` lint before min3 ran. No SQL guard was relaxed.

Evidence: `test-results/native-mixed-bootstrap-min3-20261107/`, frozen source/derived hashes and `workflow-results.json`; isolated build/SSR integrity evidence in `test-results/native-bootstrap-isolated-20261107/`. Application tests **2361**, focused checks **72**, TypeScript and **14** workspace/handoff checks pass. The isolated production build passed. Browser, real HTTP, signed JWT, IndexedDB and human-session behavior remain unverified; the local SDK used fictional claims and injected handler transports. No new scoring, full108-game or payout test is claimed here.

## Release boundary

Even after local acceptance, this is a candidate for a restricted staging test, not an authorized release or complete human rehearsal. The current staging target/preview facts and fresh recovery strategy in the earlier plan still apply. Require a fresh private staging export, isolated restore, current drift/preservation baseline, official migration packaging, final catalog/grant review, exact named test event/actors/roles/expiry and separate approval. No new or persistent credentials, automatic invitations, enrollment of the saved walkthrough draft, actual attendance/payment claims or real prizes.

Initial RPC exposure remains only the five exact bootstrap grants in the earlier plan; never grant private/raw functions, application tables, anon or PUBLIC. Draw, Start, scoring, operational activation and Finance closure remain disabled. The candidate does not create its own base event/roster/cohort. Provider access and privacy need real signed-session acceptance before a human test can proceed.

Do not later enable Custom-pool or Finance functionality against this trimmed schema by changing a flag. Its accounting-function exclusions are deliberate. Those features need their separately reviewed accounting integration, compatibility tests and release authorization.
