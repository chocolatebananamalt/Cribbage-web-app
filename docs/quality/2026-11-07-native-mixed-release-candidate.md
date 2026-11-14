# Reduced mixed-rehearsal release candidate - local verification

2026-11-07. HOLD: not a staging release authorization or ready manifest.
No hosted installation, credentials, access grants, data writes or publication.

## Proven scope

The reduced ordered proposal list is
`test-results/native-mixed-release-probe-20261107/proposal-order.json`.
It has 52 whole-file proposals, installed after migrations 0237-0292 on the
verified empty post-0236 synthetic baseline. This matches staging's numbered
schema endpoint (0292), not its actual data, Auth configuration or permissions.
The first probe passed setup V3, fictional attendance/funding and own consent,
random draw/review, private schedule save, simulated Start, actual SQL-backed
Paper/player contract and uncertain-commit recovery. Fixture 96a8c568... removed.
This is a tested dependency reduction, not evidence every included function is
safe to expose or that existing populated staging records are unchanged.

## Confinement candidate

`database/proposals/native-mixed-pilot-confinement-v1.sql` starts unconfigured:
no deployment marker, no cohort, no grants. Marker and immutable scope versions
bind fixed staging project nnhcnvksxgxnpvdqjgpg, tournament/event, explicit actor
allow-list, test protocol, write permission and expiry. Owner-only scope writes
use expected version, exact operation retry and advisory serialization. The
24-hour maximum is a technical pilot limit, not an ACC rule.

Seven new own-session public RPCs wrap revoked originals. Authenticated requests
must have the staging JWT issuer and current valid own Auth subject/session.
A separate revoked server-only Director dispatcher requires the staging service
JWT ref, current Director role, a valid actor-bound session and cohort scope.
Its action list has no account, invitation, consent-for-another-player, ordinary
attendance, funding, disbursement or role-creation operation.

The deployment marker is owner attestation, not discovery of physical hosting.
PostgREST must validate JWT signatures. Local injected SQL claims cannot prove
actual provider authentication, schema discovery/cache or real signed sessions.

The private Director adapter pins the project and event, checks current own
identity/session expiry and Director role before/after, and uses the one guarded
server dispatcher. Transport failure produces an unknown outcome, never a
fabricated receipt or automatic resend. It is not wired to an enabled route.
Six focused adapter tests, TypeScript, production build and focused lint pass. 2315 application tests, 15 final focused tests, provider-readiness and 14 workspace/handoff checks pass. Dependency audit was not retried. All runtime enablement remains
private/default-off. No server secret was read or created.

## Expiry and recovery

Disabling writes while the cohort is unexpired preserves own reads. Expiry or
actor removal blocks reads too, including historical operation recovery. Pending
bytes must remain untouched. An owner-approved new scope version restoring that
same actor/event allows recovery; never solve this by discarding pending data,
redrawing, transferring a nonce or impersonating the player. Later pilot
operations need an explicit bounded renewal/recovery procedure.

## Remaining release gates

- Review/reduce release breadth: the 52-proposal dependency slice plus confinement introduces 387 functions and 118 tables. Runtime-generated literal revokes close all NEW functions; no pre-existing function/table ACL or table security metadata changed versus numbered0292. All new tables have no direct anon/authenticated/service_role table privileges. Three native_ledger_allocation tables lack forced RLS and need explicit security review. Column grants, policies, function-body compatibility and populated-data preservation are not established by this ACL comparison.
- Prove preservation and legacy writer compatibility using populated fictional
  baseline records, then freeze exact SQL/code/grant hashes and independent review.
- Complete actual Director preparation/consent UI path. Current bootstrap is a
  local synthetic harness; the adapter's successful source read is not proof of
  all Director action routes or a no-admin human preparation flow.
- Full 108-game post-confinement lifecycle and concurrent exclusive scope-update/revocation tests. Directed post-confinement DP/PP plus own player writes and committed-response-loss recovery PASS; shared concurrent readers and REPEATABLE READ rejection PASS. Do not generalize these to every mutation/role race.
- Authorized signed Auth/PostgREST acceptance and supported independent browser
  sessions. Prior localhost browser access denial is not retried or bypassed.

No publication approval should be requested until those implementation and local
verification gates are closed. Only then obtain a CURRENT private staging export,
isolated restore with security/ownership/sequence checks and current preservation
baseline; historical pre-0290 backup is insufficient. Future distinct approval
must name exact staging SQL/grants/code and one TEST ONLY cohort, accounts/own
consents and official assignments. No production, real funds or MRP reporting.

## Current fixture evidence

The first confinement fixture 82675385... failed SQL quoting during installation;
transaction rolled back and fixture removed/absence verified. Second ed6a18cc...
installed corrected confinement SQL but the test's SET claims expression used an
invalid cast before any scope assertion. Removed/absence verified. These are
failed checks, not passed confinement or uncertain hosted writes. Final corrected
scope fixture results are recorded separately in the run evidence directory.

## Final exact-source local result

Scope7 passed 23 confinement/ACL/integration checks. Installed confinement SHA256
`e1f3058936d5c186229756fba1cb5527ea4f13f75c0fea0d06fa37196bbff72e`.
The exact source rejects non-READ-COMMITTED snapshots and uses shared scope locks;
owner scope revisions take the matching exclusive lock. Wrong issuer was tested
through all seven real authenticated wrappers; expiry through all seven; current
own binding and concrete Director SQL source through the adapter succeeded.
Post-confinement Paper/Digital and Paper/Paper capture/review, own player submit/
confirmation and uncertain-after-commit reload/recovery passed with no resend.
This directed random schedule sample produced six immutable entries/receipts/
audits and two artifacts; it was NOT another full108-game lifecycle.

Numbered baseline:781functions,253tables. Candidate:1168functions,371tables.
No existing function ACL changes; no existing table ACL/security metadata changes.
387 new function permissions closed by frozen literal revoke SQL.118 new tables
have no direct application-role table privileges. No staging or user record was
read, altered or claimed preserved through a hosted rollout.

Evidence: `test-results/native-mixed-pilot-scope7-20261107/` contains installed
source hash, ordered install hashes, scope assertions, diagnostics, exact function
and table comparisons, generated revoke SQL and post-confinement provider log.
Scope7 CID3e91572229a5c384ffa740ed9da0476db385eb106e22437356f3b093e0988878
removed with cleanup verified. Baseline2 CIDed972efe6423e0ba2811bfcb1cb4fc3de8754d98f73595251c8901cbfa4a8a26
removed/verified. Scope6 passed20checks before the final isolation guard and was
removed; its result is not substituted for the exact-source Scope7 proof.

Failed earlier fixtures remain recorded:Scope3 decoded SQL boolean f as JSON;
Scope4/5 omitted existing transport/Start gates from the harness. No product
permission check was weakened. All owned fixtures were removed. Independent
source review identified the stale-snapshot issue; the final source and runtime
reject it. Actual signed JWT/PostgREST/schema-cache and browser acceptance remain
unavailable and are NOT replaced by these injected-claims tests.

HOLD. No staging installation/grant/deployment approval is requested yet. Next
local work is populated legacy compatibility and a genuinely isolated release
manifest/Director preparation flow, followed by supported signed acceptance.

Superseded local candidate: see 2026-11-07-native-mixed-populated-release-review.md for the51-proposal populated compatibility/Director bridge checkpoint and corrected RLS wording. No hosted change.
