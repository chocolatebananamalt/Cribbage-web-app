# Native ledger writer: local source checkpoint

## Boundaries

No database fixture, PostgreSQL execution, hosted access, migration, route enablement, publication or movement of money occurred. All SQL in this checkpoint is an **unexecuted private proposal**. Existing archives and historical migrations remain preserved.

## Implemented locally

- `database/proposals/native-event-ledger-allocation-v1.sql` adds private append-only request, outcome and allocation-revision tables. Valid authorized accepted and rejected requests bind actor, tournament, operation and the complete immutable request. Exact replay precedes source freshness checks; conflicting reuse cannot rewrite an earlier request. Busy exceptions roll back the reservation and return an exact-retry result.
- The allocation transaction reserves every native source-reader table in SHARE NOWAIT mode, including optional simulation registries. This intentionally blocks unrelated source-table writers for the short transaction. It is conservative, not a scalable row-lock protocol or a claim that existing writers cooperate with tournament locks.
- Current sources are read again under those reservations. Expected allocation head, source digest, eligibility, base-fee caps, exact source coverage, conservation, reviewed expense classification, nonnegative per-event funds and shared DTO bounds are checked before a revision is inserted. Q/Side allocation evidence blocks the entire native path pending its membership/receipt bridge. No additional-income or fabricated receipt path is added.
- A current allocation reader returns unavailable/stale instead of presenting an old snapshot as current money. An actor-bound operation lookup returns the full historical request/outcome and explicitly denies current-fund authority.
- `native-ledger-handlers-v1.ts` is an injected, default-disabled server-only preparation contract. It checks authenticated role/origin, exact envelope and head binding, rereads authoritative sources/roles, and returns private no-store responses. It journals **prepared planning evidence only**, not SQL acceptance. There is no production route or live transaction adapter.
- `native-ledger-receipt-v1.ts` separately validates private SQL receipt shapes, full identity/request binding and conserving snapshots. Historical acceptance still requires a new authoritative current read. Shape validation cannot turn a posted object into persistence or cash evidence.

## Review and checks

Independent source review closed allocation-part limits, JavaScript trim/UTF-16 reason parity and operation-read isolation findings. The journal and receipt decoder were source-clear. Pure and mocked tests cover stale/foreign sources, negative funds, optional-fund reclassification, role loss, exact retry, lost response, request conflicts, no-store responses and rollback behavior of the mock port. Those mocks do not prove database rollback or concurrent transactions.

Final suite evidence: `test-results/native-ledger-writer-final-verify.log` and `native-ledger-writer-handoff.log`.

## Still required

1. Separately authorized isolated PostgreSQL execution of the reader and writer proposals: install/rollback, actual SQL parsing, denied direct-role calls, current versus historical reads, concurrent operations and source writers, source lock failure, exact accepted/rejected replay, negative and restricted-fund rejection, immutable history and cleanup. No fresh fixture is authorized at this checkpoint.
2. A verified provider transaction adapter and authenticated wrapper that consume persisted receipts, not the preparation-only mock journal. Real-role/provider acceptance must precede any enablement.
3. Guarded operational settings activation remains an **implementation gap**. The current V4 planner/source contract does not supply durable reviewed per-event sanctioning/duration/exception context, nor a writer that binds deferred pre-playoff field-size checks while preserving legacy declarations. It must not be replaced by fake legacy weights or a caller-posted context.
4. Optional-pool native receipt/member linkage, additional-income evidence, and final recipient/disbursement workflows remain separate unfinished integrations. Custom ratio paid-count policy and Satellite distribution remain unresolved. No simulated or real financial records were generated.

## Final gate result

Passed 1586 application tests, six provider checks, eight workspace checks, dependency audit, ESLint and production build. Six handoff tests passed. Independent final SQL source, handler and receipt reviews found no remaining P1/P2. PostgreSQL execution remains pending.
