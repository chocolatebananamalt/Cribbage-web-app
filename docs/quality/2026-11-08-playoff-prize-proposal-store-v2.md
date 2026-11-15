# Private durable proposal journal: source candidate

Scope: `database/proposals/playoff-prize-proposal-store-v2.sql` plus a static
source-contract test. **No SQL has been executed by this worker.** This is not
an installed migration, exposed grant, enabled writer or release. Lead owns
TypeScript/provider integration, shared status/memory, independent financial
review and any separately authorized disposable runtime acceptance.

Acceptance: own authenticated Director/Co-director, exact actor/operation/event/
tournament and raw request byte/hash binding; immutable operation, revision and
outcome audit; per-event version/head CAS; unchanged complete history prefix;
explicit reasoned adoption of changed full source with empty new history;
historical exact owned recovery without fresh-head/source dependence; contention
and unsupported isolation leave no operation or poisoned retry. All proposals
remain unapproved and cannot assign recipients, finalize awards or move money.

New tables: `playoff_prize_proposal_operations_v2`, `...revisions_v2`,
`...heads_v2`, `...outcomes_v2` in `app`. All have forced RLS and all application
role privileges revoked. The three history tables have immutable update/delete
triggers. Actor ID and server time are recorded in the immutable audit; revision
`createdAt` is a UTC ISO string with milliseconds. Raw request text and raw
reasons, including surrounding whitespace, are preserved exactly. Reason
validation matches JavaScript trim whitespace and the existing 2,000 UTF-16
unit limit, without normalization. Original JSON is checked before JSONB can
normalize negative zero into a receipt the strict JS decoder cannot read.
Recursive duplicate object keys are rejected on the original JSON before
JSONB can silently drop an earlier value (independent reviewer finding fixed).

Independent read/write/recovery flags all return false. Public wrappers, also
revoked from PUBLIC/anon/authenticated/service_role, are:

```text
get_playoff_prize_proposal_workspace_provider_v2(p_tid uuid,p_eid uuid)
save_playoff_prize_proposal_provider_v2(p_tid uuid,p_eid uuid,p_request_text text)
get_playoff_prize_proposal_operation_provider_v2(p_tid uuid,p_eid uuid,p_request_text text)
```

They call their private `app` equivalents in the same caller session, using
`auth.uid()` and current tournament-role locks. No service impersonation, JWT
GUC, existing writer/activation/accounting guard or native-reader flag changes.
The existing native getter supplies its unchanged complete source locks.

The agreed request has exactly `kind`, `operationId`, `expectedRevisionId`,
`nativeSourceDigest`, `input`, `overrideHistory`, `reason`, `mode`, `confirmed`.
`input` must exactly equal the fresh native getter's `capture.input` and its
actor-specific digest must match. Raw request maximum is 1 MB. Immutable owned
operation replies contain full `requestText`, SHA256(raw bytes), scope and the
original saved revision or recorded rejection. No thin ACK or pending-clear flag
is emitted. Unrecorded attempts have a distinct kind and exact request hash.

Every revision includes `sourceCapture`, the complete SERVER-read native source,
bound to that revision's actor and digest. Append/adopt/workspace staleness
compare its whole `.capture` and `.coverage` to the fresh source, including
binding/activation/context/intent actor IDs. Only top-level caller-specific
actor/hash are excluded from cross-Director source comparison. Thus co-directors
can share a proposal without silently adopting changed provenance. If native
source is null/blocked/retry, the official head remains readable and workspace
`stale` is true; that is not zero/absence proof.

Whole actual finishing groups derive from the saved V2 method/cutoff and real
qualifier count. Winner Takes All uses one place; requests beyond qualifiers
reject. Regular $1/$5/$10 applies independently of Q/Side. Zero is explicit;
records use global unique IDs and each group's latest prior. First void is
forbidden; corrections/void/reopen append. Prefix edits/truncation reject.

The approved range-only helper mirrors exact integer rational comparison weights
and `pg_catalog.div` positive nearest-increment rounding to check all CURRENT
adjusted groups and aggregate against MAX_SAFE_INTEGER, including untouched
source groups and void restoration. It derives only the selected event's actual
active regular receipts minus benefit/operating expense allocations from the
complete native input. It enforces the JS calculator's source fund resource
bound, active factor syntax/range, complete allocation conservation and supported
native buckets. It returns only a Boolean; no awards, rebalancing, fee inference,
method approval or payout authority is introduced. Exact SQL/JS parity remains
a required runtime gate, not established by static assertions.

Operation IDs are globally unique per actor ACROSS THIS STORE's events and
tournaments. A fresh UUID belongs to this operation domain. No existing journal
is written/aliased. Reciprocal exclusion against older operation namespaces is
explicitly not claimed; changing older guards requires separate coordinated
review. Exact save replay is checked before current source/head; independent
owned recovery still requires current official access and event membership.

Executed 2026-11-08, Windows/bundled Node 24, offline:

```text
node --conditions=react-server --experimental-strip-types --test tests/playoff-prize-proposal-store-v2-source.test.mjs tests/playoff-prize-proposals-v2.test.mjs tests/playoff-prize-proposals-v2-independent.test.mjs
exit 0: 27/27 (9 static store-contract guards plus 18 pure proposal tests).
```

These tests do not parse/compile/install SQL or prove locks, rollback, ACLs,
serialization, raw JSON helper behavior, numeric quotient parity or actual
persisted bytes. Required local runtime cases: first-save/exact replay/changed
bytes and actor/event/tournament conflicts; co-director append/CAS; full-provenance
drift and empty-history adoption; role revocation; recovery after changed source
and head; read/recover when write/native flags are off; source/op/head held locks;
rollback injection after each write; every method/step, irregular field, zero,
void/reopen, fractional factors and near-safe-integer SQL/JS parity; malformed
JSON and reason whitespace/UTF-16 boundaries; all table/function effective
denials. Independent reviewer must inspect source and actual evidence.

Supabase/Postgres skills were consulted. Current official function-security
guidance was checked at <https://supabase.com/docs/guides/database/functions>;
the changelog markdown endpoint returned unsupported content type. The explicit
delegation prohibited DB execution, so no query/advisor/install was attempted.
Previously denied audit/network/navigation actions were not retried or bypassed.

## Integrated lead acceptance, 2026-11-08

The lead subsequently executed the candidate only in an authorized disposable
fictional PostgreSQL database. Receipt:
`test-results/prize-proposal-store-local-v2-20261108/result.json`.
Passed and cleanup verified; container
`234e74bf08f9134da8cd2533219238d7e6b66e881cd2048a6d0c54406be2120c`.
The supported ordinary digital qualification producer completed 108 verified
matches / 432 identity-bound score actions for 18 fictional participants and
five qualifiers. This is not mixed-mode or real-provider acceptance.

Nine store acceptance groups passed: closed/default-off permissions; exact
request replay/recovery and server audit; zero/correction/void/reopen append-only
history; co-director append and revocation; held-lock exact retry without a
poisoned journal; injected post-outcome atomic rollback and retry; two concurrent
fresh writers with exactly one committed revision; expense/allocation drift
with stale rejection and explicit source adoption; unchanged execution guards.
The final synthetic scope has one head, ten revisions and twelve immutable
operation/outcome records. SQL/TypeScript range representability matched in
69 counterfactual cases without changing qualification or awarding money.

New authenticated DI handlers and default-disabled API routes use only the
ordinary cookie client, pre/post role checks, same-origin POST, bounded request
bodies and private no-store responses. Full source documents and raw operation
receipts are validated; an unknown operation never authorizes pending cleanup.
No normal Finance client save wiring, Supabase signed-in provider session,
full-reload browser storage, hosted installation or final-award approval was
proved. No grants are exposed; all three production flags remain false.

Policy reconciliation is in
[the narrowed decision note](../decisions/2026-11-08-prize-remainder-and-fee-open-questions.md).
Approved no-refund pool redistribution and regular V3 target/allocator principles
are retained; newer method/increment extensions are not silently authorized.

Final local checks: application 2,486/2,486; production build (including
TypeScript) exit 0; provider readiness exit 0 with existing disabled-provider
fallbacks; full lint zero errors / 199 warnings; workspace/handoff 14/14.
The store same-head requests were launched concurrently, but no overlap barrier
proves simultaneous lock occupancy; the held-lock contention test is separate.
Independent source/security and evidence review completed for SQL and protocol;
no broad runtime coverage beyond the enumerated receipt is claimed.
Registry audit remains unrun after prior automatic-review denial; it was not
retried. Thus this is not a claim that the aggregate pnpm verify command passed.

## Subsequent forced-overlap proof

The next authorized fictional run adds a deterministic uncommitted-writer port.
It observes the first actual save response plus that backend's exclusive event
advisory lock before sending the contender. The contender returns unjournaled
retry_exact/source_busy, including unknown recovery and zero operation rows.
After commit the first exact receipt recovers; the contender exact retry records
head_conflict. Exactly one revision commits across the two operations.

Receipt result.json now records passed=true, cleaned=true and
store.forcedOverlapVerified=true for owned container
`dba71b6a302ff15bb0d63823d5559a58d64e561cbf64729f202aebeb888696b1`.
Final scope: one head, eleven revisions, fourteen operations/outcomes. Earlier
successful runs were preserved under attempt-history before the next run.
The earlier no-forced-overlap caveat applies to that prior run only. No SQL
production candidate, hosted grant, real data or money was changed.
