# Captured staging-role candidate test — local PASS

## Result and scope

The exact preparation51 candidate passed official CLI execution with the captured **non-superuser** `postgres` posture. This closes the earlier concern that the candidate only worked because the local migration role was a superuser. It is a local modeled-role pass, not actual hosted-provider acceptance. No hosted connection, export, access creation or deployment occurred.

The fixture was rebuilt from the verified empty236 archive, canonical237–0292 and45 historical fictional rows across254 monitored tables. Baseline restoration/migrations/seed used the local setup administrator before role matching; those old migrations were not retested under the captured role. The exact new candidate alone then ran with the modeled source permissions. Local history was initially absent and CLI initialized it, so authentic292-row history continuity remains outside this test.

## Role model and actual login proof

`tests/helpers/native-captured-staging-roles-local.mjs` pins the captured staging metadata/project and the exact owned fictional database. It reproduces seven role definitions/selected attributes and allowlisted nonsecret settings, nine `postgres` memberships with ADMIN/INHERIT/SET options, and compares effective privileges on app/public/auth/extensions. Source search_path is preserved exactly, not corrected. Source PostgreSQL role settings outside the captured allowlist cannot be copied silently.

`postgres` is NOSUPERUSER, INHERIT, LOGIN, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS, matching the captured flags. Source privileges are modeled, not claimed to be a newly minimized migration role. `supabase_admin` remains local-only setup/catalog administrator; the official CLI connection URL names `postgres`. Separate actual login probes before and after the CLI run confirm `current_user=session_user=postgres`, `rolsuper=false`, `role=none`. All captured role arrays and membership options still match after installation. No password or persistent credential was created; trust authentication is confined to the isolated Unix socket.

Limits: this does not reproduce every global role, membership grantor or provider-only hook/permission enforcement. It does not connect through the real Supabase pooler/Auth API or prove signed JWT behavior. Application-role denial tests do not establish the whole provider's least-privilege configuration.

## Executed migration and preservation checks

Candidate and in-container CLI input SHA256 both **22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58**, official CLI2.121.0. PostgreSQL image and companion Debian CLI image are unchanged pinned digests from the verified socket test. Both containers are network-none, no published ports or host bind mounts; one labeled disposable volume carries the Unix socket/fictional database.

- Full candidate plus final division-by-zero fails at statement1213 and rolls back function definitions, table metadata, sequences, Q constraints, history and old-row changes.
- Exact candidate retry succeeds once; expected version/name/1213 statements captured. Repeat applies nothing and history is unchanged.
-379 new functions deny EXECUTE to anon/authenticated/service_role.118 new RLS tables pass354 effective table/column privilege denials, including inherited/PUBLIC access. One new sequence denies all three roles.
-781 existing function owners/ACLs unchanged; five accounting definitions exact; only two previously reviewed guarded activation bodies change. Existing table owner/ACL/RLS/force metadata, sequence metadata/ACL/value strings and Q constraints remain unchanged. This does not claim an exhaustive old column-policy comparison.
-45 fictional historical rows preserve existing-column values across254 monitored tables. Legacy linked save and exact retry succeed in a rolled-back compatibility probe.
-All captured role settings/membership options and non-superuser login posture remain unchanged after success/repeat.

Evidence: `test-results/native-mixed-official-role51-20261107/official-role51-report.json`, `captured-roles-proof.json`, `postgres-session-before.json`, `postgres-session-after.json`, full-failure/success/repeat logs, catalog/privilege/compatibility files and independent cleanup receipt. Source harnesses are `tests/native-mixed-official-role51-{runtime,run}.mjs`.

## Cleanup and checks

Database container `41af8b2d07d2e34ad21dcf75e5a4a01a58f9155ca05623642a989442ee41df13`, CLI container `cae8843af640447e3c9004da9ef4d6d0e6ec20d8bb32af7d7db4c9a412424e34` and volume `cribbage-native-mixed-official-role51-20261107-socket` were removed. Separate metadata-only checks confirm all three absent. Every local test role/grant disappears with the cluster. Public tool images and fictional evidence remain, with no persistent access.

Independent source/evidence review: GO for modeled local role gate, no P1/P2 findings. Scoped harness lint and source-integrity/lexer checks pass. No product UI or scoring/payout policy changed. Prior audit/browser denials were not retried. The earlier23-file build and30-operation preparation proof remain separate; neither was rerun as a signed provider/browser workflow here.

## Shortest next step to real-device acceptance

The local superuser-dependency blocker is removed. **Do not add a schema-only export just to repeat this role proof.** Current staging still needs its separately approved fresh recovery point, actual history/data verification and eventual provider acceptance before release. The next concrete step for this existing target is the narrowly scoped private backup/isolated restore authorization already drafted, with nonsynced storage verified and password entry wholly private. No full backup is created by this result, and no recovery condition is waived.

Once recovery/actual-ledger checks pass, request separate exact approval for the frozen closed51-source schema and preparation-only23-file preview. Named TEST ONLY event/account/cohort/roles/expiry plus the five scoped RPC grants remain a later authorization. Actual own-player consent, independent nonself review, refresh/retry and expiry tests then run through signed-in devices. Draw, Start, scoring and Finance remain disabled in this first slice; the full18-player rehearsal is not yet ready. No real funds, invitations, saved-draft enrollment or production are included.
