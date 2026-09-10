# Retire legacy payment recovery execution — 2026-09-10

## Finding

The payment recovery scan found the older five-argument,
hash-bound `get_roster_payment_operation_reconciliation` function still
callable by authenticated users. It retained director/co-director scope and
did not expose payment amounts, but the current application uses the newer
identity-bound reader from migration `0046` exclusively.

## Repair and verification

Migration `0086_retire_legacy_payment_reconciliation_execute.sql` revokes all
browser-role execution of that older signature. It does not change payment
events, receipts, balances, or the active identity-bound recovery route.
The regression proves the active payment route/client do not reference the
retired function and that the migration revokes `PUBLIC`, `anon`, and
`authenticated` execution. It was applied first to disposable synthetic
database `donfxulkliuyteiannir`, then pilot
`fnjkwymxpnsqvxtpronk`. Both catalogs show the retired signature has neither
anonymous nor authenticated execution while the active identity-bound reader
retains authenticated-only execution.

This is defense-in-depth only: manual payment evidence remains private,
append-only, and explicitly cannot mark anyone paid in full, reconciled,
checked in, seated, enrolled, or eligible.
