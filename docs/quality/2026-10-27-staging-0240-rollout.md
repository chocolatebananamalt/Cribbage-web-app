# Staging 0240 rollout — 2026-10-27

User approved publication and staging-only migration, followed by read-only checks. No production release, business-record test writes, financial entries or playoff outcomes were authorized in this step.

## Published artifact

* Repository: chocolatebananamalt/Cribbage-web-app; branch codex/director-setup-journey.
* Commit: `c3eeec1ab777a6ff6411d2ec240b227c13a98824`; non-force push verified against remote. PR 122 remains open/draft against main.
* Reviewed inventory: 78 files. Publication scan found no credential patterns/files; personal paths in new evidence were redacted. Staged whitespace check found five trailing blank lines; removed before commit. No application dependency/configuration change.
* Both exact-head Verify runs succeeded: 40529211334 and 40529218199. Vercel Preview Comments succeeded; Supabase Preview skipped and is not isolation evidence.
* Git-created Preview `https://cribbage-web-gd2rl760r-cribbage-app.vercel.app`, deployment `dpl_2t6qL8BGWc4aJ2G88kPyBCCCrsSj`, READY at exact commit above. No denied redeploy route was retried.

## Fresh runtime isolation and preflight

User signed into the new hostname. Existing Chrome tab 336434193 showed the authenticated chooser and the exact staging-only sixteen-player tournament `c59f74ae-1174-4e3a-b1d4-4d9d0ddebc2d`, Director role, sixteen checked-in roster entries and saved setup/start state. Staging independently identifies its sole director as existing `pr122-director@test.invalid` / `de0f27a1-60d0-4449-af83-fdf360a9bc08`. No password, cookie or token was read. Local queues were empty; no signout/account switch performed.

The chooser's deployed `list_actor_tournament_workspaces_v1` call uses `createServerOnlyAdminClient`; the server client takes only the same public Supabase URL as auth, requires its existing scoped secret key and has no alternate backend fallback. Successful privileged reads of the matching staging-only records establish fresh runtime/backend isolation before migration; no write probe was performed.

Target independently verified: `nnhcnvksxgxnpvdqjgpg`, cribbage-pr122-staging, ACTIVE_HEALTHY. History had exactly 239 entries ending at 0239 (`20261027014833`). V3/v5 tables absent; current user postgres; expected legacy service grants present. Seven affected legacy functions owned by postgres with empty search_path and service-only execution. Zero active domain writer calls observed at the preflight query instant; this is not a lasting concurrency guarantee.

## Applied migration

Supported Supabase apply_migration called once with exact canonical `database/migrations/0240_versioned_settlement_v5.sql`. Success returned; no retry or 0239 reapplication.

* History now 240 entries, exactly one `0240_versioned_settlement_v5`, version **20261027180303**.
* Stored history has one statement, **72,908 bytes**, SHA256 **92f81b32bed0618fda4b17cb7c2def2564e6a6bfdf6a819a51d9c572c52833e8**, matching reviewed working-file bytes exactly.
* Git stores LF-normalized SQL, SHA256 **19107d90cc6c86fbf3497bb7bd0f28ad19c07f48f0393eb0ee0d9e693f40b701**. Equality after CRLF normalization verified; no SQL semantic difference.
* Historical local-only comments in the exact reviewed SQL are superseded by this actual deployment/history evidence; the migration itself was not edited after testing.

## Read-only postflight

* Seven new public RPCs: postgres owner, empty search_path, anon/authenticated execute false, service_role true. All seven affected legacy public functions retain the same owner/config/ACL posture.
* Twelve new private helpers: postgres owner, empty search_path, no direct execute for anon/authenticated/service_role.
* Four new tables: postgres owner, RLS enabled and forced; no direct SELECT/INSERT/UPDATE/DELETE grants for those three roles.
* Four immutability and six domain/canonical triggers enabled; no unvalidated new constraints and zero dual-domain playoff events.
* Existing checker B without a director role in this fixture receives null from both new workspace readers. This is read authorization proof, not a staging writer-negative test.
* Playoff UI reads qualifiers Paper02, Paper01, Paper04, Paper03 with correct semifinal pairings and offers Version 1; no fields entered or outcome submitted.
* V5 settlement UI reads 4,800-cent assessment, zero receipts/expenses, no recorded playoff source, no expense bound, and disabled save. This proves the combined fail-closed state, not the assessment alone as the isolated reason.
* Unadopted legacy settlement route remains on its original Post-event settlement draft page.

Listed business counts before/after: legacy results/drafts/finals all 0; new results/drafts/finals/conflicts all 0; receipts **411**, audit events **473**, roster payment events **4**, expense events **0**. Migration/schema history necessarily changed; no claim of globally unchanged database state is made.

## Advisor findings and remaining gates

Fresh security advisor: 186 INFO RLS-without-policy findings, including the four new private deny-by-default tables; 40 WARN authenticated SECURITY DEFINER functions elsewhere (none of the seven new RPCs); one WARN leaked-password protection disabled. No Auth/security setting changed. Prior staging password exposure/rotation remains unresolved.

Fresh performance advisor: 169 INFO unindexed foreign keys, including **19 on the new settlement tables**; 421 INFO unused indexes, including eight new indexes on empty tables. These require scoped index review before production/load claims; no schema changes were added during read-only rollout checks. References: [foreign-key advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Independent review found no P1/P2 mismatch in installation/read/ACL evidence and confirmed its limits. No staging writer/replay/conflict/concurrency acceptance was run. Prior two rollback fixtures/five races and 840 tests/full aggregate/browser component checks remain local evidence, not new hosted mutation passes. Service-only functions still rely on verified server-subject, same-origin and strict request-validation boundaries.

Next separate approval: exact synthetic playoff outcomes and bounded settlement claims/negative finalization scenario. The unfunded $48 assessment must not be marked paid or finalized by inference. Q Pool membership/payout policy, typed byes, funded positive settlement, OCR, physical multi-device/offline, SMTP and production release remain separate gates. This report is local-only follow-up; no new commit/push/Preview was created for it.
