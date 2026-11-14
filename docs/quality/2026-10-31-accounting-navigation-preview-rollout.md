# Accounting navigation Preview publication — 2026-10-31

Approved six-file repair published as `1c3cd8ceb150cdc16138267220707c8ddb7e4472`, parent `223ec1583f18979fc666cd6a26f03e9428705342`, on existing `codex/director-setup-journey` / draftPR122. Remote branch SHA matches. Non-force push only; no merge, production change or migration.

Exact-commit CI: push41163508732 success, pull-request41163512973 success. VercelPreview deployment `dpl_CFuF2QWcsfkYtm1EPXzB3JB9in96` READY, targetnull,aliasErrornull, exactSHA/branch matched. ImmutableURL https://cribbage-web-cdn7t5i4y-cribbage-app.vercel.app ; stablealias https://cribbage-web-app-git-codex-director-setup-journey-cribbage-app.vercel.app .

Read-only hosted acceptance in the preserved director Chrome test tab:
- Q+Side tournament e257eb44-c32e-4268-a45a-ae306c31ac4a/event88d3a077-2403-47f5-aa9a-cae50c4c196a generic `/settlement` redirects to `/prize-accounting-v9`.
- No-Q tournament45a01b4f-6c5e-4ed7-b8ad-824f1aeb947a/event036cff4d-d497-4c1d-a987-90fc51039ac7 generic `/settlement` redirects to `/prize-accounting-v8`.
- Both visibly retain finalized unpaid accounting, current sources/funding, restrictedhold$0.50, and zero unsent/retry records. No financial controls were submitted.

Extension debugger attachment failed before navigation. Supported native control of only the designated ACC window completed the read-only checks; no personal page was opened, no session reset/securitychange/password access. Director session preserved and tab marked for continued authorized work.

Staging SELECT-only preservation: finalIDs remain NoQ2fef282e-178a-420f-acb3-9bdf976510dc and combinedde2b093b-2657-44b2-baf1-f4c230be4ded; unchanged sourceDigests18cda69d391c51b526737c1deed888fceaa92bc95033dddb0a98c4f827adebef and4fc88fa250d7f2b9e4ff7a590e523845530b43d6ea4de137ef22266aa0fd9199;draft/finalversion1,fundingversion0,restrictedminor50. Each has exactlyone draft andone final. Both persisted complete regular-award arrays compare exactly to the saved hosted-acceptance baseline:95/70/45/45/25,total280. Broader223oldertablepreservation remains prior acceptance evidence, not newly recomputed here. No hosted write was performed during publication verification.

Local release checks before commit:1145tests,build/types,lint0errors50existingwarnings,providerchecks,14workspace/handoff,14phone/desktopnavigationchecks,freshaudit no known vulnerabilities,independentreview no blockingfinding. No new schema/RPC/permission/writer/payoutpolicy.

Remaining production gates are unchanged: physical multi-user/paper/camera/offline and old-device rehearsal; hosted Database/Auth/Storage disaster recovery; supported-format and unresolved monetaryties/multiway scope; monitoring/rollback/exact-release operational preflight; explicit production rollout approval. Synthetic unpaid acceptance and this Preview navigation test do not certify those gates or real disbursements.
