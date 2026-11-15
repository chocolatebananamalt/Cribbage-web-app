> Later result: the recommended captured-role fictional test passed; see 2026-11-07-native-captured-role51.md. This closes the local superuser-dependency concern. The current-staging recovery/actual-history/provider gates remain and no backup or hosted action occurred.

> Current recommendation: defer this complete-export question while first testing captured role metadata against fictional local0292. See 2026-11-07-minimized-compatibility-assessment.md. This full recovery explanation is retained for a later pre-install gate; no recovery requirement is waived.

# Proposed explanation for Daron — not sent, not authorized

With your approval, I’ll download a fresh private backup of the **test database** to your laptop and verify it in an isolated local copy. It may contain tournament and player/contact details, scores, financial and audit records, and authentication/session records already stored there. Authentication material can be sensitive; the archive will not be treated as a source-code attachment.

The proposed location is a new protected folder under `C:\Users\choco\Documents\Codex\2026-10-22\task\staging-recovery-<new-operation-id>\private`. Before copying data, I must verify that the chosen folder is not automatically cloud-synced or uploaded by backup software; if that cannot be established, I’ll stop and agree on a verified local location with you. No intentional upload to Library, GitHub, email or another cloud service is planned. The data transfer would be from your existing Supabase test project to this laptop.

Folder permissions will be limited to your Windows account and SYSTEM. Assistant tools running under that account can still access the archive, as needed for automated restore and comparison; these permissions do not hide it from those tools. Private records will not be printed or attached in chat. The archive itself is not encrypted by `pg_dump`, and no off-device recovery copy is included in this plan.

You may need to enter the **existing test-database password** privately in a native prompt, outside chat or agent-captured output. It will not be put in arguments, environment variables, logs or files. No new account, credential or access grant is planned.

On the isolated copy, I’ll restore the database and its password-free role/security metadata, then test the reviewed migration, rollback, permissions and repeat/recovery behavior. The successful test changes stay only in that disposable copy. It will then be removed; the protected backup will be retained as the recovery point. Staging and production, actual payments and app publication are outside this approval.

**Proposed question:** May I make that fresh private test-database backup and perform the isolated restore/migration checks? If backup, restore or preservation checks fail, I’ll stop before any live installation.

## Exact planned local writes covered by that question

1. First verify a nonsynced local location, then create a new protected recovery folder and write the dump, nonsecret/password-free role/catalog supplements, checksums and private verification results. No database login password is stored. The dump may itself contain stored Auth/session material, including hashes or tokens if present in staging; do not promise it is secret-free.
2. Create disposable local PostgreSQL containers, local databases, temporary volumes and password-free test roles needed to reproduce source ownership and access. Recreate covered schema, tables/data, sequences, migration history, extensions and security metadata **from the backup**. Local-only restoration may temporarily require a superuser for provider extensions; the migration test itself uses source-matching non-superuser `postgres`. No new hosted users, credentials or roles.
3. Preserve the original dump unchanged. Capture before/after fingerprints on the restored copy. Use the exact existing history, not invented applied rows or potentially different checked-in old files.
4. Apply a fault-injected candidate only in the disposable copy and verify automatic transaction rollback. Then apply exact candidate SHA256 `22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58` through the official CLI and repeat it to prove no-op behavior. Successful local changes include379 new functions,118 RLS tables, one sequence, the listed coupled Side/schedule DDL, two guarded activation-function replacements, internal configuration/version rows where defined, and one migration-history entry. All new application execution remains closed and rehearsal features disabled.
5. Run only bounded legacy save/retry compatibility probes on the local copy inside transactions that roll back. This scope does not commit new player games, attendance, payments or payouts, start a tournament, issue invitations or activate the rehearsal. Verify old rows/ledger/permissions remain as expected.
6. Remove owned disposable containers, volumes and local test roles/databases and independently verify cleanup. Keep the protected immutable backup and its recovery evidence. Any future staging install, access activation, publication or restore into a hosted system needs separate approval.

## Conditions and remaining limits

Agree on a no-edit window and stop for source data, sequence or metadata drift. `pg_dump` provides a consistent table snapshot but does not freeze sequence increments or separate catalog calls. Require export exit0, archive/hash/TOC integrity, complete covered restore parity and source-role migration acceptance. Do not weaken TLS, reset the password or widen permissions to get past a failure.

This logical recovery does not prove hosted Auth login, external keys/provider settings, Storage object bytes, role passwords, off-device durability or production disaster recovery. The backup may contain database rows describing Storage objects, but those are not the stored file bytes. A website rollback alone would not undo committed database changes.

No backup, recovery folder, prompt, database, access grant, live record or publication was created by preparing this explanation. Current approval is pending; existing-password availability is unverified.

## Additional local history check

Offline inspection compared1,496 cached SQL files from11 prior CLI-preparation folders against captured read-only history fingerprints. It found no additional whole-record matches. This does not establish a behavioral discrepancy: source wrapping, serialization or prior byte differences remain unresolved. The292-entry ordering and latest0290–0292 hashes were already verified, and all781 current function definitions/owners/ACLs match the baseline. Preserve actual history in the authorized fresh restore; do not repair it. Evidence: `test-results/native-staging-prepared-history-comparison-20261107.json`.

The earlier scoped backup plan remains the technical procedure: `2026-11-07-staging-metadata-and-fresh-recovery-plan.md`. This explanation changes no authorization or implementation scope.

Independent review requested explicit sync and same-account access wording; both are incorporated. A metadata-only check shows the literal task path is not a reparse point or beneath an environment-reported OneDrive root, but it differs from the Windows Documents known-folder location. Those observations do not exclude all automatic sync/backup software. Nonsynced storage remains a pre-capture gate; no privacy guarantee is inferred from ACLs or path naming.
