# Versioned ACC-weighted, balanced Q policy

Local implementation proposal. The owner adopted the observed ACC weighted raw
formula with the app's exact largest-remainder five-dollar rounding. This is an
application-owned rounding modification, not an ACC endorsement or a claim that
the public calculator itself balances its independently rounded awards. No
publication, hosted migration, actual payout or refund is authorized here.

## Persistence and compatibility

The existing private immutable `app.q_operating_policies_v2` table gains one
explicit method/schedule ID: `acc-weighted-largest-remainder-5usd-v1`. Only its
two checked method/configuration constraints are extended. No table, column,
legacy row, chart cell, receipt, reviewed award or historical final is rewritten.
Existing pool-version uniqueness, RLS, actor audit, frozen disclosure and exact
policy-UUID consent remain authoritative.

The old v2 writer and reconciliation signatures, request hashes and accepted
methods remain unchanged. New service-only `save_q_operating_policy_v3` and
`get_q_operating_reconciliation_v3` RPCs accept only the new graduated method.
There are no new human grants, credentials or direct service table permissions.

The existing calculator function OID becomes a private dispatcher. Inputs with
only old/equal methods call a verbatim preserved clone. Mixed inputs use the new
calculator while retaining the old other-pool branches unchanged. Operating and
Q-review manifest metadata changes only when the new method is present; old
source hashes/currentness must remain identical in regression checks.

Existing immutable v2 unpaid reviews and canonical v6 accounting consume the
same source-bound obligation JSON. No second liability stream or paid state is
introduced. A policy is selected before consent/payment and cannot be switched
inside an already-funded pool. Historical table policies remain historical table
policies, including their exact chart provenance.

## Exact amounts and recipient separation

Private `app.calculate_acc_weighted_pool_v1(input JSONB)` returns the same full
result contract as `calculateAccWeightedPool` in `acc-weighted-pool.ts`, including
exact reduced rational strings, branch, awards, fund and version. Its supported
application domain is fees 1000/2000/5000 cents, ratios 4/6, and 1–256 fully paid
entrants in that named pool. Zero entrants and unsupported fees/counts block.

The raw ACC branches are computed with integers. Every award is floored to
500-cent units. Remaining units go by descending exact fractional remainder;
equal remainders prefer the higher finishing place. One recipient receives the
whole pot explicitly, avoiding division by zero in the fee-floor expression.
No floating-point arithmetic or independent award rounding is used in SQL.

Existing funding/acknowledgment checks determine contributions. Existing Q card
ranking determines recipients, including paid nonqualifiers below the playoff
cutoff where needed. Numerical Q cash ties remain blocked, even if an old cut or
a qualification-only resolution exists. The remainder tie convention is an
amount-rounding rule, not a sporting tie decision. Equal Q and regular playoff
prizes remain separate policies with their existing equal-cohort behavior.

## RPC contract

`save_q_operating_policy_v3(p_actor_id,p_tournament_id,p_request,p_operation_id)`
accepts exactly:

```json
{
  "action": "publish",
  "poolVersionId": "<actual configured pool UUID>",
  "method": "acc-weighted-largest-remainder-5usd-v1",
  "ratio": 6,
  "scheduleId": "acc-weighted-largest-remainder-5usd-v1",
  "disclosureReference": "<reviewed posted method, including app rounding>",
  "disclosed": true
}
```

Ratio may be 4 or 6 and must match the immutable pool setup. Existing director
authority, tournament/qualification locks, no prior policy, no prior consent or
collection, and not-started checks apply. A supported fee is server-derived.
Success remains `{status:"q_policy_published",policyId,poolVersionId}`; controlled
rejections remain `{status:"rejected",code}` and receive operation/audit records.

`get_q_operating_reconciliation_v3(p_actor_id,p_tournament_id,p_operation_id,p_request)`
hashes the entire retained request and returns `{authorized:true,result}` where
result is null, the original receipt, or an idempotency conflict. Current role
and backend service context are checked before replay/reconciliation. Unknown
outcomes are never treated as acceptance or automatically resubmitted.

`get_q_operating_workspace_v2` retains its existing JSON envelope. New strict v3
API/UI readers recognize the new method; old v2 parsers remain fail-closed.
Retained v2 requests must continue through their original routes and identities.

## Verification requirements

`tests/acc-weighted-q-sql-acceptance.mjs` provides 1,536 SQL/BigInt amount parity
cases, 320 unchanged chart goldens, mixed equal/new pool conservation, rank-down,
ties, funding/consent negatives and actual policy retry/reconciliation checks.
Root's supported 17-player fixture supplies real setup/payment/scoring,
qualification, unpaid review and canonical accounting evidence. Actual SQL,
race, browser and independent-review outcomes must be recorded separately;
authoring these tests is not a passing execution claim.
