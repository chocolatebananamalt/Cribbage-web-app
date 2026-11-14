# Preparation SQL: 51-Source Conservative Closure

Local source and evidence review: **PASS**. Hosted release: **HOLD**. This supersedes the 57-source prerequisite count in the earlier preparation-only package. No hosted systems, user tournament, credentials, persistent access or money were touched.

## Safe reduction demonstrated

The unchanged 23-file preparation UI/API overlay needs neither the older Director lease nor the full draw/Start preparation readers. Local acceptance permits removing these four sources:

- `native-mixed-pilot-director-session-v1.sql`
- `native-mixed-pilot-preparation-v1.sql`
- `native-mixed-pilot-draw-reservation-v1.sql`
- `native-mixed-pilot-bootstrap-status-v1.sql`

A second tested cut removes the unused pair `custom-q-accounting-bridge-v1.sql` and `custom-combined-accounting-v10.sql`. Their custom Q helpers and private clone names have no identified consumer outside the pair. This also avoids widening the existing Q-policy constraints and removes fourteen new function declarations/clones from the 53-source experiment.

The result is **51 sources**, **379 new functions**, **118 new tables** and **one new identity sequence** against the numbered0292 baseline. It is a conservative whole-file closure, **not** a proof of the globally minimum SQL/object set. The schema footprint remains broad. Original proposal files were not edited.

`test-results/native-mixed-closure51-report-20261107.json` lists every retained source, six removed sources, explicit safety roots, and literal existing-table DDL. `native-mixed-preparation-sql-dependencies-20261107.json` records the diagnostic reference graph. That graph includes comments/dead branches and misses dynamic SQL/column dependencies; it was not used alone to authorize a cut.

## Why the remaining indirect dependencies stay

The named-reference graph yields45 files. Four reviewed safety roots expand it to the exact tested51:

| Retained source/group | Reason |
| --- | --- |
| Custom Pool setup V3 | Supplies a Side ratio column and immutable draft guard. Its ownership DO block requires `guard_custom_side_policy_v3`. Removing it would leave column/guard dependencies, even with no active Side Pool in this test. |
| Side bridge and graduated calculator | Supply that guard and its calculation dependency. Do not remove only the guard or substitute an empty source. Their public writes remain closed; no Side payout is enabled. |
| Own-player and Paper binding sources | Confinement dynamically renames/wraps both public functions by literal name. Omitting either breaks installation. |
| Reviewed-seating trial scope | Retains security amendments and raw random/reviewed endpoint denials. Static non-use by bootstrap is not a reason to remove a security guard. |

The remaining settings, rule-context, native-ledger, playoff and simulation history objects supply real table types, FKs, immutable receipts and cross-domain idle/collision checks. Whole-file dependencies retain unused private writers. Further object-level extraction would require separate proof of those contracts; this work does not weaken them to make the schema smaller.

## Closed atomic install

The raw proposal files contain inline grants and separate COMMITs. Applying them sequentially and revoking afterward would leave a transient exposure window. **Do not use the raw source list as hosted installation instructions.**

The tested compiler preserves interior source bytes, removes only top-level transaction wrappers, combines all51 sources in one transaction, and places **379 literal new-function revokes before its single COMMIT**. No new function becomes visible with its interim grants. It does not revoke existing function privileges.

Exact local transaction artifact:

`test-results/native-mixed-bootstrap-atomic51-20261107/closed-install.sql`

SHA256 `41000e612ade0fc36a6374bf6806f0ac13821fe0d18d9e1c2fc48660fbb6ce88`.

Lexical tests cover quotes, escaped strings, nested comments, dollar bodies, transaction errors and all source interiors. This is a bounded source compiler, not a general SQL semantic parser. The actual PostgreSQL install is the decisive proof.

An injected error rolled back to781 existing functions with bootstrap absent. A separate connection inspected the catalog while the writer was held before final revokes/commit: it still saw781 functions and no bootstrap. After commit it saw1160 functions, with the authenticated bootstrap lease still closed. The writer was held through stdin, not a timing sleep.

Official hosted migration packaging remains a gate. The transport must preserve this single atomic visibility boundary; do not assume a migration tool's transaction wrapper can accept nested BEGIN/COMMIT unchanged. No migration record, schema-cache notification or hosted SQL was executed here.

## Least privilege and compatibility

Before the test's explicitly approved five bootstrap grants, all379 new functions were closed to anon, authenticated and service_role. After them, the measured catalog allowed exactly three authenticated own-session/consent functions and two scoped service functions. All other new functions stayed closed.

Ten actual SQL calls to random/reviewed seating, synthetic mixed, native own/Paper/game, Director dispatcher and wrong-role bootstrap entry points failed at EXECUTE permission before function bodies. Actual SQL leases also rejected wrong roles before constructing a privileged client.

All118 new tables have RLS and no application table or column privileges. The three native-ledger allocation tables retain their previously reviewed lack of FORCE RLS; they have RLS and no direct application access. All five existing non-system sequence metadata/ACL/value records were equal before/after installation, with bigint fields serialized as exact strings. The new identity sequence has no anon/authenticated/service_role USAGE, SELECT or UPDATE.

All **781 existing function owners and ACLs** were preserved. **779 existing function definitions** were unchanged. The only two body changes are:

- `app.require_event_prize_activation_pins_v1()`
- `app.bind_prize_schedule_on_activation_v1()`

They add a guarded native-activation early return, needed to prepare a natively bound test event without pretending there is a legacy prize declaration. The guard requires an accepted activation receipt, exact actor/tournament/revision/operation and request hash, immutable operational attempt and matching proof. Ordinary/unsupported activations fall through to the original bodies. These are existing-body replacements; the package is not purely additive.

The five previously excluded accounting functions remain exactly unchanged in body, signature, owner and ACL. Existing Q-policy constraint names and definitions are also unchanged. The old linked setup writer, exact retry and rollback passed with the historical Equal/Graduated Q setup. All45 prior fictional rows were retained with unchanged values in their existing columns across254 monitored tables; new rehearsal rows were allowed.

Remaining literal existing-table DDL is explicit, not hidden by the five-function result: a custom ratio column on `tournament_setup_side_pool_versions`, expanded method/ratio checks on `side_pool_graduated_policies_v2`, and an additional simulation source method on `event_schedule_publications`. The ratio bounds are storage/implementation limits, not an ACC rule. These remain in coupled source files and need final restored-staging catalog/legacy-path review. No new Side payout method is made executable by this preparation package. The report's literal DDL list is not a complete dynamic schema diff.

## Final local lifecycle and cleanup

Fixture `6a145123798fc721fbffc2abb6a95b87b39ffeed5be72aad2b7f5842790c4f45` passed the exact atomic51 install and **30 unique preparation operations with exact readback**: intent, simulated funding scope, eighteen simulated entries, attendance scope, paper declaration, six own-subject consents, separate checker review and readiness seal. Consent clients constructed zero privileged clients; self-review was blocked; revocation changed readiness to waiting and the probe rolled back. Draw, Start, scoring and operational activation stayed off.

It was removed with verified cleanup. Independent metadata-only verification confirms all **30 tracked local containers** absent, including the intermediate53 and sequence-only experiments. See `native-mixed-dependency-closure-cleanup-20261107.json`. No new full108-game, playoff, qualification, award, refund or actual payment claim is made.

The unchanged 23-file source/build proof remains separate and valid. Application tests2361 pass again; source/atomic unit tests and scoped harness lint pass. Dependency-audit and localhost browser denials were not retried. Local calls used injected fictional claims and SQL-backed adapters, not signed Supabase sessions, real HTTP, browser or IndexedDB acceptance.

## Remaining gates

The reduction and local compatibility/least-privilege question is answered. Hosted use still requires a current private recovery export with isolated restore, a fresh actual-staging catalog/data comparison, reviewed official atomic migration packaging and privileges, a named TEST ONLY native base event/cohort/roles/expiry, actual signed-provider/browser acceptance, and separate installation/activation approval. The user's saved setup is excluded. Do not later enable Finance/Custom-pool features against this trimmed package without their own reviewed integration and authorization.
