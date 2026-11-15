# Full preparation51 candidate — local official CLI acceptance passed

## Acceptance and environment

Apply the exact reviewed migration through the official CLI to populated fictional0292; test rollback, permissions, legacy compatibility, idempotence and resource cleanup. All listed local checks passed. Staging and production were not accessed or changed.

Database: cached Supabase PostgreSQL image `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`, restored from verified empty post0236 baseline then directly applying the canonical0237–0292 SQL. Historical fictional seed:45 rows in17 populated tables, monitored across254 tables. The baseline contains no `supabase_migrations.schema_migrations`; the CLI initialized history normally. **No historic entries were fabricated or repaired.** This proves compatibility with the0292 schema, not continuity with staging's actual migration history.

CLI: official checksum-verified2.121.0 Linux binary in digest-pinned Debian PostgreSQL17 companion. Both containers `--network none`, zero published ports and zero host bind mounts. One labeled disposable Docker volume at `/tmp` carries the Unix socket and fictional database; no TCP listener, credentials or permanent access. The migration role is local disposable `postgres` superuser, not a managed Supabase non-superuser. No browser/audit denial was retried.

Candidate version/name: `20261107090229_native_preparation51_closed_install`; file SHA256 **22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58**. The CLI-container file's `sha256sum` independently matched before success. The source itself is unchanged from the reviewed51-source closure, except the outer explicit transaction was removed for official runner ownership.

## Executed checks

- Injected `select 1/0` after the entire candidate: CLI failed at statement1213. Before retry, existing function definitions/owners/ACLs, table metadata/count, sequences, Q constraints, history rows and historical row values matched the baseline. No candidate functions persisted. The failure log is intentional rollback evidence, not an installation failure.
- Replaced only the known-rolled-back injected copy with exact candidate bytes: CLI applied successfully. History recorded version20261107090229, expected name and1213 statements. Repeat applied an empty list; history remained exactly unchanged.
- Functions:781 prior owners/ACLs unchanged.779 prior bodies unchanged; exactly the two reviewed guarded activation branches changed: `app.bind_prize_schedule_on_activation_v1()` and `app.require_event_prize_activation_pins_v1()`. The five legacy accounting functions remain exact in definition/signature/owner/ACL.
- All379 new functions deny EXECUTE to anon/authenticated/service_role. All118 new tables have RLS.354 effective checks (118 tables ×3 roles) deny table and any-column access, including access via PUBLIC/inheritance. Supplemental direct table/column grant counts are zero. Three previously reviewed new tables do not FORCE RLS; direct application access is nevertheless denied.
- Prior table owner/ACL/RLS/force metadata unchanged. This comparison does **not** claim exhaustive preservation of all prior column grants or policies. Existing five non-system sequences retain exact metadata/ACL/value strings; one new sequence denies all three application roles. Q constraint definitions unchanged. Coupled Side/schedule DDL remains an intentional reviewed change.
- All45 pre-existing fictional rows retain exact existing-column values across254 monitored tables. Legacy linked setup save, exact retry and rolled-back probe work after installation.

Evidence under `test-results/native-mixed-official-full51-20261107`: `official-full51-report.json`, full-failure/success/repeat logs, `catalog-permissions.json`, `effective-table-privileges.json`, compatibility snapshots and `cleanup-independent.json`. The history-row JSON fingerprint is c0f6b0034790ebce8167e478f009a9e87dae0a43c03b80600cebba47edb7ee19; it is a captured history fingerprint, not an assertion that CLI statement serialization equals original SQL bytes.

## Failures retained and cleanup

The first attempt stopped before CLI because the local restore had no history table. The second proved full injected rollback, then could not overwrite Docker's root-owned copied SQL. Both were removed with verified cleanup and retained in `*-missing-history-attempt` and `*-root-owned-file-attempt`. The final runner lets CLI initialize empty history and writes files as the CLI user. Independent review identified and verified fixes for pre-state cleanup and effective-privilege proof gaps. A late standalone read-only observer attempted after the prior fixture ended; it failed without touching data and is not acceptance evidence.

Final database container25d49518cb726759bb26d691e6b8b1c41f228049f4e63b7313a8b1db8f148e88, CLI container612514c68c8d57a1a03a18725aa0a9e4b2661cf8bb44248b773ba71e6ff77bce and labeled volume `cribbage-native-mixed-official-full51-20261107-socket` were removed. Separate metadata-only verification confirms all five containers across the three attempts and the volume absent. No persistent credentials/access or hosted changes were created.

Independent review: local official-CLI acceptance GO, no new P1/P2 findings. Source-integrity and SQL lexer tests pass; scoped harness lint passes after removing an unused inherited import. No product/UI source changed; prior application/build evidence remains separate. Required audit/browser denials remain unattempted.

## Remaining gates and smallest safe action

The local official-runner gate is closed. Next obtain a **fresh private staging recovery export and verified isolated restore**, including the real migration history, then run the exact package/catalog/legacy checks on that restore with the actual managed-role permissions. The old export is stale. Hosted access/actions and any named event/cohort/grants or deployment require separate approval. Do not install into staging based solely on this superuser fictional baseline.

No new30-step preparation workflow or108-game rehearsal was run under this CLI-installed fixture. Prior same-source atomic51 workflow evidence is composed evidence, not a rerun. Signed-provider, human role/browser acceptance, current fixtures and post-commit recovery remain unverified. Rollback here means **pre-commit transactional rollback**; a website rollback cannot undo committed schema, and no destructive down migration is proposed. Finance, draw/Start/scoring and broader access remain disabled.
