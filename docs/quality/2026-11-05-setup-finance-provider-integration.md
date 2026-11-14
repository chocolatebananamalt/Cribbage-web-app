# Setup and Finance provider integration — local candidate

This checkpoint is local only. No hosted tournament was read or changed, no migration was applied to a hosted database, no website was published, and no money moved.

## Explicit payout review

When a proposal's benefit, expense or income history changes, previously adjusted payout groups remain intact and editing stays blocked until an explicit review. The review shows the previous and current proposed fund, per-person amounts before and after review, retained manual amounts, formula amounts and the remaining imbalance. A required reason appends correction records to the existing override lineage. It never silently balances the fund, changes qualification or adopts a changed native receipt/expense/allocation basis.

The review panel is connected to the controlled Finance section and its existing device-draft session. Device save/reload preserves the review history, including explicit zero overrides. Device storage is not a server ledger receipt. Exact BigInt cents formatting avoids floating-point display rounding.

Focused tests: 21 Finance review/session/format tests passed; 4 browser-safe provider projection/request-preparation tests passed; TypeScript passed. Isolated in-memory browser checks passed at 320, 390, 768 and 1440 CSS pixels with 100% and 200% text; no network writes or page errors. Evidence: `test-results/finance-provider-review-browser.log` and `test-results/event-finance-browser/`.

## Provider boundary

New provider routes and SQL wrappers are default-off candidates. They use the signed-in ordinary client, derive the actor from authenticated state, check current official roles before and after access, bind full requests and receipts, and retain incompatible saved proposals rather than replacing their basis. The UI projection decoder is not authentication. The server assembler must validate native source evidence before supplying `preparedCurrent`.

The provider wrapper's isolated PostgreSQL lifecycle passed (`test-results/operational-provider-2026-11-05T08-14-52-419Z`): authenticated-role/JWT-context simulation, private/public ACL checks, role denial, full-request replay/reconciliation and the covered unpaid-award source. This is not an actual Supabase provider session. The test database was removed; exact container ID `2af1e891df3df57ebcfeb52a1c7bd7202d050b1931c013227b3691745a75a732` and name were independently confirmed absent (`test-results/operational-provider-cleanup-independent.json`). Frozen provider source hashes are in its `source-manifest.json`.

A separate browser-safe operation host durably retains and reads back the full request before POST, supports exact GET reconciliation and explicit identical retry, hides inactive/stale receipts, rejects oversized/corrupt recovery, and archives an accepted operation only against a matching head and immutable receipt. Eight pure tests pass. Its optional UI is default-off; the application page does not enable it. A trusted authenticated route, real retained-storage implementation and fresh readback integration still require provider/storage acceptance. The browser-safe projection/request builder alone is not authentication or ledger evidence.

Setup V3 mocked UI verification passed 32 scenarios and 36 legacy default-off scenarios, including stale account/mode responses, linked graph readback, lost reply and delayed initial loading. Local role/RPC tests do not establish an actual signed-in browser-to-Supabase transaction. Configured activation stays blocked. Source/API review found and closed receipt binding, stale callback and mixed snapshot issues.

Final frozen-source verification passed 1,826 application tests, six provider checks, eight workspace checks, six handoff checks, dependency audit and build. Lint had zero errors and 117 whole-worktree warnings. The final provider host browser checks passed four widths at 100%/200% text plus stale-callback and foreign-editor privacy cases; all requests to its provider port were in-memory simulations, with zero network writes. Both local Finance servers (3368/3396) were independently confirmed closed by ECONNREFUSED. Actual provider authentication and application page enablement remain unverified and disabled. Real IndexedDB was subsequently verified in isolated headless contexts using the actual default-off HTTP adapter with mocked fetch replies: pending bytes survived reload, no second POST was sent, and exact accepted-head readback atomically archived the receipt and removed only its matching pending record. Four widths at 100%/200% text, stale-callback and foreign-editor cases passed. This is real browser storage but not a real provider login or API/database transaction.

Independent root parity against the new runtime's actual source and saved award rows passed: 54,000 entry cents minus 5,900 allocated costs (including 5,400 sanctioning) plus 2,900 recorded income = 51,000 cents, exactly matching five unpaid award rows. The assessment was covered, not subtracted twice. Evidence: `root-native-final-award-parity.json` in the runtime directory. This proves synthetic local bookkeeping, not bank receipt or payment.

## Gates retained

- Actual Supabase cookie/provider acceptance is unverified; local JWT/role simulation is not a provider login or independent-human test.
- Native source adoption after allocation/receipt/expense changes remains blocked pending a separate audited protocol.
- Operational activation remains unavailable in the new setup flow.
- Sanctioning costs stay covered by existing expense evidence and are not subtracted twice.
- Mixed-mode playoffs, funded optional-pool closure, post-final amendments and real disbursement remain unsupported/unverified.
- Existing historical declarations remain until the complete replacement lifecycle is proven.

The previous verified unpaid-award checkpoint remains unchanged: `native-final-award-journal-verified-20261105.zip`, SHA256 `fb62089e6de82433e4dee3359a12c838d9f24178d27c11906d684a684ed7d53f`. It is a local source/evidence archive, not a complete hosted recovery backup.

## HTTP reader follow-up

A production-only mismatch was found after the first source archive: its shared reader capped bodies at 524,288 bytes while the new handler/retained-operation contract allowed 4,200,000 bytes. A dedicated server-only streaming reader now honors smaller trusted limits and clamps to 4,200,000; the shared reader is unchanged. Actual boundary/factory tests and independent review passed. The browser HTTP adapter also checks serialized outgoing bytes before fetch and rejects malformed, oversized or foreign workspace responses. SQL/transport/handlers and the prior database runtime were not changed or rerun for this HTTP-only fix; both frozen manifests are preserved. The HTTP adapter remains default-off and does not automatically retry.
