# V5 historical cents and satellite/team SQL acceptance

Verified locally on 2026-10-30 with PostgreSQL17.11. No hosted connection,
credential, deployment, real payment or production mutation occurred.

## Acceptance and actual result

The real V5 writer accepted an immutable synthetic501/499/300/300-cent draft
before0260. Sixteen supported obligations and sixteen supported receipts each
record400 cents, totaling6400; one supported assessment expense records4800.
The historical awards total1600 and conserve6400=4800+1600. The actual final RPC
succeeded in a rollback-only transaction before0260, and both that final and its
receipt were absent after rollback. This proves that an unrelated funding,
source or closure blocker did not accidentally supply the post-migration result.

After0260–0262, the original accepted draft/receipt/hash/audit and exact replay
remained unchanged. Fresh draft and final operations returned the durable
`whole_five_awards_required` rejection, with one exact receipt and audit each.
Independent invocation reads, retained retries, public reconciliation and
request conflicts passed. Exact original accounting, review, funding and
expense rows remained unchanged. The historical V5 reconciliation reader is
operation-only; its writer still enforces the complete request hash.

The combined owning-RPC checks additionally passed:

- Original accepted501-cent satellite draft replay remains exact; a new cent
  draft's actual insert-trigger error rolls back the entire attempted RPC.
- An accepted team replacement carrying an old501-cent award replays exactly.
  A new replacement attempting to copy another old501-cent award rejects and
  rolls back all event, team, receipt, contribution and transfer writes.
- An ordinary500-cent team award still transfers successfully. The original
  contribution stays byte-equivalent, the two contributions total1000, and the
  replacement paper team's generated scorer status is `not_required`.

The current satellite/team module reports all five result flags true. These
rolled-back satellite/team errors do not create durable rejection receipts;
V5 controlled rejections do. The acceptance does not conflate those outcomes.

## Reproducible local boundary

Command:

```powershell
node --experimental-strip-types tests/run-v5-legacy-cent-container.mjs
```

The runner requires the existing reviewed image
`sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`
and refuses an existing named fixture. It creates only its labeled
`cribbage-qaccounting-local` container, with no network, published ports, mounts,
privilege or image pull. PostgreSQL listens only on the container-local Unix
socket. The pinned empty post0236 baseline SHA256 is
`e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`.

The V5 seed is a bounded adaptation of `tests/funded-settlement-v5.sql`, whose
unchanged source SHA256 is
`798afcb947a1e81601f822db3f30cb94de80664839296aebb39b74b0a3c1a374`.
It removes that source's placeholder operation-receipt INSERT. An actual expense
RPC receipt supplies the synthetic foundation FK, and the source's later expense
call is exact replay. No V5 operation receipt is manually inserted, altered or
deleted; no trigger or policy is disabled. The original fixture file is unchanged.

An initial V5-only run passed after normal0237–0262 migration application.
The combined run also exposed a pre-existing generated-column defect in team
replacement. Parent-owned0263 removes only the explicit generated scorer-status
column/value from that transfer INSERT. Its770 bytes/SHA256 are
`5dbc8a283f178f6602c9394b706dd6b1af8761c0935cbca86403821765439db9`.
The combined test deliberately applies0263 after0259 and before constructing
genuine historical cent replacement receipts, then enables0260–0262. It proves
historical replay and current denomination enforcement independently; it is not
a hosted rollout or a claim of production migration authorization.

The first combined attempt's deferred-official fixture transaction error and the
second attempt's real generated-column failure are preserved in separate logs.
All attempts removed their exact databases and containers and verified absence.
The final successful container was
`9e9e6c27401b0a22401f38920d4f6389eb91eb600380fb7c63315891775128e5`;
its `fixture_v5_legacy_cent` database and container were removed after testing.

Evidence in ignored local `test-results/`:

- `v5-legacy-cent-sql-result.json`: final combined result, PostgreSQL version,
  exact image/container, migration byte counts/hashes and all result flags.
- `v5-legacy-cent-sql-latest.log`: final successful owning-RPC execution.
- `v5-legacy-cent-container-cleanup.json`: final exact-ID absence confirmation.
- `v5-legacy-cent-sql-first-result.json` and `v5-legacy-cent-sql-first.log`:
  independent initial V5-only pass, without0263.
- `v5-legacy-cent-sql-combined-attempt1.log` and `...attempt2.log`: reconciled
  failed attempts, with their cleanup evidence in each log.

## Other executed checks and limits

Syntax checks passed for the new acceptance export and both runner files.
ESLint passed for those three files and the satellite/team acceptance module.
Nine focused tests passed using:

```powershell
node --conditions=react-server --experimental-strip-types --test tests/legacy-award-rejection-recovery.test.mjs tests/new-award-denomination-guards.test.mjs tests/legacy-satellite-team-rejection.test.mjs
```

Full repository verification and integration status remain lead-owned. Setup,
identity, qualification and start foundations are explicitly fictional direct
fixtures; this is not evidence of played games, official payout-policy approval,
physical cross-checking, real collection or disbursement. HTTP/browser acceptance
and operational launch/restore requirements remain separate gates.
