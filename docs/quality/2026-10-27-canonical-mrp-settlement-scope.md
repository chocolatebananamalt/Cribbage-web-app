# Canonical MRP and v3 settlement — bounded scope assessment

Implementation update after expanded approval: the reviewed versioned subsystem is now implemented locally and exercised in isolated SQL/concurrency fixtures. See `2026-10-27-versioned-settlement-v5-local.md` for current code, exact evidence and remaining registration/build/browser gates. The design-only stopping point below is historical; no shared rollout or publication followed.

Status: independently reviewed design only. No new production code, public RPC, registered migration or hosted write. The current compatibility checkpoint is retained. The requested complete bridge exceeds a bounded patch because its storage model, financial claim model and operation history all assume legacy playoff placements.

## Concrete structural findings

* `0139_standard_singles_playoff_placements.sql`: `app.standard_singles_settlement_playoff_bindings.playoff_result_version_id` is a required composite foreign key to immutable `app.standard_singles_playoff_result_versions`. A v3 outcome ID cannot satisfy it.
* `0145_manual_settlement_finalization.sql`: final versions also require a composite legacy playoff foreign key, alongside exact settlement, qualification and ledger snapshots. Supplying a v3 UUID would fail integrity; fabricating a legacy projection would create false unique finishing places and dual write domains.
* `0133_standard_singles_settlement_draft.sql`: payout placement rows enforce `unique(settlement_draft_id,placement)`. This is incompatible with using a shared 3–4 elimination band as a financial order. The v2 writer also validates those claims against the legacy placement result.
* `0190_automatic_standard_singles_mrp_results.sql`: current v4 checks automatic MRP equality and calls v3 with a derived operation ID. V3 calls v2 with another derived operation ID and then adds MRP claims/binding receipts. Old v1–v3 service entry points remain authorized; changing only v4 is bypassable.
* Finalization v1 requires complete claims and the legacy binding. Replacing only the automatic calculator cannot safely make a v3 outcome finalizable, and changing the foreign key alone would not validate old entry points.

These are implementation constraints, not missing credentials or an external approval denial. The unchanged published deployment is not affected by this local assessment.

## Smallest coherent versioned design

### 1. Private canonical evidence function

One ungranted server-only function accepts an exact tagged result reference and verifies tournament, event and qualification bindings. Return either source-versioned canonical rows or a structured blocker:

```json
{"kind":"legacy_placement_v2","resultId":"uuid","qualificationResultVersionId":"uuid"}
```

or

```json
{"kind":"playoff_outcome_v3","resultId":"uuid","qualificationResultVersionId":"uuid"}
```

Available rows contain participant ID, qualifying MRP, played wins, separately evidenced byes, playoff MRP, total MRP, elimination cohort and source versions. No caller-supplied MRP total is authoritative. For exact v3 series, derive the complete topology. For legacy complete power-of-two/no-bye brackets, validate membership, one champion, round bounds and exact loser cohorts before deriving champion depth credit. Preserve all raw historical rows and receipt payloads. Legacy bye/ambiguous/incomplete evidence returns `mrp_evidence_correction_required`; do not assign byes from aggregate counts or silently manufacture an actual round.

The function alone would be research/foundation evidence, not a repair. It must be adopted atomically by automatic display, claim persistence and finalization before claiming the invariant is enforced.

### 2. Tagged settlement storage and explicit financial claims

Use a new versioned settlement binding/draft/finalization family rather than weakening old foreign keys or backfilling fictitious legacy results. Each new binding has a tagged exactly-one legacy-or-v3 reference with composite scope/qualification foreign keys. Retain old draft/final rows unchanged and readable. Define event-level current-version selection and supersession explicitly across old/new histories; old writers cannot append into an event already using the new settlement domain.

Financial claims are separate from ACC finishing cohorts: participant ID, amount in cents and an explicitly supplied optional prize-order/description field. No automatic ranking of semifinal losers, no inference from qualifying rank, and no automatic payout policy. Zero-value/no-order claims must not require invented third/fourth distinctions. Existing legacy claims retain their original meaning. Existing Q Pool membership, eligibility and rounding gaps remain outside this bridge.

New draft writes compute/store canonical MRP rows server-side, snapshot actual active receipt/expense counts and totals, retain explicit director financial claims, and preserve deficits as blockers for final reconciliation. A new finalization version binds the exact new draft, result source, qualification, ledger snapshots and canonical MRP evidence; existing attestations, disputes, closure, roles and audit requirements remain. No actual money movement is introduced.

This requires new draft/workspace/reconciliation and finalization/workspace/reconciliation contracts, exact codecs, recovery envelopes and UI. It is not a safe call-through to the legacy v2 settlement writer.

### 3. Shared enforcement and structured receipts

The canonical invariant must run at the common persistence/finalization boundary so direct old service calls cannot bypass it. Preserve safe legacy grants and exact accepted receipt replay. Do not retroactively mutate or invalidate historical receipt contents. Recheck current actor authorization before returning a receipt, then reconcile actor/operation/hash/scope before new semantic validation.

For a new opposite-domain request, take actor/operation then shared event locks, produce a structured `playoff_write_domain_conflict` rejection receipt/audit, and retain its exact replay. Map the database guard's backstop exception through each relevant old/new writer's controlled rejection path. A changed request using the same key produces its existing conflict behavior; it never replaces an accepted receipt. The event-scoped trigger remains a storage backstop, not the complete caller contract.

Only the particular unverifiable MRP claim/attestation is blocked. Legitimate non-MRP accounting work needs an explicit pending-evidence state; financial finalization cannot falsely attest complete MRPs. This state must be designed in the new draft contract rather than globally freezing settlement or accepting fabricated values.

## Required proof before implementation can be called complete

| Boundary | Required cases |
| --- | --- |
| Canonical evidence | Main/Consolation supported game counts; champion, runner and same-round losers; power-of-two cohorts; typed bye evidence; missing/contradictory evidence; immutable old records |
| Legacy compatibility | Safe legacy placement and non-MRP draft work continues; exact old receipts survive; unsupported format does not silently lose its writer; v1–v4 direct calls cannot attest bad claims |
| Versioned binding | Exactly one result kind, exact scope/qualification/version, no fabricated projection, stale result and correction handling |
| Financial claims | Optional financial order separate from cohort, no inferred semifinal order, explicit zero amounts, actual ledger snapshots and deficit refusal |
| Operations | Interrupted/repeated saves, accepted/rejected replay, changed-key conflict, revoked-role denial, old/new concurrent writes, correction/finalization races |
| Security | No widened role/execute/table grants, owner/search path/RLS checks, caller-independent trigger enforcement, exact audit/receipt conservation |
| User workflow | Browser API/data persistence at phone/desktop, truthful blockers, no unsent-entry loss or duplicate counting |

## Independent review and stopping point

Sol review independently confirmed the legacy-only foreign keys, unique placement constraint, nested receipt chain and old-v3 claim bypass. It classified a complete bridge as a new versioned post-event subsystem. The safe bounded stopping point is therefore this concrete tagged-result/financial-claim design and the already restored compatibility patch, rather than adding further incomplete public APIs or a partial validator that old clients can bypass.

No new owner policy decision is required to preserve existing functionality or compute source-backed MRPs. If actual financial prize-order/tie payouts are later requested, they must be explicit reviewed claims or an approved policy; the implementation must not invent them. The next engineering increment should implement the tagged storage and rollback fixtures as one reviewed unit, then wire the shared validator and all write/finalization paths atomically. Registration, application, publication and hosted testing remain separately controlled.

No test run this checkpoint establishes new runtime behavior: only source/design inspection occurred. Latest actual application evidence remains 819 tests, 818 passed and one strict unregistered-v3-RPC failure. The previous SQL/concurrency evidence applies only to the withdrawn blanket-revocation design, not this unimplemented bridge. Build EPERM and browser localhost timeout remain reproducible prior blockers; no permission workaround was attempted.
