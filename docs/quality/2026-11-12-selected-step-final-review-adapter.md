# Modern current-fund collector and review adapter — local, disabled

Implemented `database/proposals/selected-step-final-review-v3.sql`. This is an actual versioned collector/review journal, not an alias for legacy Finance. It consumes the prior current V3 ownership/whole-receipt ledger and current modern prize policy source.

## Added contracts

- Service-only primary-Director access with explicit live actor/session binding, nondeleted/nonbanned user, current session ownership/expiry and locked role rechecks. No JWT/session impersonation, public grants or route activation.
- Versioned current prize workspace, proposal save and exact recovery functions use the genuine existing proposal journal. They preserve append-only manual adjustment history, source adoption, head locks, exact requests, validation and original outcomes. Existing functions/records are untouched. No ownership ID is inserted into a native allocation or legacy Finance FK.
- Versioned read-only series/current-result and sporting sources use the current V3 playoff gate. Exact-count installer seams fail on incompatible prerequisites. Original result/source captures, parent pins, current generation checks, actual independent player submissions/confirmations and verified-game validation remain intact. Existing verified chart/large-field gates remain; no new placement, game writer or result is invented.
- The modern final-review collector composes the actual current saved prize proposal, ownership ledger, completed sporting evidence and current separate Q/Side award proof. Qualification, binding, gate digest, ownership and fund partitions must agree. It does not invoke `operational_event_finance_source_v1`, require a legacy Finance proposal/basis or fabricate one.
- Genuine sanctioning snapshot and current classified expense evidence provide coverage exactly once. The assessment is not subtracted again. New ungated reciprocal insert protection covers V3 reviews, both older native review domains and legacy settlement finals, serialized on the tournament row; existing history is unchanged.
- Immutable V3 fund-review operations/revisions/outcomes reference actual modern prize and ownership revisions, retain session/actor/reason/audit, require explicit `reviewed_zero` additional-income confirmation, enforce source/version pins and exact retries, and roll back with an uncaught audit failure. The current getter recomputes the full source and requires exact saved capture and journal/outcome agreement.

## Supported boundary and remaining implementation

This bounded adapter supports **explicitly reviewed zero additional income only**. All existing income roots/records, including voided history and older domains, hold for their actual lineage adapter. Absence of a journal is not treated as confirmed completeness: an explicit persisted Director review is required. Regular/Q/Side funds remain separate. No disbursement or finalization authority is granted.

The real series reader requires compatible modern V3 gate/start/generation captures. Existing legacy-gate generations are intentionally rejected rather than rehashed or relabeled. This candidate adds no compatible Start/generation authoring: that is a remaining source-integration dependency, not merely a test to waive. Mixed/paper playoff sporting contracts are not substituted for this digital confirmed-series reader.

The existing durable modern award writer still has a foreign key to `native_recorded_fund_reviews_v1`. It cannot consume a V3 review ID. A genuine versioned award transaction/schema adapter remains necessary; do not insert a synthetic legacy review, alias IDs, remove old guards or call the full finalization flow operational. Positive-income and first-round fee-reference integration must retain existing holds until their actual contracts are adapted. No new payout/tie/discounted-fee policy was chosen.

## Focused evidence

`node --conditions=react-server --experimental-strip-types --test tests/selected-step-final-review-v3.test.mjs`: **6/6 passed**. Tests verify every clone seam against actual original sources and the verified large-field patch, deployed installer/spec parity, retained sporting/confirmation proof, proposal history/concurrency/recovery, real collector dependencies, closed access and reciprocal fee protection. Changed-file ESLint exits **0**. No application TypeScript changed in this slice; no broad suite/build/audit/rehearsal run.

Independent sensitive review identified the reciprocal expense reuse gap; the fix was re-reviewed and no material finding remains in source. SQL syntax/install/transaction/role/concurrency/provider acceptance is **not executed or claimed**. No DB/container created, no cleanup obligation incurred, no hosted action/public upload/actual award/payment/submission/denied retry or frozen216 modification.

Smallest next proof: once the compatible modern Start/generation source and genuine V3 award-writer FK path exist, one isolated fictional local acceptance can install exact prerequisites, save a current modern prize proposal, independently review zero-income/fee coverage, read current fund, reject drift/outsider/session mismatch, execute the actual new award transaction and force a late rollback. Until then, replacing missing upstream functions with synthetic success would not prove the requested joint acceptance.
