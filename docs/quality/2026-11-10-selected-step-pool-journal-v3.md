# Selected-Increment Pool Journal — Local Source Checkpoint

Implemented a private, default-off Q/Side-only SQL candidate and an unmounted
authenticated collection adapter. No database code was executed or installed.

The collector binds current reviewed ownership, original pool policies, current
activated prize snapshot and separately saved Q/Side rounding. Exact contributor
acknowledgment is required for changed distribution/rounding; existing receipt
consent is never fabricated or silently rewritten. Existing reviewed ranks choose
recipients. Unsupported methods, incomplete paid eligibility, missing fixed
Tournament IDs, impossible equal splits and mismatched funds remain held.

The candidate records immutable, versioned reviewed proposals and final unpaid
pool liabilities, with exact request replay and current-source comparison. It
does not record regular prizes or move money. Reciprocal final guards serialize
against older overlapping accounting domains. Historical reads explicitly deny
current-source/payment authority. New tables force RLS and revoke every caller;
the reserved collection RPC also grants no execution.

The server-only TypeScript adapter checks actual primary-Director identity and
role before and after the injected trusted RPC, independently recalculates
amounts and excludes private receipt/reviewer fields from display data.

## Versioned Ownership Integration

Independent source review found that `native_optional_pool_ownership_source_v2`
calls `event_settings_playoff_source_v1`. The latter's compatibility guard in
`event-prize-activation-source-v1.sql` rejects the very new prize activation pin
this collector requires, with `new_prize_playoff_integration_required`. Existing
activations lack the required pin. That original blocker is now addressed in
source by `selected-step-pool-ownership-v3.sql`, a distinct journal and Main-only
official-play reader. The legacy guard and V2 journals remain untouched. The new
reader validates the exact current prize/settings/context activation, preserves
official Start and current qualification evidence, and uses the established
series-only rule assessment after proving the newer prize pin. Every new
ownership function pins UTC locally to stabilize captured timestamps and hashes.

Independent review found no further source dependency blocker within inherited
scope: one active Main, 12 qualifying games, 1–2 Q pools and 1–6 Side pools.
This is source review, not proof that database execution succeeds.

## Finalization Transport and Review Display

The new default-off authenticated transport accepts only version/source/revision
pins, Director reason and explicit review. It never accepts posted amounts or
recipients. It checks primary-Director identity before and after the trusted
server call; changed identity or uncertain provider outcomes require recovery
with the exact operation and request. Historical receipts cannot assert current
funds or payment. Write and recovery RPCs remain revoked.

An unmounted, default-off presentation component displays separate Q/Side funds,
saved increments, player names and fixed Tournament IDs. It deliberately has no
recording controls pending safe retained-request UI integration and database
verification. No authenticated route or live page is enabled.

## Checks and Limits

- Twelve focused Node tests passed: existing selected-step calculations/proposals,
  review projection, wrong amounts/identity/rounding/funds, role/session changes,
  closed gate zero calls, exact write/recovery transport and static SQL boundaries.
- TypeScript `--noEmit` and changed-file ESLint passed.
- Independent source review found and verified fixes for series-assessment and
  local UTC issues; this is not runtime approval.
- No SQL parser/runtime, transaction/concurrency/rollback/ACL backend acceptance,
  signed-in provider acceptance, browser verification or retained-request Director
  UI integration was completed. Static SQL assertions do not prove executable SQL
  or schema parity. The source transport is not a deployed/accepted endpoint.
- No broad suite, hosted actions, fixtures, credentials, publication, payments or
  denied-operation retries. Old $5 journals/history remain untouched.

Status: **implementation checkpoint, not operational or release-ready**.

Final transport review caught a write-verification gate changing during awaited authorization. A fresh pre-dispatch gate check now prevents any service call; the held-auth gate-flip regression passes. Four transport checks plus prior eight source/calculation checks pass. No SQL execution.

## Follow-up: Page Wiring Implemented

The unmounted/retained-request UI implementation gap above is superseded by
`2026-11-10-selected-step-pool-page-v3.md`: authenticated default-off page/API,
exact retained request controls, immutable source-proven cleanup and offline
phone/desktop UI now implemented. SQL/runtime/provider/full-reload acceptance
remain unverified; no release or access activation.
