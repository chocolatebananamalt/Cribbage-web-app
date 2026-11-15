# Native mixed draw and schedule publication - source-only checkpoint

## Authorized work and outcome

Parent authorized private, disabled, local source-only integration of rehearsal
readiness with roster/status projection, random draw and schedule. No new mixed
database fixture, SQL execution, grant, hosted access or publication was
authorized. None occurred. No ordinary attendance, payment, role, invitation,
credential or historical tournament/device record was accessed or changed.

The implemented source path is current sealed 6-Digital/12-fictional-Paper
readiness -> explicit `sim_ready` projection -> immutable plan -> one committed
draw attempt -> explicit review -> dedicated native simulation publication and
private source reader. It does not mark anyone ordinarily checked in. Actual
PostgreSQL behavior has not been exercised; this is not a published feature or
end-to-end Start/score/Finance acceptance.

Design and exact approval gates:
`docs/decisions/2026-11-05-native-mixed-simulation-publication-v1.md`.

## Implementation inventory

- `database/proposals/native-mixed-simulation-publication-v1.sql`: eight new
  private immutable tables, 25 private routines, forced-RLS/revoked API-role
  ACL declarations and default-false gate. Three reciprocal collision triggers
  affect prior private admission/funding/attendance operation tables. A proposed
  schedule source-method CHECK extension adds only
  `native_mixed_simulation_v1`; two mandatory deferred native publication guards
  require the complete sidecar/context proof. No public wrapper/grant is added.
- New-write eligibility rechecks current roles, latest consent/readiness,
  funding/native setup, closed registration, active Standard-12 Main, all 18
  registered identities and absence of ordinary check-in/status/score/Start
  evidence. The ordinary writers and checked-in predicates are unchanged.
  Sampler/config/A18 candidate validators are reused without a fake checked-in
  snapshot. Stationary and explicit verified pair constraints are preserved.
- Plan, draw, review and publication have actor/op/request/outcome recovery.
  Stable readiness captures omit the transient reader actor; each operation
  still checks its actual current Director separately. Accepted owned replay is
  historical with `currentSourceVerified:false`, not new-write permission.
- One committed draw attempt includes bounded no-candidate and caught sampler
  errors; these cannot be resampled by changing operation IDs. Transaction
  cancellation/crash before commit is explicitly not a guarantee of exactly-once
  physical entropy. No candidate is a proof of infeasibility.
- The publication writer declares one transaction for native operational
  receipts/audits, one initial publication, eighteen immutable fixed assignments,
  twelve rounds, 108 canonical games/links, a truthfully tagged schedule and
  mandatory simulation sidecars. IDs are server-allocated and the postcondition
  independently maps every native fixed assignment and import-row game tuple
  to the retained draw. Atomicity/deferred-trigger behavior is still unproved.
- `native-mixed-seating-plan-v1.ts`: non-authorizing supplied-model preparation
  and injected local sampling, explicit `sim_ready`, exact one-table A18 layout,
  retained draw/fixed-ID readonly handling and observed mutation rejection.
- `native-mixed-published-schedule-v1.ts`: private supplied-model recognition of
  the new source method, exact retained plan/draw/review/publication pins and
  eighteen assignments/108 supplied game UUID mappings. It keeps publication a
  **claim**, DB proof and write/Start authority false. Valid borrowed UUIDs cannot
  be detected by DTO shape. No normal DTO, API, provider or page is broadened.

## Review and verification

Independent Sol source-only GO for frozen SQL and both private adapters; no
remaining source P1/P2 in this disabled scope. Review corrected cross-domain
actor/op reservation, independent retained-draw-to-native-row proof, terminal
caught RNG failure retention and the transient reader-actor capture dependency.
The final source-method/private DTO contracts align.

Final `pnpm verify` exited 0: **2,053 application tests**, provider declaration
tests 6, production build and workspace tests 8 pass. Audit found no known
vulnerabilities. Lint has zero errors and 119 existing warnings. Focused checks
**18/18** (seven SQL static groups, six planner and five publication-model
groups), handoff **6/6**, local TypeScript and focused lint checks pass. Sixteen
final source/dependency pins match after verification. No browser verification
is claimed because no UI/route was implemented.

The planner unit tests inspect 24 deterministic samples with 108 distinct pairs
and twelve distinct opponents per identity, first-position fixed IDs and anchor
stability. They also prove no RNG call for stale/revoked/readonly supplied data,
bounded local failure and mutation detection. These are in-memory models, not
actual random draws, SQL fixtures, live consent, crypto-fairness or room proof.

Final SQL SHA-256:
`4b918e4b35391f30699f56daf42edd58b7b8e0467ed6c7a23e0339944402ec01`.
Static-test SHA-256:
`f046be2f674be37bdc94ce623b56168e23810d68a8693bebb27dafa776433de3`.
Evidence: `test-results/native-mixed-publication-final-verify.log`,
`native-mixed-publication-final-focused.log`, `native-mixed-publication-handoff.log`
and `native-mixed-publication-source-inputs.json`. Archive receipt after verified
creation: `test-results/native-mixed-publication-checkpoint.json`.

## Exact remaining runtime and approval gates

1. No SQL syntax/install/catalog/FK/forced-RLS/ACL or actual table/trigger proof;
   no real persisted native publication, actual entropy invocation, same/different
   request concurrency, deferred commit, corruption/orphan rejection, rollback,
   replay, prewarmed reader, role loss or UTC cross-session test. A separately
   authorized disposable local database is required, with actual row readback,
   independent expected graph and verified removal. No fixture is inferred here.
2. No actual provider/HTTP/UI wiring. Ordinary schedule DTOs still reject the
   new method by design; the private adapter has no live route. Actual signed-in
   subject consent and personally accepted-role sessions remain untested. The
   previous opt-in consent-RPC permission proposal is untouched and still needs
   separate approval before any hosted grant. All new publication functions
   remain private; no new grant is proposed in this file. A narrowly scoped
   Director transport/execute entrypoint is still absent and needs source review
   and separate permission approval before a real provider can call this path.
   That transport must bind the verified test project, named tournament/event,
   allowed actual actors and expiry; a TEST ONLY name alone is not deployment
   authorization. Owner-only local SQL testing would not prove that access path.
3. Existing ordinary Start/admission still require checked-in participants,
   closed ordinary attendance and an `official` Start. This source changes none
   of those. Next is an explicit rehearsal Start/current-consent/scoring bridge,
   preserving historical events and no physical-presence claim. No offline
   mixed-play, playoff-recipient or full native Finance acceptance follows.
4. Hosted schema/feature enablement and permanent A-1..A-18 seating plus the
   108-game schedule in a named test fixture need separate explicit approval,
   verified staging target, fresh recoverable backup through isolated restore,
   frozen grants/dependencies and authorized preservation baselines. No real
   money, production, new identities/roles/invitations or official ACC reporting.
   Website rollback alone does not undo DB schema or permanent publication rows.
5. Room/furniture/anchor walkthrough and actual human acceptance remain required;
   one logical A18 geometry is not general multi-table/multi-anchor certification.

Publication remains HOLD. The verified archive is a local source delta, not a
database recovery point, complete checkout backup or off-device copy. All prior
archives remain unchanged.
