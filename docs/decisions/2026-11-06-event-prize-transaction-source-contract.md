# Prize draft transaction and compatibility source contract

## What runs locally

createEventPrizeTransactionV1 is an executable server-only coordinator specification with injected ports. No concrete database/provider implementation or endpoint is connected. Both write and read-recovery capabilities default off. The existing direct older-writer barrier is a pure decision helper, not an installed database trigger.

The coordinator validates the canonical complete envelope against its own retained base before access, pins the fixed account/tournament and frozen request, and rejects a foreign tournament before IO. Current verified director/co-director access is required before and after the operation. The transaction port must read current roles and sources under the same real locks; those facts cannot come from posted JSON.

An existing owned operation is checked before fresh-source/lifecycle conditions so exact accepted/rejected historical replays remain readable after source changes. Changed bytes under the same operation conflict. Malformed/unrecognized records stay unknown. A new save verifies current setup/settings/prize pins and absence, reserves outer+nested operation identities, then stages the nested draft and prize snapshot inside a savepoint. Snapshot/receipt validation and head compare-and-swap must succeed. A failed stage rolls back those metadata changes and can retain an immutable bound rejection. Journal or outer-commit failure cannot be reported as accepted. Commit ambiguity remains unknown; neither replay nor recovery invents non-execution.

Final acknowledgements are revalidated after the journal callback; committed values must match the coordinator-produced result. Returned receipts are detached/frozen before the last async access check. No award/payment authority is present.

## Recovery is separate from writing

A distinct default-off recovery capability uses lockRecoveryAccess and owned operation lookup only. It does not call the business-source reader, reserve, savepoint, stage, head-CAS or completion methods. Current settings/head migration or unavailability must not hide a valid owned receipt when the current role still permits reading. Missing permission-lock support stays unknown. A verified missing record does not authorize a write or clear pending data. Current role checks still apply; this is not access for former officials.

Enable the authenticated read-only recovery path before allowing any real writes and retain it if the write flag is switched off. A real adapter must not make its role-only reader depend on the write flag or current prize model.

## Older writers: fail closed until coordinated

Known direct paths are setup-v1, linked-setup-v1, custom-q-v2, event-settings-v3 and custom-pool-v4. If a same-lock read proves no V2 head AND no V2 history, the extra compatibility barrier is inapplicable; old authentication/lifecycle checks remain mandatory. Existing V2 history, a missing head, unknown version, inconsistent source or unknown writer blocks direct older writes. The helper never changes retained data or grants authorization.

Before storing any V2 snapshot, every real core setup writer needs a reciprocal database-level guard, not just a UI check. A nested old writer inside the new atomic save must be recognized by a private reservation binding actor, tournament, outer operation, nested operation, full request and expected revision. Do not introduce a client-set bypass boolean or new role/claim. Rejected/completed reservations cannot authorize a later unrelated old write. Do not deploy a write barrier alone before a usable new editor/save path exists: preserve an old client's device draft and offer explicit review in the current editor.

## Real implementation still required

For Supabase, implement the complete sequence in ONE PostgreSQL function/transaction with real role/source locks, savepoint semantics, immutable operation rows and compare-and-swap. Several separately committed HTTP RPCs wrapped in a JavaScript callback are not atomic and are forbidden by this contract. The real adapter must distinguish confirmed rollback from an uncertain commit; never infer rollback from a lost connection. Concurrency, role revocation, old-writer races, source changes, failure after each stage, Unicode/hash consistency and exact historical replay require a real approved test backend.

The 1 MB request limit is unchanged. Nested receipts/journals repeat request data, so their strict bounded read limit is 8 MB. The future authenticated transport must use these distinct budgets without raising the public request limit. Existing larger Finance source history can be reviewed without being mistaken for an outgoing setup request. Historical snapshots and methods are not recalculated.

Rounding residue/shortfall, entry-fee comparison intent and bracket-bound recipient evidence remain unresolved/unimplemented. No payout math, optional-pool rule change, third-place match or new financial record is added by this source contract. The paused EventFinanceProviderSectionV1 readback with known P2s is a different workflow and is untouched.
