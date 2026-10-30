# Base-only canonical unpaid accounting v7

Local implementation proposal, not applied to any hosted database. The owner
authorized completing the no-Q Main path locally. No formula, payout execution,
human access, credentials or production setting changes are involved.

## Why a separate immutable domain

V5 history has legacy/v3-only source columns, foreign keys and table checks;
its payback reader rejects byes. V6 deliberately requires a real immutable Q
review. V7 does not rewrite those histories or weaken the required v6 binding.
It records base-only Main accounting without making a fictitious Q pool/review.

Two private forced-RLS tables, `app.no_q_accounting_drafts_v7` and
`app.no_q_accounting_finals_v7`, retain immutable requests, facts, source
manifests, actor/operation audit and exact hashes. Finals are once-only and
explicitly unpaid. Direct table access is revoked from all human roles and the
service role; four narrowly scoped service-only RPCs use current primary-director
authority. There are no payment/refund writers.

## Supported facts and conservation

One Standard Main, twelve real qualifying games per participant, a current
canonical v3 four-qualifier or v4 five-qualifier playoff result, and the exact
saved matching director-selected regular prize schedule are required. No Q or
Side Pool setup/review records may exist. The existing pre-Q full base receipt
verifier remains unchanged. Current USD receipts, classified USD expenses,
the sanctioning assessment, canonical MRP, current qualification/playoff source
and schedule version enter the server-computed manifest.

The reused expense validation independently verifies base-entry 85% participant
return and cash conservation. `facts.qIncomeMinor` is the mathematical constant
zero for compatible display; no Q review column or Q review row exists.
Amounts/recipients are never supplied by the director's accounting request.

Because the first supported base-only Main consumes the tournament's full
receipt ledger, V7 rejects prior accounting streams in that tournament and
blocks new legacy/v5/v6 streams after its own history. This prevents an inactive
second event from consuming the same cash. Existing accepted exact requests
still reach their original receipt before the new domain gate. This does not
revoke safe legacy grants or reinterpret legacy records.

## JSON contract

Four RPCs: `get_no_q_accounting_workspace_v7(actor,tid,eid)`,
`save_no_q_accounting_draft_v7(actor,tid,eid,request,op)`,
`finalize_no_q_accounting_v7(actor,tid,eid,request,op)`, and
`reconcile_no_q_accounting_v7(actor,tid,eid,op,request,action)`.
Public argument names follow existing conventions: `p_actor_id`,
`p_tournament_id`, `p_event_id`, `p_request`, `p_operation_id`, `p_action`.

Draft request has exactly `expectedVersion`, `sourceDigest`,
`scheduleVersionId`, `reason`, `expenseClassifications`, `reviewed:true`.
Final request has exactly `draftId`, `draftVersion`, `expectedVersion`,
`reason`, `reviewed:true`.
`draftVersion` must be a JSON number containing a whole integer from 1 through
256; a numeric string is rejected. Exact prior receipt lookup still precedes
new-request validation, and reconciliation hashes the entire original request.

Workspace matches the v6 envelope **without `qReview`**: tournament/event IDs,
source digest, blockers, current draft/final versions, regular schedule, facts,
draft, finalization and `automaticPayment:false`. Draft/final history shapes
match v6; finals expose `status:"unpaid"`.

Accepted statuses are `no_q_accounting_draft_saved_v7` and
`no_q_accounting_finalized_unpaid_v7`. Rejections are the established structured
`{status:"rejected",eventId,code}` envelope. Reconciliation hashes the full
action/request and checks current authority; unknown receipts never imply success.

New saves share actor/operation, qualification, post-event, settlement and domain
locks plus tournament/role/event row locks. Stale source or version blocks;
same-source repeated operations cannot add a second active liability. After
finalization new playoff outcomes are blocked, while exact historical retry is
preserved. Later corrections can make the immutable accounting stale; they do
not rewrite it, reopen automatically or create another final.

Existing tournament members may see only current reviewed regular award display
fields, clearly labelled unpaid. Funding/expense facts and private source
manifests remain director-only. No audience or human database grants are added.

## Verification status

The initial backend and local acceptance module are authored. Real SQL execution,
concurrency, complete UI/browser integration and fresh independent review remain
required before readiness. `tests/no-q-accounting-v7-sql-acceptance.mjs` consumes
a genuine supported no-Q 17-player fixture; it must not fabricate qualification,
canonical scores or Q history. No execution is claimed by this document.
