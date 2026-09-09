# Manual payment response contract

## Finding

Manual-payment response validators accepted the expected field values but did
not require the exact RPC response shape. Their rejected-response validator
also combined record and void error codes, so a retry could be treated as
resolved by an error that belongs only to the other operation.

## Repair and acceptance criteria

The payment routes, recovery route, and retry client now validate the exact
`0040_manual_roster_payment_ledger` response contracts:

- record success has exactly eight documented fields;
- void success has exactly nine documented fields;
- rejection has exactly `status`, `code`, and `rosterEntryId`.

Record and void rejection codes are separately allowlisted. An opposite-
operation, extended, malformed, or cross-roster response is unavailable to
the route and remains unresolved to the client, retaining the retry lock.

## Verification

- Inspected `0040` response builders and code mappings for both manual receipt
  operations.
- Regression coverage rejects injected fields and proves record-only and
  void-only codes cannot be accepted by the opposite operation.
- Local checks passed: lint, 65 tests, production build, and diff check.
- Focused Sol review found one P1 in the initial repair (mixed operation
  rejection codes). The follow-up exact operation-aware validator was
  re-reviewed with no P0/P1 findings.

## Limit

This protects manual-receipt request/recovery semantics. It does not make a
receipt a paid-in-full determination, reconciliation, enrollment, eligibility,
or result/finance finalization. Real independent director sessions and ledger
conservation/finance reporting tests are still release gates.
