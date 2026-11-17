# Acceptance scope — nonmember identity V3, local only

Base ef2b93dd51d4b672cdff40a54f3ff9346f957190/tree3f04f5101265ad4d93767c9d500e53045a2c7a71. No cloud13033415 import claimed. Prior identity V1/V2 checkpoints and live release preserved.

Observable criteria: missing external number is valid for explicit nonmember; supplied issued ZZ+4digits remains nonmember; stable hidden IDs distinguish people; tournament-only Temporary ID is never client generated, reused or exported; duplicate name/fulladdress pauses before save; duplicate opens existing, distinct requires visible differentiation; missing address remains incomplete; exact retry stable; legal report names/prize/results preserved, no internal/temp/local/private leakage; same-day joining pending separate; no official award/ACC acceptance or automatic submission.

Implemented source: nonmember-identity-v1, guarded unexposed handler, local-player-identity-v2, identity-pre-save-v3, distinct-identity-display-v3, associated controlled React components, actual manual-event-identity-pdf-v3. Components remain UNMOUNTED for truthful persistence boundaries. User-facing CSV is not proposed; old helper retained only as internal projection regression evidence.

Focused final:34groups PASS. Actual React browser390x1000 and1440x1000 PASS: pre-save duplicate→open without save, distinct requires visible label, foreign session and missing address disable save, Father/Son check-in and scorecard distinguishable, Temporary IDs1/2 visible, internal IDs absent. All responses/state/callbacks synthetic; zero external requests, no Auth/PostgREST. Fixture document fulfilled locally at an invalid test origin solely for secure-context WebCrypto; no listener or hosted request.

SQLite disk transaction/reopen acceptance PASS: separate identities, legal names unchanged, stale competing operation creates nothing, exact retry returns original committed IDs/ordinal, changed payload conflicts, per-tournamentcounter independent. This is SQLite+singleinstance serialization evidence ONLY, not independent PostgreSQL race or genuine Supabase provider/Auth acceptance. Disposable unique tempdatabase closed and removed by test finally; no user data.

Independent high-risk Sol review bounded PASS after fixing fullsnapshot/operation decision leases, foreigncandidate hiding, retainedcallbacks afterownerchange/unmount, casevariantPDFduplicate keys and immutable async hashinputs. Reviewer reviewed final fixes/regressions, did not rerun suites. Hook tests await actual gate promises (earlier aggregate exposed a test scheduling assumption, corrected without weaker assertions).

Real integration blockers: authoritative versioned database writer/read/receipt/ZZattachment; append-only/address constraints and locked pre-save+counter transaction; actual independent-connection PostgreSQL races and real Auth denial/readback; profile-before-eventreader; current existing-registrationdetailroute/hostsave/reconcilelifecycle. Exact instructions proposals/identity-pre-save-v3/BACKEND-HANDOFF.md. UnappliedSQL endsROLLBACK, no grants. No production/Preview/session/draft/SQL/flags touched.

Full verification outcomes are in the adjacent final logs/report. This prototype is NOT ready to mount or publish as a persisted registration feature. pnpm verify cannot be called fully green when workspace/noGit or externaldependency checks fail.
