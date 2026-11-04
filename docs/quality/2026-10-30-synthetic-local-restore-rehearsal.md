# Synthetic local backup-and-restore rehearsal — 2026-10-30

This exercises generated local SQL fixtures only. It is NOT hosted disaster-recovery verification and does not back up production/staging Database, real Auth identities/sessions or Storage objects.

## Reproducible procedure
Run `node tests/run-synthetic-restore-container.mjs` using the existing official Docker installation and reviewed image digest `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`. The orchestrator refuses existing same-name resources. It creates only the exact labeled `cribbage-qaccounting-local` container with networking disabled, no ports/mounts, all capabilities dropped, no-new-privileges and the postgres OS user.

The inner runner validates the previously approved empty local baseline SHA256, applies migrations 0237–0263 locally, and generates Q and no-Q 17-player fixture lifecycles with synthetic identities, scores, qualifications, playoffs and unpaid accounting. The current test-only app release remains unchanged. It makes a custom-format pg_dump in memory, restores it into the newly created `fixture_restore` database, compares source/restored fingerprints, and verifies the original synthetic database stayed unchanged. The dump is not uploaded or added to the source archive.

## Comparison and limits
- Exact ordinary `app`/`auth` table row counts and sorted JSON row hashes, including profiles/roles, score evidence, operation receipts and immutable accounting history.
- Selected relation ownership, effective ACL and forced-RLS flags; app/public function bodies, owners, security/search-path/ACL metadata; constraint definitions.
- Seven observed text CHECK definitions differ only in redundant parenthesis serialization after PostgreSQL restore. Normalization is restricted to those names and rejects OR; source/restored null/empty/space/normal/500/501/control-character outcome vectors must match. This is finite supporting evidence, not a general expression-equivalence proof.
- Current service-role unpaid workspace reader output must match after restore. Authenticated JWT-role rejection is checked while executing as the local fixture administrator; this is NOT a real SQL-role login or RLS penetration test.
- Same cluster with pre-created global roles. No independent-cluster global-role recovery, hosted Auth login/session recovery, Storage bytes, post-restore write replay, physical devices or operational recovery point/time guarantee.
- Metadata coverage deliberately excludes index/trigger/policy/sequence/view-definition/type/extension/default/generated-column parity and Auth function bodies. Do not call this complete schema parity.

## Investigation history
Initial strict text comparison rejected semantically equivalent owner-only explicit/default ACL representation and seven redundant-AND parenthesis differences. All data hashes and function fingerprints already matched. A later added JWT rejection assertion exposed only an untrimmed psql trailing newline in the harness. Those defects were repaired without weakening accounting/source/access guards. Every attempted run cleaned its exact task resources. Terminal result and hashes are recorded below only after actual completion.

## Production gates retained
Complete exact-release hosted $5 award/regular-Q-Side lifecycle acceptance; settle Side recipient selection before unpaid obligation integration; physical independent-human/device offline rehearsal; specifically approved hosted backup and isolated restore; exact artifact/schema rollback compatibility and production authorization. No source archive or local synthetic restore substitutes for these gates.

## Verified terminal result
At 2026-10-30 11:40 UTC the isolated runner exited 0. All 239 ordinary app/auth tables retained exact row fingerprints, including 48 synthetic profiles, 48 tournament-role rows, two unpaid drafts and two current unpaid finals. The original database was unchanged. The Q/up case retained $285 regular awards and $4.50 explicit synthetic funding; the no-Q/down case retained $280 awards and $0.50 restricted balance. No money moved.

The ephemeral custom dump contained 4,710,325 bytes, SHA256 b08e8104a3c62398b2e7eabadcfa3133caccbcafff5ee05b1423cd424de8c44c. Dump/restore comparison took 10,805 ms, not a hosted RTO measurement. Selected metadata parity, recovered workspace equality and authenticated-JWT rejection checks passed. Local canonical scores are seeded; this does not prove independent paper capture/review recovery.

Both task databases and exact task-created container e6df19b44dd47b469303f51fe73ac24349ed2a83fad08dd7e587fd68fef233ee were removed; absence verified at 11:40:25 UTC. Evidence remains locally in ignored test-results/synthetic-local-restore-result.json, synthetic-restore-verified-run.log and synthetic-restore-container-cleanup.json. Full application verification passed 1,095 tests, build, audit and workspace checks. No hosted export, publication or production change occurred.

## Hosted return audit and preserved checkpoint
Hosted no-Q scoring remains 15/102 verified games; supported attachment paths ended with Debugger unattached. No further browser actions or score retries occurred.

Fresh fixture: $510 base income; sanctioning $51 plus meals $109 = $160 eligible benefits; hall $44 plus cards $25.50 = $69.50 operating costs. Raw regular budget $280.50 rounds down to $280 because $280 + $160 = $440 exceeds the $433.50 minimum. Restricted $0.50 is excluded from participant return. Proposed prizes are $95/$70/$45/$45/$25.

Earlier fixture: sanctioning $51 plus meals $102 = $153 eligible benefits. $280 + $153 = $433 falls below $433.50, so awards round UP to $285, requiring $4.50 explicitly accounted funding. Proposed prizes are $95/$75/$45/$45/$25. These distinct expense lines explain the different direction; neither historical fixture was rewritten.
