# Source-only versioned prize-settings QA

New files: src/lib/api/event-prize-settings-v1.ts; src/lib/finance/event-prize-finance-binding-v1.ts; tests/event-prize-settings-v1.test.mjs. No UI or existing persistence module changed.

Eleven focused tests cover exact full-envelope/raw-text preservation, old-codec incompatibility, duplicate/foreign/missing event coverage, actor/operation recovery, independent SHA-256 against Node crypto, all rounding and inactive text in the fingerprint, historical carry/changed kind, initial and empty drafts, snapshot source changes, fresh immutable ACK IDs, legacy ACK rejection, canonical event/snapshot/finance binding and no amount return for all four methods. Tests use in-memory fictional values only, no database fixture.

Resource checks reject accessors without invoking them, cycles, sparse/huge arrays, shared-reference expansion and oversized UTF-8. Explicit array and shared traversal budgets bound processing before canonical allocation. No content is truncated. The limits are technical wire limits, not ACC entrant/event limits.

Independent source review GO; focused11/11. Final verify/handoff logs and exact totals: test-results/event-prize-settings-v1-verify-final.log, event-prize-settings-v1-handoff-final.log and checkpoint receipt after completion. Existing layout browser evidence remains unchanged because this slice has no UI enablement. No new browser/account/provider/database acceptance is claimed.

Pure plans require database-proven prior snapshots, canonical event mapping and transactional read consistency before use. There is no real writer, row lock, CAS, rollback or ledger movement here. Mathematical decisions remain open and new flags are false. The separately paused Finance readback still has its known P2s and is unchanged. Archive is local source/QA, not database recovery, a full checkout or off-device backup.

Final frozen verification passed:2147 application tests, audit with no known vulnerabilities, build/provider checks, workspace8 and private handoff6. Lint0errors/119existingwarnings. The11 focused source tests passed independently as well. No UI changed, so no new browser or provider acceptance is implied.
