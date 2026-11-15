# Common entry-fee evidence (local, unmounted)

Acceptance: establish a common fee only when every entrant in the pinned complete qualification-result universe has one unique receipt, current obligation and fully reviewed event-only regular-entry allocation, all equal to the saved advertised fee. Hold missing, partial, waived, discounted, overpaid, bundled, duplicated or changed evidence. No average or discounted-fee policy is inferred.

Implemented `common-entry-fee-evidence-v1.ts`, a pure check retaining participant/roster, receipt/physical evidence and obligation IDs. The caller supplies the authoritative complete participant universe and event/qualification/setup pins. Eligibility for another event is not itself a rejection: the actual allocation must put the entire receipt into this event's regular-entry fund. No source mutation or award authorization.

Eight focused test groups cover successful full fees, mixed-case UUID identity, source-order independence and rejection mutations. TypeScript and scoped lint passed. No database execution, fixture, hosted operation or denied-operation retry was attempted.

Added the private authenticated collector candidate `database/proposals/common-entry-fee-source-v1.sql`. It checks the current Director/Co-director role, uses the existing current reviewed fund source, freezes native ledger/activation/allocation plus obligation and complete qualification-row heads with NOWAIT locks, and collects latest receipt/obligation IDs and versions for every original entrant. It checks the full immutable allocation snapshot rather than its event-filtered projection, rejects any split receipt and requires complete event fund coverage. Contention returns retry; it never falls back to weaker evidence. Its own gate is literal false, both functions are revoked and no public wrapper or route was added.

Added `common-entry-fee-source-v1.ts`, a strict server-only decoder cross-checking the existing reviewed fund, event/setup/allocation/qualification pins, complete field and qualifier inclusion, receipt allocations, and every retained head binding. Output does not alias the source and grants no freshness, bank-settlement or award authority. Independent re-review cleared the collector, canonical UUID duplicate correction, and decoder with no remaining P1/P2 findings. Decoder SHA-256: `4df3e4b3beb78325f20ba052bdbec7eebc12c439e6cfff79cb9d061115fbe73f`.

Remaining verification/integration gates: SQL is unexecuted (including syntax/runtime, ACL and concurrent-head/rollback behavior), and this source is deliberately NOT wired into modern prize calculations or the award writer. A caller-provided object is not proof of freshness, authentication or settlement. Current `verified_entry_fee_reference_required` hold and all existing default-off gates remain unchanged. No user payout-policy decision is needed to verify the unambiguous full-fee collector.

Collector SHA-256: `3b61c06d3b176c23fbd0bd94ec0fa018e8db0800c5d86805279f23e016f06bec`.

Event-bound late-Consolation add-on receipts need their own charge/scope evidence, not a fabricated tournament-wide obligation. They remain unsupported by this initial common base-receipt check. Simulated funding likewise must not masquerade as actual receipt evidence. Discounted/mixed/waived cases stay held for a later explicit policy.

Follow-up: local modern-review wiring is now implemented in docs/quality/2026-11-10-modern-prize-fee-review.md. This supersedes the earlier unmounted-only integration status; all runtime/enablement limitations remain.
