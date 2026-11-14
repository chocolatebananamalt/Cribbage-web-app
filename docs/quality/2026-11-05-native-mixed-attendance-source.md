# Native mixed rehearsal readiness - source-only checkpoint

## Scope and outcome

The parent authorized local source-only test-attendance implementation/review,
with no new database fixture, ordinary payment rows, hosted access or
publication. No SQL was installed/executed; no provider session, tournament,
role, invitation, credential, payment or historical result was read/changed.

Implemented the bounded **pre-draw rehearsal-readiness source**, not ordinary
attendance or an end-to-end Start bridge. See
`docs/decisions/2026-11-05-native-mixed-attendance-v1.md` for acceptance and
ordering. The source binds current native intent/funding/identities before
future seating or schedule IDs exist. It provides six identity-bound versioned
Digital participation decisions and twelve explicitly fictional Paper entries,
current Director preparation, distinct current cross-checker review, immutable
readiness seal and operation/recovery evidence. A Digital player may be the
cross-checker for the unlinked fictional subjects; no new blanket exclusion is
invented. Revocation remains appendable after seal/future Start and invalidates
current readiness without deleting history; regrant after seal requires a new
trial. No game confirmation or human-presence claim is substituted.

## Files and permission distinction

- `database/proposals/native-mixed-attendance-v1.sql`: eight private immutable
  tables, 27 private routines, forced-RLS/revoked API-role ACL declarations,
  default-false gate, exact subject/source/role/version and operation/outcome/
  lineage/hash checks. Two reciprocal collision triggers affect only prior
  unexecuted admission/funding operation tables. It writes no ordinary roster
  check-in, QR/desk, participant status, window, draw, seating, schedule, Start,
  score, payment or payout record.
- `database/proposals/native-mixed-attendance-consent-transport-v1.sql`:
  **separate unexecuted opt-in permission proposal**, excluded from any current
  release/migration manifest. The proposed public wrapper takes no actor ID,
  derives `auth.uid()` under authenticated claims and delegates to the private
  core. It proposes authenticated EXECUTE only on that wrapper and no private
  table/function grant. Its separate gate is also false. This file does not
  represent approval to install/enable that grant in any hosted system.
- `src/lib/seating/native-mixed-attendance-observation-v1.ts`: exact supplied
  sealed-DTO checks against retained actor/seal/scope/18 identities, latest six
  consent heads and current official roles. Director-only injected reader
  denies before loading, rechecks actor/access and compares owned double reads.
  No provider/API/page is wired. It shape-checks hashes and cannot establish
  DB/JWT ownership or actual human independence. All such authority flags,
  ordinary attendance/payment, draw/Start and money/payout authority stay false.

## Review and executed evidence

Independent Sol source-only GO, no remaining P1/P2 within this disabled scope.
Review corrected the initial future-schedule ordering cycle, blanket Digital
reviewer exclusion, missing exact consent-to-roster reconstruction, wrong
attendance-window table name and transport reachability. The separate opt-in
wrapper is a reviewable permission contract, not a live permission change.

`pnpm verify` exited 0: **2,035 application tests**, provider tests 6,
production build, workspace tests 8, no known audit vulnerabilities. Lint has
zero errors and 119 existing warnings. Focused tests **12/12** (seven static
SQL/transport groups plus five pure model/reader groups), handoff **6/6** pass.
Final eight source/dependency pins match the saved input receipt. No browser
acceptance is claimed because no UI was changed or connected.

Final core SQL SHA-256:
`6e6b1b28532ca3e57a90ce593bf11789d41c513d236167b2cd9f900f5bb63302`.
Separate consent-transport proposal SHA-256:
`ac3ab36d711cfe9f7533ee1095aa756f5fd36ea38d69dd8ae35cf340b576b1ba`.

Evidence: `test-results/native-mixed-attendance-final-verify.log`,
`native-mixed-attendance-final-focused.log`, `native-mixed-attendance-handoff.log`
and `native-mixed-attendance-source-inputs.json`. Local archive receipt:
`test-results/native-mixed-attendance-checkpoint.json` after verified creation.

## Exact unresolved gates

1. **Runtime unverified:** PostgreSQL syntax/install, actual FK/forced-RLS/ACL,
   authenticated/service/anonymous identity rejection, accepted operation and
   source-row readback, version chains, CAS and operation collision races,
   full rollback/replay/reconciliation, UTC/cross-session behavior, post-seal
   revocation and source invalidation. Static text checks are not any of these.
   No new fixture is authorized by this phase.
2. **Consent access/UI missing:** the separate proposed grant needs explicit
   hosted-change approval and real provider/session testing. The player-facing
   purpose statement, own-current-decision loading and lost-response recovery
   screen are not implemented by the SQL wrapper. No Director proxy is allowed.
3. **Actual draw/status/schedule/Start integration missing:** native draw reads
   ordinary roster `checked_in`; schedule reads event participant `checked_in`;
   current attendance/Start demands ordinary closed QR/desk attendance, and
   admission seal demands an `official` Start. This source changes none of
   those. A separately reviewed simulation-aware projection and explicit
   rehearsal Start/provenance must resolve them without false human-presence
   claims. Do not insert ordinary rows or use `reinstate` as a shortcut.
4. **Downstream current consent enforcement missing:** before any future test
   action, generated scoring/admission/Start writers must consume current
   revocation state. This journal does not retrofit those existing consumers.
   History remains intact; no continuing consent is inferred from an old seal.
5. **Full mixed Finance still missing:** optional Q/Side simulated funding,
   classified costs/assessments/income, native V2 mixed ownership/source and
   per-game playoff recipient/final-award integration. No refund or actual
   money movement is introduced.

Next source work is the simulation-aware roster/event-status and publication
bridge, followed by explicit test-rehearsal Start and current-consent consumers.
Keep disabled until a coherent positive path can receive separately approved
isolated runtime proof, then provider/personally accepted-role and human tests.
Publication remains HOLD. The local source delta is not a database recovery
backup, complete checkout or off-device copy; prior checkpoints are preserved.
