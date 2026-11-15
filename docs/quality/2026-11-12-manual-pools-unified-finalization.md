# Manual pools and unified unpaid final approval

Implemented locally, default off. Supported acceptance scope: Main with four qualifiers and current verified manual-playoff evidence. Main-five and larger fields are not runtime-verified by this check.

## Connected workflow

The Director first saves the existing exact pool proposal, then explicitly approves its unpaid Q/Side awards. `manual-pool-finalization-v1.sql` replays current sporting, ownership, fund-review and regular-award evidence before admitting the existing selected-step pool writer. Its original manual guard remains effective against direct bypass. A second explicit approval in `modern-event-finalization-v1.sql` atomically records an immutable snapshot pinning the actual completed regular and pool journals, current proposal, qualification, V3 ownership and fund review. Untouched pools cannot pass. The snapshot creates no additional liability, moves no money and changes no operational event status.

The default-off authenticated API and Director `finance/[eventId]/final-review` page connect these stages. They independently project actual current proofs, redact private source details and retain exact actor/scope-bound requests in IndexedDB for recovery. Accepted historical recovery is never presented as current source proof. Confirmed rejection/unknown requests remain retained; a safe abandonment/reset interface is not implemented.

## Focused evidence

`test-results/modern-event-final-20261112/result.json` records passed=true and cleaned=true. The isolated fixture used actual ownership journals, saved modern proposal, persisted manual generations/game/series evidence, current collectors, fund review, regular award reader/writer, original pool writer and both new transactions. Six handoffs, nine captures and nine independent verifications supported the four-player result. Funds remained separate: regular 43200, Q 17000, Side 16000 minor units.

Direct bypass, stale requests and unauthorized calls were rejected. Injected late audit failures rolled back each transaction; exact retries returned the same accepted outcome without duplicates. Current projection, immutable rows and rolled-back changed-head historical/current separation passed. The known broken-proposal-head exception now returns held/current=false after renewed access checks; other errors propagate. Independent source re-review found no material issue.

Fictional qualifying schedule/score/confirmation rows, Start/assessment snapshots and account/session rows were seeded upstream. Original qualification finalization and actual current-source checks ran. Execution used the SQL owner with fictional claims, not real signed-in provider/device sessions or full end-user ACL acceptance. No full tournament rehearsal or broad suite was run. Four focused transport/contract tests passed; TypeScript no-emit and scoped lint passed (exit 0).

## Limits and release boundary

All page/route/write/database gates remain off; new public wrappers are revoked. No hosted changes, publication, frozen216 changes, payments, ACC submission or official MRP award occurred. Membership/API availability and unresolved registration overrides do not block reporting through this snapshot. Remaining work is reviewed packaging and real authenticated provider/device acceptance, explicit Main-five/other event coverage, and any unsupported financial-policy cases already held by current collectors. This approval snapshot does not claim to close the operational event lifecycle or resolve downstream corrections.
