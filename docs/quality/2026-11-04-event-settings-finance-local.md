# Event settings and Finance local verification

Acceptance: preserve the full setup request and historical declaration data;
retain incomplete raw settings for draft recovery; prevent older acknowledgements
from clearing new work; carry configured settings across later saves; no payout
configuration changes qualification; isolate optional-pool funds from the regular
event fund. No database execution or publication is authorized in this phase.

## Executed

- Full `pnpm verify` exited 0: dependency audit clear, ESLint zero errors,
  1,503 application tests, provider readiness, production build and eight
  workspace checks passed. Log: `test-results/event-settings-finance-final-verify.log`.
- Six local handoff checks passed: `test-results/event-settings-finance-handoff.log`.
- After the full gate, one additional acknowledgement regression was added:
  all 13 current settings/Finance focused groups passed. It verifies a positive
  complete receipt and rejects changed settings, revision, version or authority.
- New prepared acceptance harness passes Node syntax and ESLint checks; it was
  NOT executed, imports alone do not create a fixture or invoke Docker.
- Independent review cleared setup/recovery/snapshot and disabled SQL candidate.
  Review found Finance could move a Q/Side line into regular income via a reasoned
  correction. Bucket immutability was added and regression tested across ordinary
  correction, void and reopening; reviewer confirmed closure.

Earlier browser evidence for the unchanged controlled section is in
`2026-11-04-playoff-section-and-labels-local.md`. This phase adds pure contracts
and models, not an enabled UI or public route.

## Unexecuted / not delivered

SQL parsing, application, role ACLs, rollback and concurrency are unverified.
The source-reviewed SQL candidate is private/revoked and not a migration.
The proposed local acceptance harness covers core save/replay/reconcile/carry,
injected post-core failure, three lock barriers and intentional empty clear. It
does not replace the broader ACL/provider/activation acceptance plan.

Public activation integration, legacy amendment compatibility, currentness-bound
read workspace and public transport/UI remain unfinished. The pure activation
assessment always blocks. Previous snapshots must come from the locked server
reader; a posted null/partial snapshot is never proof that settings do not exist.

The separate Finance model is an estimate/evidence calculation proposal, not an
authoritative ledger or Finance page. No real receipt/payment was recorded. Actual
source authorization, evidence deduplication, versioned disclosure and final
approval/disbursement remain required. Custom paid-place cutoff policy and
Satellite distribution remain unresolved.

No hosted reads/writes, database fixture, SQL execution, migration, deployment,
invitation or money movement occurred. Existing migration files unchanged.

## Later separately approved local database run

The preceding limitations describe this earlier phase. Daron subsequently
authorized ONE disposable local database; its private settings/Finance draft
test passed and the fixture was removed. See
`2026-11-04-settings-finance-disposable-db.md` for actual applied hashes, coverage,
cleanup and remaining V3 carry-trigger/ACL/helper-stub/provider/activation gaps.
No hosted application, deployment, actual ledger or financial authority follows
from that bounded test. Do not use this earlier report as the latest runtime status.
