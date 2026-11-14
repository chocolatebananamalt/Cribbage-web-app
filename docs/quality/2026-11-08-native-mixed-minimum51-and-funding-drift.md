# Exact Minimum-51 Review Compatibility and Supported Funding Drift

**Result: local PASS.** The frozen minimum-51 schema plus exactly three review functions passed the read-only resolver matrix and supported expense-drift test. No application/SQL proposal implementation, user policy, hosted record, deployment or persistent access changed.

## Exact schema and fictional data

The local baseline used the known empty post-0236 fixture (SHA256 `e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`), the 56 hash-verified migrations 0237-0292, and the exact official 51-source package:

`database/release-packages/native-preparation51/supabase/migrations/20261107090229_native_preparation51_closed_install.sql`

SHA256: `22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58`.

The baseline moved from 781 to 1,160 app/public functions. No current proposal-order59 substitution or unrelated accounting-function replacement was used. This was direct local execution inside the package's required transaction; it does not establish official migration-history execution or current hosted drift.

A new fictional test database was constructed from this exact template's standard pre-data and post-data schema sections and selected data from the already verified completed18/108 fictional checkpoint. No broader schema functions were imported, and no live guard was disabled. All post-data commands ran with ON_ERROR_STOP; acceptance began only after construction committed. Function definitions, owners and ACLs matched the exact 1,160-function template.

The source and target shared 419 tables. All 1,985 shared rows matched row-hash comparisons; 87 shared tables were populated. There were no omitted populated tables, discarded populated columns, defaulted populated columns or differing populated column types. Four broader-development tables absent from minimum51 were empty: event_regular_finance_outcomes_v1, event_regular_finance_reservations_v1, event_regular_finance_revisions_v1 and operational_event_finance_source_adoptions_v1. The two new target-only pilot tables were also empty before test enrollment.

This proves reader operation on a newly constructed minimum-51 schema with preserved fictional data, not an in-place conversion of the broader development database. Triggers installed during standard schema construction do not retrospectively prove insertion-time actions. The separate complete fixture's writer/oracle proof, identical transferred rows and unchanged authoritative review over all 108 journal histories provide the provenance evidence used here. No claim of writing a complete rehearsal through minimum51 was added.

## Three-function addition and review checks

The only addition to the minimum schema was:

- `native-mixed-qualification-review-v1.sql`: default-false gate and private getter; SHA256 `ee216fee4313839e99b0176aa5be78bdd3eb163d6540805f3a43d4a0939b7459`.
- `native-mixed-qualification-review-provider-v1.sql`: public own-session resolver; SHA256 `b1896f8050060c22841fd24394185726abadf3c62879d3832abac8ffb38e0961`.

The three-function transaction rolled back without changing prior rows, catalog or schema metadata, then installed closed. It increased functions to 1,163 while preserving all 1,160 earlier definitions, owners and ACLs. Sixteen runtime groups passed: current Director/Co-director reads, source-authority changes, role/session/scope/issuer denial, append-only cohort exclusion and expiry, session revocation, disabled review, immutable-history/receipt protection, accepted consent revocation, genuine two-connection lock contention, and data/catalog/schema preservation. The available review exactly matched the broader fixture capture, including canonical Start/funding/review digests, 18 cards, 108 heads and $540 simulated gross. Costs, net and awards stayed null.

The test uses actual PostgreSQL SET ROLE with fictional Auth/session rows and supplied claims. It does not verify JWT signatures, real Supabase HTTP/cookie sessions or real devices.

## Legitimate expense drift

The drift case calls the existing supported API `public.record_tournament_expense(tournament_id,100,'USD',description,idempotency_key)` as the Director. It does not alter an immutable funding receipt, change an entry fee or invent a correction policy.

Observed inside a rollback-only transaction:

1. Funding source and review were initially available.
2. The fictional $1 expense returned expense_recorded, version1, USD and reconciled=false. SET CONSTRAINTS ALL IMMEDIATE passed, exercising deferred history validation.
3. Exactly one expense event, operation receipt and audit were added: expenses0->1, receipts350->351, audits349->350. Exact replay returned the same response and added nothing.
4. All protected funding, Start, game, participant and identity rows remained unchanged. Fresh funding returned blocked/funding_scope_changed. The qualification getter blocked earlier at source_changed, and the public resolver returned NULL. It did not invent zero costs, a new net fund or any award.
5. The ordinary native ledger stayed quarantined with mixed_or_unknown_synthetic_domain. Replaying an old private funding operation returned its historical receipt but could not make the current provider available.
6. Rollback restored every captured row hash, function catalog, app schema ACL and the original available review. Gates and provider ACLs were read back closed. No real money moved, no refund was created and no expense was adopted into simulated prize accounting.

This closes the supported source-invalidation test. It does not implement post-Start funding amendments, net-prize recalculation or official financial adoption.

## Failure correction, cleanup and verification

The first minimum-schema run passed the resolver checks but stopped before the expense append because a private diagnostic lacked app schema USAGE. That is the intended minimum privilege boundary; the normal public resolver succeeded without private-schema access. The corrected fixture added schema USAGE and diagnostic EXECUTE only inside the rollback-only transaction. No application grant was changed; schema ACL restoration was compared explicitly.

The correction replayed the exact already verified fictional construction SQL (SHA256 `8f64555e77573c0d5df0434bd931c730219e1045d58607884a341f739f902e7a`) into a fresh disposable container. Its function definitions/owners/ACLs matched the same minimum template. No rescoring or source-data transformation occurred.

Both containers were network-none, with zero ports/mounts/passwords and temporary NOLOGIN roles. They were removed and independently verified absent:

- `66cb4512d74f65c6520b5dd6fdb88414e0414cc5b38a6f755f3d190af209ad52`.
- `8e6b9a828bc7181527c7f76a18a2220a29433b81a78a0d2e9acfc5becc00bcf9`.

Evidence: `test-results/native-mixed-min51-20261108/` records template, transfer, construction and the first diagnostic failure. `test-results/native-mixed-min51b-20261108/` records the exact replay, successful resolver/funding observations, closure and independent cleanup. Independent source/evidence reviews found no definite P1/P2 issue in the bounded claims.

Focused tests passed53/53. New harness lint: zero errors, six unused-import warnings. The 16 app-source closure hashes are unchanged; prior 2,553 application tests, production build, offline React/provider checks and provider configuration proof remain applicable. The registry audit was not retried; no full fresh public CI claim is made.

## Remaining release gates

Exact minimum-schema reader compatibility and supported expense-drift invalidation are now verified locally. Still unverified/unperformed: real signed-in JWT/cookie/provider and phone/laptop acceptance; current staging target/drift and recovery preflight; official packaging/history for the three-function delta; separately authorized hosted installation, public source publication and named time-bounded access. Completed hosted mixed evidence is not created by publishing this reader.

The reader still cannot close official mixed qualification, adopt ordinary Finance, calculate/approve final awards or move money. Existing payout-policy questions remain untouched. Full human rehearsal readiness requires the separately reviewed draw/Start/scoring/qualification/Finance integration and device acceptance; these local reader tests do not establish it.
