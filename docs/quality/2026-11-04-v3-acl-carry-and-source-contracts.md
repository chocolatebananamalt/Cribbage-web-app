# V3 ACL/carry proof and separate source contracts

## Approved additional disposable database: PASS

ONE approved additional container/database was used for V3 access/carry checks:
`46b12237333a5d7472c91dac52155fe145bea2f4e93497ecf22c9b27db1edc85`,
`cribbage-event-settings-acl-carry-local`, database
`fixture_event_settings_acl_carry_v3`. Pinned image and empty baseline match the
prior reviewed isolation; local npipe/socket only, network none, no ports/mounts.
Only the old amount/journal/Q-save/V3-settings proposals were installed after
unchanged migrations through 0292. NONE of the new reader proposals below ran.

Actual checks passed:

- Director save/replay and Co-director carry/replay retained the configured
  factor 2.25 and the entire raw settings object. Historical snapshot unchanged.
- Outsider save/recovery denied; temporary current-Director role revocation denied
  saving and was rolled back, restoring the original role.
- Actual SET ROLE anon/authenticated/service_role denied private V3 save/reconcile
  execution and table SELECT. This is private owner-function/ACL proof, not real
  Supabase sign-in, public wrapper or HTTP authorization acceptance.
- Old Q writer returned its normalized rejection and did not create a revision.
  A direct temporary-function trigger probe independently returned the exact
  `event_settings_require_versioned_save` message. The guard was NEVER disabled.
  Probe receipt/copied revision/function were transactionally rolled back.
- Before/after counts: two setup revisions, two settings snapshots; zero payment
  and expense records. Snapshot fingerprints matched. This is not an all-table
  whole-database fingerprint claim.

## Same-fixture harness corrections, not an uninterrupted first-run pass

Initial harness expected the guard's SQL exception to escape. Inspection of the
preserved core proved it catches P0001 and returns invalid_setup_payload. The
harness now checks that response plus unchanged state and the exact direct guard.
It also switched from display-projected timestamps (with added seconds) to the
accepted immutable request, preserving known-valid payload bytes. The timestamp
difference alone was not proven to cause rejection. A subsequent table-probe SQL
spacing typo was fixed before final actual ACL checks. No product guard, grants
or existing function were changed for these corrections.

All continuations used the SAME container/database. Initial failure logs remain;
no test history was patched or erased. Final continuation3 passed and signalled
the original owning launcher to remove the fixture. Final launcher exit 0 and
cleanup receipt record ID/name absence; a separate Docker check confirmed both.
No additional fixture was created and no hosted records or funds were touched.

Evidence: `test-results/event-settings-acl-carry-runtime.log`, continuation logs,
`event-settings-acl-carry-result.json`, `-container.json`, `-cleanup.json` and stop
control. Independent evidence review confirmed the applied proposal hashes,
same-container chain, bounded coverage and cleanup.

## Independent source-only implementation

Three private SQL readers are prepared, NOT EXECUTED:

- `event-settings-workspace-v3.sql`: locks current setup/role source, validates
  latest base/snapshot/Main-Consolation coverage and rereads the base. It does not
  invent a snapshot for a legacy revision whose new snapshot is absent.
- `event-settings-activation-source-v4.sql`: derives snapshot/association pins,
  paid legacy declaration requirements and current legacy pins. Free historical
  events do not gain a new paid-declaration requirement. Missing per-event context
  remains explicit and activationAllowed is false.
- `native-event-ledger-source-reader-v1.sql`: captures native heads, history,
  activation fees, participant eligibility and optional-pool evidence in ONE SQL
  statement snapshot. It excludes formal and optional mixed/simulation registries
  with guarded dynamic lookup; unknown registry shape fails closed. The capture
  is not claimed commit-current against every writer, and allocationCapability
  stays false. It does not certify bank receipts.

`native-ledger-allocation-plan-v1.ts` validates full native head coverage,
identity/version uniqueness, registered event eligibility, base-fee caps and exact
allocation conservation. Existing or newly requested optional-pool allocations
are blocked until their native ownership bridge exists. No advertised fee becomes
received cash; no partial/unknown source silently becomes zero. Output strips the
temporary normalization version, grants no ledger write and requires a future
commit reservation. Five pure groups pass. The corrected free-legacy activation
case passes as part of six activation planning groups.

Review caught missing mixed-simulation exclusion and a false assumption that the
tournament lock freezes all participant/Side writers. Both source findings were
closed through guarded exclusions, one-statement capture and explicit weaker
consistency/no-write flags. Source review is not PostgreSQL parsing, execution,
ACL, race or rollback proof for these new readers.

## Broader checks and remaining gates

Full local gate passed 1,550 application tests, six provider checks, dependency
audit, ESLint zero errors, production build and eight workspace checks. Six
handoff checks passed. Additional changed test-harness lint has zero errors and
one unused copied lock-helper warning. Logs:
`authoritative-source-contracts-verify.log` and `-handoff.log`.

No published API/root setup, actual allocation/income writer, operational settings
activation or payout finalization was enabled. Per-event rules/context review,
legacy bootstrap/amendment carry, optional-pool receipt linkage, additional-income
evidence and commit-time locking remain implementation work. The prior two
approved disposable databases have both been removed; another fixture requires
separate approval. No hosted migration/publication/real-money action is authorized.
