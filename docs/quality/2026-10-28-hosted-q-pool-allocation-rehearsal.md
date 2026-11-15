# Hosted fictional Q Pool allocation rehearsal — 2026-10-28

## Scope and identity

User-authorized two-player staging test, no actual funds, payouts or production changes. Existing authenticated director `de0f27a1-60d0-4449-af83-fdf360a9bc08` used supported Preview UI throughout. Staging project `nnhcnvksxgxnpvdqjgpg`; published head `86a615d3f330f7308acd934d5c8a5ae8dd2bc87a`. No application changes or migrations in this acceptance run.

- Tournament: `3cbae2fc-b621-4726-a582-4807744f3e42`, TEST ONLY — PR122 Q Pool Allocation 2026-10-28.
- Event: `d5433d23-8acc-463d-846f-ff32589dc959`, TEST ONLY — Q Pool Allocation Main.
- Base fee $30.00; separately version-bound Q1 $5.00 and Q2 $10.00. Existing Equal metadata was selected only to configure pools; no payout policy was implemented or exercised.
- Players TEST ONLY QTest01 / QTest02, paper roster only, no accounts or roles created.

## Observed passes

1. Explicit membership v1: QTest01 elected both named pool versions; QTest02 declined both. Obligations saved explicitly as $45.00 / $30.00.
2. Initial cumulative fictional receipts $37.50 / $30.00. QTest01 allocation $30 base + $5 Q1 + $2.50 Q2 produced Q1 paid-entry eligible and Q2 ineligible. QTest02 remained ineligible for both.
3. Voided QTest01's old $37.50 receipt once, retaining history. Server workspace returned received $0.00, stale allocation and both pool eligibility flags false.
4. Recorded replacement cumulative TOTAL $45.00, not an additional $45.00. Old allocation remained stale until explicit version-2 allocation $30/$5/$10 bound to replacement receipt `a8ba2c82-46a0-4d1d-9834-8d2becaa98a9`. Both pool paid-entry flags became true.
5. Both players checked in; registration closed; permanent seats A-1/A-2 published once. Twelve synthetic empty matchups published once. Event started exactly once. No scores entered.
6. Post-start QTest02 first opt-in controls disabled with explicit pre-play election warning. Ordinary saves disabled; existing pre-play records permit only reasoned director corrections. No disabled control was bypassed and no rejection was forced through an alternate API.
7. Refresh preserved membership versions 1/1, allocation versions 2/1, current receipt bindings and eligibility. Safe recovery status reported zero unsent scores/retry records.
8. Read-only SQL verified exactly two membership records, three allocation records and five accepted Q operation receipts. Each receipt has exactly one linked audit event; read-only reconciliation returned the original saved action/version for all five. Publication/start operation receipt counts each equal one.
9. Active cumulative receipts total $75.00: $60 base, $5 Q1, $10 Q2. Four receipt-history events: receive $37.50, void $37.50, receive replacement $45, receive other player's $30. No double counting.

## Preservation and limits

Funded fixture settlement workspace digest remained `52e148eb5ec6b84e998af2663aeb2197`. Its tournament row digest remained `6d2192029476d58404bc9dc7920f2543`; older negative fixture row digest remained `72e82fac8fb40ee8f75f05941054b27b`. No real money, payouts, new access, email, production writes or publication.

This run proves UI locking, persistence, exact operation/audit counts and read-only reconciliation. It does NOT claim hosted simultaneous mutation replay/concurrency, forced response-loss recovery, backend late-write rejection or post-start correction execution. Those are distinct from prior isolated SQL/race coverage. Automatic Q payouts and canonical Q settlement remain disabled.

Screenshot: `test-results/q-hosted-final.png` (refreshed post-start workspace).

## Tool/UX observations

Date input initially failed to update controlled app state through fill; normal native segmented keyboard input resolved it, with exactly one fixture created. No validation bypass. CSV template download observation timed out; no business mutation was pending. Used the existing supported paste-CSV field to validate/publish the reviewed schedule instead. Full-page screenshot timed out; final viewport capture succeeded.

Two potential UX issues merit separate local reproduction, not treated as confirmed root causes: setup money blur combined with adding pool rows appeared to replace unsaved rows; seating draft created before attendance appeared stale until changing seats-per-table regenerated it. Final persisted setup/seating were verified correct before publication.

## Next bounded step

Select Q Pool payout policy against official ACC guidance and explicit director choices before implementing automatic awards/settlement. Independently, a synthetic hosted photo recovery/review acceptance can validate the published recovery fix without external OCR or real images. Neither is claimed complete by this membership/payment test.
