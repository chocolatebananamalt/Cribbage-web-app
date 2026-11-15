# Main/Consolation explicit-fund integration checkpoint

Local only. No new database fixture, hosted access, migration, publication or money movement.

## Implemented

- Explicit-fund comparison V2 consumes a supplied fund rather than inferring received money from advertised fees. Prior models are preserved.
- Top 6 expands to eight places to include the whole 5th–8th finishing band. Requested and actual cutoff counts remain separate from the fund-balance warning.
- Append-only whole-band adjustment proposals require reasons and exact history chains. Voids require an existing adjustment and restore its source amount. Positive-award place count is separate from cutoff count. Changed source bindings make proposals stale instead of silently rebasing them.
- The server-only basis adapter derives the regular fund from the event ledger projection and qualifier count from the existing strict qualification DTO. Q-Pool and Side Pool funds remain excluded. This is a qualification-only estimate, with no recipient-assignment, finalization or disbursement authority.
- Setup-stage review can defer only the unknown final original-field-size check until before playoffs. Actual playoff review remains strict. Neither wrapper nor planner authorizes activation or claims external approval.

## Evidence and limits

Focused tests cover source rounding, balanced and imbalanced funds, whole-band expansion, zero awards, stale histories, invalid voids and source isolation. Full verification results are in `test-results/maincon-integration-verify.log`.

Authoritative provider readers, durable adjustment and allocation writers, additional-income evidence, commit reservations, guarded operational activation and final playoff-recipient assignment remain unfinished. Posted IDs and digests are not authoritative proof. Custom ratio population/count policy and Satellite distribution remain unresolved and blocked.

## Next runtime scope

A separately authorized disposable local database is required to execute the new workspace, activation-source and native-ledger reader SQL and test ACLs, snapshot carry, stale pointers, cross-event and restricted-pool rejection, concurrent reservations, exact retry and rollback. None was created in this checkpoint. Provider acceptance and staging rollout remain separate gates.

## Completed verification

Full local gate passed 1,569 application tests, six provider checks, dependency audit, ESLint, production build and eight workspace checks. Six handoff checks passed. No database fixture was used.
