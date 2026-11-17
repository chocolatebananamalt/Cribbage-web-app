# V34 ordinary scoring recovery conflicts — local only

## Observable acceptance and reproduced defect
From exact frozen V33 8b33b2c728a3227dc6af7a1a7bdbd3dc44d529fa, ordinary LiveScoreEntry hydration retired a retained submission for ANY existing own-submission ID. Existing supabase-auth-semantics test explicitly asserted different-ID cleanup. New executable helper regressions failed on base (reproduction.log,2fail). No claim this caused Daron's historical waiting-screen report.

## Implemented behavior
Only readback matching retained submission ID,winnerSide,margin can retire it. A different ID or result holds the exact envelope and draft; explicit review message says do not clear browser data. Null readback retains exact retry. Unknown initial retained bytes/storage failure is held without trust or erasure. Cleanup validates full stored envelope and immediately rechecks exact raw bytes; replacement/foreign/malformed/denied data stays intact. Every cleanup caller handles failure rather than continuing after local deletion fails.

Derived current conflict guards handle same-mounted null-to-foreign-entry refresh even when local submissionId remainsnull. Sticky recovery hold blocks submit,retry,confirm,offline sync,handoff,poll and saved-state overwrite. Before hydration, confirmation disabled and handoff unmounted. No new scoring/verification rules,writer,SQL,permission,featureflag or automatic retry/merge/discard. Exact readback retirement remains local acknowledgement, not game verification.

## Verification
54focused tests pass (helper,existing auth/recovery audit and score confirmation guards). 18actual Chrome390/1440 fixture cases pass: distinctID,sameIDchangedwinner/margin,exact,null,initialguard,validdraftpreservation,reload,sameIDpayloadcorrection,null-to-conflictzeroPOST,accepted200/rejected403 with storage replacement exactly1explicitPOST thenhold,unknownmalformedinitialwork. Foreign bytes preserved. Actual React LiveScoreEntry/retryhelper with SYNTHETIC Auth/API/router/offline/handoff ports, no realNextRSC/nativeDB/GoTrue/PostgREST or actualdevices/user session. Existing ordinary two-session bothorders also pass, fixtureverifiedscorecard,10secondcatchup,no duplicates.

Final full verification status is in CHECKS.json; no unavailable stage is implied passed. Initial overbroad eslint-dot attempt included generated/vendor/script paths; retained as lint-overbroad-attempt.log. Correct package lint scope is eslint src tests next.config.ts eslint.config.mjs. Framework advisory build stop retained; no dependency changes. pnpm/dependency audit unavailable; privatehandoff absent. Independent high-risk review scopedPASS after fixing two findings (same-mounted retry escape and ignored cleanup failure).

## Boundaries and remaining acceptance
No production/practice/draft/session/hosteddata,Auth,SQL,grant,flag,publication or email action. All existing unverified gates remainoff. Not deployed. Genuine authenticated app/provider recovery acceptance still required before a hosted usability claim. Manual conflict-resolution workflow is director review; no new server correction authority or automatic archive/discard is supplied. No conflation with same-name people: actor/tournament/game/side/operation identity remain explicit; this is not a household registration acceptance claim.
