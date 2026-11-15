# Active ACC membership MRP projection, 2026-11-09

Status: isolated local candidate only. Not mounted in the application. No official award, reporting, registration, ranking, website lookup or hosted behavior changed.

## Established requirement

The owner said: "yes, we'll want  to be sure to omit someone from getting MRP's if they are not an ACC member" and then "an "Active" ACC member at that.  But the TD can override if it's found to be a mistake from the website reporting."

The active engineering checkout's `docs/decisions/2026-11-04-acc-member-refresh-assessment.md` already records that unknown membership needs verification, not automatic rejection; a verified TD website-error correction must retain its reason, evidence reference, actor, time and supersession history separately from the observed source. ACC number syntax alone is not membership proof. That newer document is not in this isolated worktree's ba2845a baseline.

## Narrow implementation

`src/lib/results/mrp-membership-eligibility.ts` is a deterministic projection over a trusted current server snapshot. It preserves performance calculations. Verified Active evidence permits the calculated MRP amount; confirmed inactive/nonmember evidence projects zero; missing, unknown, unavailable, malformed, foreign-scope or wrong-date evidence projects no award and requires review.

A current verified-active TD correction is bound to the original observation, tournament, event, roster identity and membership-effective date. It requires reason, evidence, actor, timestamp and an optional superseded correction ID. It only corrects a definitive inactive/nonmember website report. Failed or ambiguous lookups stay pending rather than inventing an exception; Active evidence needs no correction. Withdrawing a correction restores the underlying observation's eligibility result. The input records are never mutated.

The role string is a validated data contract, NOT authentication. Supersession metadata is not a validated history chain. No persistence or authorization guarantee is made by this helper. Only the actual server must select the current source/correction and authenticate the TD. The candidate does not expand correction authority to co-directors without an established permission decision.

## Deliberately unresolved integration

1. Establish the supported ACC lookup/verification source, identity-match contract, effective-date policy and freshness rules. No TTL or membership timing rule was invented here.
2. Build protected immutable observation/correction storage and current-head retrieval, with real TD authorization, evidence validation, append-only correction/withdrawal audit and concurrency/retry checks. Never trust browser-supplied role/status fields.
3. Enforce the decision in all official MRP award, settlement/finalization, results, CSV/export and PDF paths. Keep registration, standings, qualification and performance arithmetic unchanged. Satellite no-MRP handling stays separate.
4. Test those server paths, separate roles/sessions, corrected/revoked membership and stale export/finalization protection. Run the aggregate project gate after integration against the latest active checkout.

No official MRP readiness or production safety is claimed by these pure-function tests.
