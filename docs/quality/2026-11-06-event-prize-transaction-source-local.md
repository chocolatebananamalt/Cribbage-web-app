# Local prize transaction/recovery contract QA

New source: event-prize-transaction-v1.ts (server-only), event-prize-legacy-guard-v1.ts, and transaction tests. Existing prize codec/Finance projection/tests changed only for distinct bounded response handling and Unicode/history regressions. No UI, SQL, route, migration, grant or provider adapter changed.

Focused command: node --conditions=react-server --experimental-strip-types --test tests/event-prize-transaction-v1.test.mjs tests/event-prize-settings-v1.test.mjs. Thirty tests passed, with TypeScript. The server-only guard requires the react-server condition. Independent source/security review GO.

Port doubles model reservation ordering, savepoint rollback, full rollback, rejection replay, exact accepted replay, stale source, same/different operation interleavings, commit uncertainty before/after model commit, late access loss, caller mutation, malformed records, mismatched adapter result, independent role-only recovery, absent recovery support and receipt/journal mutation rejection. Old-writer barriers cover all five known direct paths and unknown/inconsistent presence. No actual database fixture, SQL transaction or row lock is involved; the serial queue is not proof of PostgreSQL concurrency.

Large positive cases: 32 fictional Unicode event descriptions with a request below 1 MB produce a larger complete ACK/journal; a 3,000-row in-memory Finance history remains review-only. Response read limit is explicitly 8 MB; outgoing request limit remains 1 MB. ASCII Unicode escapes in tests avoid shell-encoding corruption. Values are preserved, not shortened.

No browser rerun is claimed because this slice changes no UI or live provider wiring. The prior fictional layout and Library screenshot remain unchanged. Full final verify/handoff logs and checkpoint receipt record exact totals after completion. Actual single-transaction adapter, reciprocal old-writer database hooks, runtime concurrency and signed-in provider proof remain unimplemented/unverified. Both capabilities are off by default; all operational amount and award paths remain blocked.

Final frozen checks passed:2166 application tests; focused30; build/audit/provider checks; workspace8 and private handoff6. Audit found no known vulnerabilities. Lint0errors/119existingwarnings. Independent final source/security GO. Source-only means no real DB atomicity, role lock, journal persistence or old-writer integration has been demonstrated.
