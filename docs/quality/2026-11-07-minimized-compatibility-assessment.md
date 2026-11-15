> Later result: the recommended captured-role fictional test passed; see 2026-11-07-native-captured-role51.md. This closes the local superuser-dependency concern. The current-staging recovery/actual-history/provider gates remain and no backup or hosted action occurred.

# Least-sensitive compatibility path — evaluation only

## Recommendation

**Do the staging-matched-role test using the verified restore/migration materials to create a new fictional local0292 fixture first.** We already have read-only staging role/schema/catalog metadata and the previously tested fictional fixture recipe; its database containers were removed. This next diagnostic requires no new hosted export, real Auth/session/player rows, database password, grant or cloud target. It materially addresses the superuser-versus-managed-role gap before asking Daron to copy sensitive records.

If a fresh structural difference remains material, separately authorize a **schema-only** export plus password-free, allowlisted role/security metadata and fictional test rows. Treat it as a compatibility test, not a recovery backup. Defer the complete private export request until it is needed for the pre-install recovery/preservation gate. Nothing in this assessment authorizes a fixture, export, hosted action or new access; no database was created or exported during the evaluation.

**Before any change to current staging, the fresh verified recovery requirement remains unchanged.** A schema-only or sanitized test copy cannot recover its existing tournament, Auth, session, financial or other records. A separately approved empty test project could be an alternative destination for preliminary rehearsal, but never a replacement recovery point for later changes to current staging.

## What each option establishes

| Option | Data copied | Useful proof | What it cannot prove |
| --- | --- | --- | --- |
| Existing metadata + fictional0292 + staging-matched non-superuser role | Already captured catalog/role fingerprints and local fictional records only | Exact candidate DDL/CLI under modeled ownership, memberships, CREATE rights; effective access, rollback and synthetic legacy paths | Current full staging schema/row compatibility, provider-only hooks, authentic old history, fresh restore or recovery |
| Fresh schema-only + password-free role/ACL metadata + fictional canaries | Object definitions/security metadata; no table rows or large-object contents | Fresh structure, dependencies, triggers/constraints, role/owner behavior and candidate installation on an empty/synthetic copy | Existing-row preservation, actual sequence state, real Auth sign-in, populated-data branches, historical ledger bytes or recovery |
| Explicitly allowlisted nonpersonal reference/configuration rows, only if necessary | Reviewed tables **and columns** with no free-text/JSON/person identifiers unless specifically verified | Selected data-dependent branches and configuration versions | Completeness or anonymity of unreviewed data, unknown real-world cases, whole-database recovery |
| Full fresh private logical recovery package | Covered staging database data, schema/history and supplements, potentially sensitive Auth/session records | Covered data restore/preservation and actual history continuity when independently compared; managed-role test on that restored copy | External provider/signing settings, Storage object bytes, operational hosted Auth, off-device/production disaster recovery unless separately covered |

PostgreSQL's `--schema-only` excludes data; roles are cluster-global and need separate password-free metadata. Keeping definitions for the Auth schema can be necessary for dependencies without copying any Auth users/sessions. Do not drop required schemas, owners or ACLs merely to make restoration easy and then claim permission compatibility. [PostgreSQL17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)

## Exact first diagnostic

Create a new disposable local database from the existing verified empty post0236 archive, then apply canonical237–0292 and fictional historical canaries, as in the prior full-candidate test. Reproduce the captured non-superuser `postgres` attributes, memberships and source-confirmed schema privileges locally; preserve source configuration rather than “fixing” it. The source owner has CREATE/USAGE on app/public, owns the touched tables and ledger, and has pg_read_all_data membership. Run the unchanged official CLI candidate hash22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58 via the proven network-none Unix-socket arrangement. Test failure/rollback, exact install/repeat, ownership/ACL/RLS, sequence and synthetic legacy behavior; remove and verify owned resources.

This can expose privilege failures hidden by the earlier superuser test. Even a pass is **modeled managed-role compatibility**, not certification of Supabase's hosted enforcement or actual staging data. Source permissions or provider dependencies that cannot be reproduced remain explicit gates. Previously approved disposable fictional local testing covers this kind of local diagnostic; no new hosted access is included. This turn evaluated the option rather than running it.

## Schema-only/minimal extraction safeguards, if needed later

- Require separate authorization for any fresh schema export; it is not created by this plan. Existing connector metadata access needs no new credential. A native schema export would normally need the existing database password privately and verified TLS; do not create/reset credentials or widen permissions.
- Use schema-only definitions and preserve relevant ownership/ACL/RLS/trigger/extension metadata. Do not use no-owner/no-ACL shortcuts for a permission proof. Include structural Auth dependencies but omit all Auth/session/identity/token rows, Vault data, Storage rows/object bytes and real application rows.
- **Schema does not mean secret-free.** Function bodies, defaults, comments, foreign-server/user-mapping options, configuration and historical SQL can embed identifiers or credentials. Review and protect the definition package; do not print or upload raw contents. Any redaction affecting behavior must be recorded as a proof limitation. Password-free role metadata must allowlist settings rather than blindly copy potentially secret custom settings.
- Prefer source-controlled public reference data and fictional canaries over exporting configuration. If real reference data is essential, review a table-and-column allowlist first. Merely excluding auth.* is insufficient: profiles, notes, audit payloads, JSON and application ledger links may hold personal data. Replacing names while retaining linked real IDs is pseudonymization, not established anonymity.
- Do not take a full export and sanitize it afterward to claim that no sensitive data was copied. The original capture already contains that data. Any sanitization must occur before records leave the source, needs an explicit reviewed extraction specification and read authorization, and must not write to staging. No such specification or extraction was executed here.
- Keep even minimized outputs in verified nonsynced protected local storage; same-account assistant tools can access them for verification. No intentional third-party upload or persistent access. No new private folder or prompt was created.

## Migration-history boundary

Current evidence already confirms292 unique nonempty history rows, order/names through0292, candidate absence and the latest0290–0292 exact hashes. All781 current function definitions/owners/ACLs match the local baseline. It does not establish all historical SQL bytes.

A schema-only export contains the ledger's structure, not its actual rows/statements. Version/name metadata can support read-only preflight, but do **not** populate292 fake “applied” rows or blank statement files to bypass official CLI safeguards or call that authentic continuity. Any explicitly redacted/projected history model can test only that model; it does not close the actual-history gate. Existing real history may itself contain creator identifiers or embedded data in SQL, so do not assume it is harmless metadata to export wholesale. Keep the unresolved gate until appropriately authorized original history is verified, or a clearly narrower proof is reviewed and labeled as such.

## Source finding and recovery hold

The candidate's diagnostic immediate-write inventory reports60 DO blocks and no regex-detected top-level app INSERT/UPDATE/DELETE targets. Those blocks perform dynamic catalog/DDL wrapping; a regex inventory cannot prove absence of data effects or replace populated-data testing. Existing constraints, triggers and deferred behavior can depend on actual rows.

The minimal diagnostic is not usable to restore today's saved draft, records or Auth state. Prior recovery is stale. Before modifying current staging, independently verify a fresh complete covered recovery point and isolated restore, source drift, actual history and preservation, plus acknowledge external/Storage/off-device limits. A verified existing provider recovery mechanism could be assessed separately if available, but none is established here; do not assume a plan entitlement, upgrade or restore ability. Supabase documents that database backups omit Storage object bytes. [Supabase backup scope](https://supabase.com/docs/guides/platform/backups)

## Access, decisions and outcome

Recommended next action is the already scoped, non-sensitive local role-matched diagnostic. No Daron credential or new hosted permission is needed for that. Only if it leaves a material structural gap should we request a schema-only export. A complete backup request remains a later, separate pre-install step; no recovery requirement is waived. Creating a fresh empty hosted target, granting access, enrolling participants or publishing requires its own target/cost/account authorization.

Independent source review agrees with this staged recommendation and the recovery separation. No export, hosted write, credential/access change, local database fixture or message was made in this evaluation. Only local source/evidence analysis and official documentation reads were performed.

Independent review: GO, no P1/P2 findings or recovery-policy weakening. Wording explicitly distinguishes retained fixture materials from an active database; no fixture currently remains from the prior tests.
