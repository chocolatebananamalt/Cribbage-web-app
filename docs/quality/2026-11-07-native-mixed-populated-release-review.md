# Reduced rehearsal candidate: populated compatibility and Director bridge

2026-11-07. LOCAL PASS / RELEASE HOLD. No hosted actions or real money.

The frozen run is `test-results/native-mixed-pilot-reduced3-20261107/`.
It passed28 named checks; every proof source hash was checked before and after
each phase. It installed51 proposals after the numbered0292 baseline, then the
existing confinement and new revoked Director lease candidates. The only
whole-file cut is `native-optional-income-fund-v3.sql`: the scoring rehearsal
never uses its income-aware Finance writers. Earlier V2 optional domain tables,
locks, collision guards and fail-closed unsupported-income behavior remain.
Independent review found no safe second whole-file cut. Do not remove the other
Finance dependencies or replace their guards with empty-result stubs.

## Populated-record evidence

Before proposal installation, a synthetic saved legacy draft was prepared through
the existing linked setup writer: Main, Equal and Graduated Q-Pools, director,
profiles, prior revision, receipt and link history.45 pre-existing fictional rows
were present in17 populated baseline tables. The snapshot covers254 total existing tables: app/public base tables and
Auth users/sessions; empty tables are included. The253-object permission baseline
also includes views, so its count differs from the row-snapshot count. Existing columns are recorded explicitly so newly added columns
are not mistaken for a destructive rewrite.

After installation, all existing-column row sets match exactly. A fresh legacy
linked save and exact retry also pass inside a rolled-back transaction. An
operation accepted BEFORE installation replays byte-for-JSON identically twice
AFTER installation with unchanged receipt/audit counts, inside ROLLBACK. After
the rehearsal, all45 old rows remain as a multiset, with no missing/changed old
row. See compatibility-*.json and compatibility-old-operation-replay.json.

This proves one populated saved-draft compatibility slice, NOT every legacy
writer, all financial histories, finalized events or actual staging data.
The first attempted full historical seed failed the baseline prize-declaration
activation requirement, rolled back and was removed. We corrected the fixture
to a valid saved draft; no production guard was disabled to seed it.

## Director request path

New `get_native_mixed_pilot_director_session_v1(tid,eid,action)` is revoked and
ungranted. It derives the own authenticated subject/session, requires current
Director role and the existing project/event/actor scope, permits one exact
action, and expires at min(JWT expiry, cohort expiry, five minutes). It never
creates accounts, roles, consent for another player, ordinary attendance or money.

The disabled server handler obtains that lease with the own client, validates
it through the existing strict handler, then constructs the privileged executor.
Actor/session/role and the database scope are rechecked at use. The production
seam is unmounted and passes no enable override; default false rejects before
constructing either client. No environment toggle enables it.

Independent review found mutable factory-wide authorization state could misbind
concurrent requests. Each method now creates its own request state. A regression
holds the first privileged construction while a second event completes and
proves both dispatcher calls retain their own event IDs.

Actual SQL-claims integration passed for source GET through lease -> handler ->
provider -> executor -> guarded SQL. Plan, Draw, Review and Publication exact
retries passed through the same request path; plan/draw/review/publication,
receipt and audit counts remain unchanged. This proves safe replay/transport,
NOT fresh human operation authoring or an enabled Director screen.

## Permissions and scope

Baseline781functions/253tables; candidate1163functions/371tables. That is382new
functions and118new tables, versus387functions in the earlier candidate. Exact
literal revokes close ALL new functions by default. No existing function ACL or
table ACL/security metadata changed. New tables have no direct anon,
authenticated or service_role table privileges.

Correction to earlier concern: the three native_ledger_allocation tables ENABLE
RLS and revoke direct application-role privileges. Absence of FORCE RLS is NOT a
confirmed exposure. We did not change owner/definer semantics merely for
uniformity. Future privilege/provider review must still check column grants,
policies, owner behavior and actual PostgREST schema discovery.

Wrong project/event/actor/session/issuer/expiry and unsupported actions are
rejected. All seven own scoring wrappers were exercised for wrong issuer and
expiry. Non-READ-COMMITTED snapshots fail closed; shared scoped readers can
coexist while owner scope changes use the exclusive lock. Dedicated concurrent
scope-update/revocation acceptance remains to run. Expiry blocks owned historical
recovery too: retain pending bytes and use an authorized cohort renewal, never
remove an uncertain entry just to proceed.

Directed post-confinement Paper/Digital and Paper/Paper, own-player submission
and confirmation, independent nonself review and after-commit response-loss
recovery pass with no resend. This is not a full108-match scoped run and does not
establish real signed JWT, browser, IndexedDB or physical movement acceptance.

## Minimum path to a real rehearsal

1. Finish a reviewed operator/Director preparation screen for the owner-approved
   test cohort, authoritative source pins and existing plan/review controls.
   Current bootstrap (native settings, simulated funding and attendance seal) is
   a local harness, not a finished user-facing workflow. The request bridge is
   now implemented; the page and fresh operation authoring remain outstanding.
2. Freeze the exact code/schema/grant manifest and test remaining populated
   histories and the full scoped108-game/role/revocation path. The remaining
   dependency footprint is broad; object-level extraction needs separate design
   and proof before claiming a smaller install.
3. Only when that packet is ready, verify current staging target/environment and
   obtain a CURRENT private recovery export with isolated restore/security/
   sequence checks and a current preservation baseline. The historical
   pre-0290 archive is not a current rollback point. No backup prompt was opened.
4. Obtain separate exact staging installation/grant/code and ONE test-cohort
   approval, including account identities, own consents, official assignments,
   expiry/renewal and explicitly simulated records. Existing saved user draft
   is not enrolled or changed. Current native private funding fixture is Main
   $30/no optional pools, not the user's $50 setup or real payments.
5. Verify signed Auth/PostgREST and independent supported browser sessions.
   The local fixture uses fabricated SQL claims and SDK adapters, not signed
   tokens. Prior browser/audit denials were not retried or bypassed. Eight
   fictional subjects (six players/two nonplaying officials) are tested; the
   desired six-human playing-official arrangement needs explicit acceptance,
   not a claim that eight humans are required.

The full18-person human rehearsal remains NO-GO. No grants, hosted records,
invitations, credentials, deployment, real payments or official ACC reporting
are authorized or performed by this checkpoint.

## Verification and cleanup

2321 application tests pass.21 focused Director/RPC tests include the concurrent
request regression. TypeScript, focused lint and production build pass.
Dependency audit was not retried. Exact frozen fixture
10f895a66547b83d62a5abe81e33205ddddcf100dda0b2e592a6842444539f1c was removed
and cleanup verified. Reduced2's27 checks also passed/cleaned; the initial invalid
seed fixture was removed. Independent metadata verification covers13 owned
containers, all absent. No hosted user record was read or altered.
