# Local setup fee and prize-policy repair

## What caused the failed hosted rehearsal

Both approved fixtures have an immutable event setup at revision 2 with base
entry_fee_cents=0. Q+Side's setup Q and Side fees are also0. The saved revision
timestamps are2026-10-30 09:50:21.206532+00 (Q+Side) and09:57:43.958945+00
(no-Q). There is no earlier nonzero event-fee version. Therefore setup WAS saved;
the intended fee terms were not verified before activation. The later no-Q
seventeen $30 obligations/receipts are real synthetic records totaling$510, but
cannot replace the activated event's saved fee. All102 qualifying games and the
later synthetic qualification/playoff records remain preserved.

The published MoneyInput keeps typed text locally and commits the amount only
onBlur. A fresh isolated phone-browser reproduction of that published component
showed $30.00 in the focused input while Save remained disabled and the positive-fee
prize editor absent. After normal Tab/blur and Save, the submitted request and
read-back fixture both correctly contained 3000. This proves an input-commit risk;
it DOES NOT prove that the hosted API received3000 and stored0. Original request
bodies/interaction order are unavailable in the scoped project evidence. No
prohibited session directories were inspected. The exact historical mechanism
is unresolved between uncommitted/incorrect automation input and another setup
interaction; the failure to verify persisted terms is definite.

The API passes entryFeeCents through unchanged. Actual isolated SQL also proves
the existing public setup writer stores3000/1000/1000 correctly. No persistence
corruption was reproduced. Blank amounts previously converted to0, invalid text
silently reverted on blur, and value-based component keys risked remounts. These
are fixed without claiming they establish the precise historical sequence.

The missing schedule is the structured REGULAR PRIZE declaration and its event
binding, not the102-game schedule. Previously, declaration adoption was optional
at activation, and the editor was hidden for zero-fee events and Side Pools.
Zero-fee events are legitimate and remain supported. The no-Q declaration is now
locked after qualification; no retroactive policy, fee rewrite, legacy bypass,
replacement fixture, hosted migration or publication occurred during this repair.

## Repaired boundaries

- Valid USD inputs update the parent payload immediately. Blank/overprecision
  stays visible and invalid; local NaN fails the existing request validator and
  cannot be serialized as an accepted zero. Explicit0 remains a valid free fee.
  Inputs no longer remount for each numeric value; Q/Side removal and reload
  synchronize the correct remaining pool's draft.
- A successful metadata response is not enough. Exact saved revision/version,
  event identities, domain, base fee and pool slots/counts/names/fees are read back
  before clearing pending recovery. Name comparison mirrors the SQL's existing
  trim normalization; monetary values and identity comparisons remain exact.
- The original recovery request is immutable. An operation-bound accepted
  revision acknowledgement uses a separate owner-scoped recovery record.
  Malformed acknowledgement cannot hide the original. Verified cleanup checks
  for conflicts, removes/confirms acknowledgement first, then the request.
  Failures retain pending state. The recovery coordinator is unchanged.
- New paid single Standard Main12 setup supports separate zero to two Q Pools and zero to six Side Pools
  schedules. Missing/current-settings-invalid V3 declarations block initial
  activation on the SERVER and in the UI. Genuine fee-zero events and historical
  activation/replay/replacement remain compatible. The confirmation shows saved
  base and optional pool dollar amounts explicitly.
- Migration0268 extends the existing schedule workspace/writer and preserves
  collection/qualification/playoff closure. Existing legacy Side election
  writers acquire the tournament row before the role lock, matching current
  writers and preventing collection/declaration races. No tables, RPC signatures,
  direct human permissions, credentials or financial-disbursement behavior added.

## Verification and its limits

Published baseline probe: tests/setup-fee-persistence-browser.mjs --probe-current,
using git HEAD's component in a generated isolated fixture. Actual output is in
test-results/setup-fee-persistence-probe.log and the local probe.json.

Repaired component rehearsal passed 16 scenarios at 390 px and 1440 px: no-Q and combined
intended fee setup; genuine free entry; SQL-compatible name trimming; blank and
overprecision rejection; sequential decimal typing; Q/Side row deletion; saved
amount readback; missing declaration blocking; lost response and repeated exact
request across reload; mismatched readback recovery; concurrent newer-revision
blocking; corrupt acknowledgement preservation. Each recovered request has one
accepted mock revision. These UI tests use mocked HTTP services, not hosted Auth
or a real financial database. Localhost3262 cleanup was verified closed; no
personal browser or the preserved director test tab was used by this rehearsal.

Real SQL uses a separate network-disabled, no-port/no-mount task-owned container
and the actual public setup/declaration/activation/payment/election functions.
See 2026-10-30-setup-prize-side-sql-local.md for the eleven passing groups and exact
migration hash. Expanded exact 17-player no-Q and Q+Side receipts passed: seventeen
base receipts total $510 for no-Q; combined roster receipts total $680, allocated
$510 base and $170 Q, with a separate $170 Side fund, total $850. The correct
stored fees, V3 binding and selected graduated policies were checked before
collection, and both scenarios still have zero scoring records. No physical cards,
actual money, hosted replacement tournament, production action or hosted restore
is represented by local synthetic evidence.

Final integration gates: full pnpm verify passed 1,135 application tests, fresh
dependency audit, lint (warnings only), production build/type checks, provider
declarations and eight workspace checks. The local handoff checks passed as part
of the repository suite. Independent high-risk review found no remaining
confirmed P1/P2; its final targeted rerun passed 19 tests and checked the expanded
SQL/browser result artifacts and migration hash. Both the task-owned PostgreSQL
container/database and localhost server were removed/stopped, with absence
verified. Evidence: test-results/setup-repair-full-verify.log,
setup-prize-side-sql-result.json and setup-fee-persistence-browser/results.json.
Generated evidence is local and excluded from source uploads/publication.

Concurrent newer revisions and malformed recovery records deliberately fail
closed. Latest-only readback cannot automatically validate an older accepted
revision once another director has replaced it; the original request remains
available for review. This is not a claim of automatic conflict resolution or
permission to discard unknown local work.

The v7 link observed on the failed no-Q fixture is intentional compatibility
routing for an absent current declaration. Current bound V3 already routes v8;
regression tests protect this distinction. No forced redirect was added to hide
missing policy. Combined accounting navigation beyond that distinction remains
subject to its own supported source guards.

## Proposed test-only rollout and replacement scope

After all local gates and independent review pass: request exact migration 0268
application to staging nnhcnvksxgxnpvdqjgpg, reviewed branch publication to draft
PR122, exact-commit CI/READY Preview checks, and TWO NEW fictional 17-player
fixtures. Preserve both failed-setup fixtures and all historical awards/records.
No approval is inferred for any of these hosted actions yet.

Schema first, inspect existing definitions/ACLs and quiet writers, verify protected
history before/after, then publish compatible UI.0268 changes five existing
functions, no new tables/grants. An old UI encountering the new initial-activation
guard fails closed. Do not roll back by deleting history or reopening unsafe
missing-policy activation; a reviewed function rollback would require separate
authorization and preservation checks. Reverting app code does not erase new
declarations or permit bypassing server guards.

Replacement no-Q: independently read back base 3000 and five-qualifier V3
weights4/3/2/1 before activation and seventeen 3000-cent receipts. Combined: read back
base 3000/Q 1000/Side 1000, the same regular rule, and frozen disclosed graduated
1-in-6 Q/Side policies before election/payment. Exact planned totals are $510 and $850,
respectively. Generated scoring/qualification/playoffs proceed only after those
persisted preflight assertions. Expected separate pool funds are $170 each; awards
85/55/30 require unambiguous paid-card ranks. Expected regular $280 cash plus $229.50
expenses plus $0.50 restricted balance is a plan, not a saved result. No actual
disbursement, outside invitation, real payment, production change or credential
handling is authorized by this proposed scope.
