# Native mixed funding/provenance - source-only checkpoint

## Authorized scope and acceptance

Parent authorized source-only resolution of the native-compatible simulated
funding gap, reviewed design/implementation and source/unit tests, all private
and disabled. No further mixed database fixture was authorized. No database,
SQL execution, hosted read/write, publication, role invitation, credential or
real payment was performed in this phase. Existing draft and historical results
were not accessed or changed.

The bounded design is `docs/decisions/2026-11-05-native-mixed-funding-journal-v1.md`.
Acceptance is an explicit native-intent-bound separate Main-entry simulation
journal, no legacy prize-declaration requirement, immutable provenance/recovery,
conservative quarantine before collection, false real-money/refund/attendance/
payout authority and a non-authorizing supplied-model observation contract.
This is not acceptance of live SQL or a complete native Finance rehearsal.

## Source implementation

- `native-mixed-funding-v1.sql`: seven private immutable journal tables and
  default-disabled scope/entry writers, source/binding/recovery helpers.
  Amount and eighteen identities come from current native admission captures.
  The writer declares one transactional chain for the operation, context,
  obligation, receipt, immutable row provenance and accepted outcome in new
  tables only; rollback and atomicity still require runtime proof.
  It does not insert ordinary payment, attendance, expense or payout records.
- Quarantine extends the existing ordinary native ledger mixed-domain helper
  to include admission intents and new funding scopes. Intent revisions stop
  once funding scope is pinned; the preserved pre-funding idle predicate still
  checks ordinary financial history for journal writes/reads. Conflicting old
  simulation/native financial domains are excluded. There is no legacy scope
  adoption or silent rewrite of stored captures.
- `native-mixed-admission-funding-source-v1.sql`: a separate private replacement
  of only the unexecuted admission candidate's financial source helper. It
  consumes complete new journal evidence, validates intent pins and current
  18-player mixed fixture/hash/game bindings, and retains existing Start and
  pre-scoring guards. Both feature gates remain false. No historical legacy
  financial reader/writer is replaced or used as fallback.
- `native-mixed-funding-observation-v1.ts`: exact complete DTO validation against
  retained identity/scope/fee pins; five pure test groups. Its private injected
  reader is Director-only, rechecks subject/roles and owns/compares two reads.
  No provider, API or page is wired. Matching reads are explicitly non-atomic.
  All provenance, native V2, paid-check-in, bank/payment/refund/payout/finalization
  authority is false. Plausible UUID/hash shape is deliberately not DB proof.

## Review findings and corrections

Independent Sol source review identified a missing invocation of the strong
scope/entry provenance validators in the source reader; both are now required
before availability, with complete context/operation/outcome/provenance counts
and exact current identity coverage. A cross-layer aggregate sourceDigest DTO
mismatch was corrected with mandatory 64-hex validation and regression cases.
Further review added conflicting-domain exclusions and UTC function settings
for timestamp-bearing capture/hash stability. Writes reject post-Start and
scoring history. None of these source changes is SQL runtime proof.

Final `pnpm verify` exited 0 on the frozen source: 2,023 application tests,
provider readiness tests 6, production build and workspace tests 8 pass. Audit
found no known vulnerabilities; lint has zero errors and 119 existing warnings.
Fourteen focused tests (six SQL static contract groups, three dispatch static
groups, five pure observation/role groups) and six handoff tests pass.
All nine pinned source/dependency hashes stayed unchanged after verification.
No new UI exists, so no browser acceptance is claimed.

Independent Sol source-only GO: no remaining P1/P2 within the disabled scope.
Final SHA-256:

- Funding SQL: `7edf9d032a3f2164aefb2ae3ea13ac3e709cfbcdf4e67f33adadd70a1a01037b`.
- Admission funding bridge: `d40661c3c47bea7de35085335210a576b35748fa17436ef4e47e7cf42ecfddc9`.
- Observer: `13dca9d7b1f6e81f25d899879c444dd73df6af9874062f24a3f2d2d31fe805b4`.

Evidence: `test-results/native-mixed-funding-final-verify.log`,
`native-mixed-funding-final-focused.log`, `native-mixed-funding-handoff.log`,
and `native-mixed-funding-source-inputs.json`. The final archive receipt is
`test-results/native-mixed-funding-checkpoint.json` after verified creation.

Proposal inventory: seven new private tables, fifteen new routines including
the preserved pre-funding idle clone; conservative replacements of the mixed
ledger exclusion, candidate admission idle/reservation helpers and candidate
admission financial source helper; UTC metadata on three candidate admission
capture/write functions. Forced RLS, immutable history and revoked API-role
ACLs remain proposed, not catalog-verified. No migrations are assigned/applied.

## Exact remaining gaps

1. **SQL/runtime verification pending**: no install/parse against PostgreSQL,
   catalog/FK/RLS/ACL inspection, positive persisted rows, bad-context injection,
   concurrency, exact replay/reconciliation, rollback or cross-session TimeZone
   test. `pglast` is unavailable locally; static source tests do not establish
   SQL syntax, PostgreSQL semantics or transaction correctness.
2. **Attendance implementation missing**: paid desk/QR check-in reads ordinary
   obligations/receipts, and event attendance identifies source only as desk or
   QR. This separate journal satisfies neither, so normal Start remains
   unreachable through it. Roster draw check-in is not event attendance. Do not
   fake a desk/QR record, waive fees or weaken Start guards as a workaround.
3. **Further funding sources missing**: this is all-eighteen initial base entry
   funding only. Optional Q/Side allocation/payment, sanctioning assessments,
   costs, benefits, income, corrections/waivers and native V2 ownership/source
   consumption need separate reviewed contracts. Unavailable is not zero.
   No refund method, new refund liability or actual transfer is introduced.
4. **Playoff/provider/human verification missing**: truthful mixed per-game
   playoff recipient evidence, authenticated UI/recovery and real independently
   accepted officials/sessions. Digital identity-bound two entries/two
   confirmations and nonself paper review remain unchanged.

Do not stage these candidates alone. Next implement/review a truthful test-only
attendance bridge and complete native simulation-source integration, keeping
them disabled. A separately authorized disposable database can then exercise a
coherent positive path, followed by provider/personally accepted-role and human
acceptance. No current database-fixture or publication approval is inferred.

The local source delta archive preserves the preceding verified archives. It
is not a database recovery point, full checkout backup or off-device copy.
