# Director transport and operation recovery: source checkpoint

Date: 2026-11-05. Environment: local Windows workspace, Node 24.19.0,
pnpm 11.19.0. Scope: private/default-disabled source only.

## Verified behavior

Added exact four-action request/receipt/history codecs, authenticated injected
provider and bounded same-origin injected handlers. Default execution is off;
there is no route, Supabase construction, credential, live executor or grant.
Project URL/ref, actor, session, tournament/event, action and short expiry are
bound. Identity, current Director role and expiry are checked across async work.

Added a private, independently disabled SQL operation-history getter proposal.
It verifies exact ownership, request hash, receipt shapes and typed effect rows,
including persisted failed draws. Historical views deny current readiness. It
performs no writes or entropy and has no application execute grants. The SQL
has NOT been run or installed.

Added injected device controller with exact scoped/size-limited retained work,
CAS plus readback before dispatch, read-only uncertain recovery, account/session
isolation, late-response redaction, and atomic immutable archive plus closed
marker. No automatic redraw, mutation retry, expiry purge or sign-out purge.
Reopening a terminal failed draw cannot dispatch another operation. Malformed,
foreign or unavailable device work is kept. No actual browser storage is opened
by construction/import. No page/component/route was wired, so no rendered UI or
browser acceptance is claimed.

## Commands and outcomes

- Focused Node tests with `--conditions=react-server`: **28/28 pass** (15 protocol,
  provider and handler tests; 7 controller tests; 6 SQL source-contract tests).
- `pnpm test`: **2,081/2,081 pass**.
- `pnpm providers:check`: **pass**; existing disabled-provider/manual-fallback
  declarations remain unchanged.
- `pnpm build`: **pass**, production compile and route generation complete.
- Workspace plus private handoff checks: **14/14 pass** (8 workspace, 6 handoff).
- `pnpm exec tsc --noEmit`: **pass** on final source.
- `pnpm lint`: **0 errors**, 119 pre-existing warnings.
- `pnpm verify`: initially **exit 1 at dependency audit** due registry DNS/fetch
  failure; later stages did not run in that invocation. A separate authorized
  network-enabled `pnpm audit --prod --audit-level=high` passed with no known
  vulnerabilities. All remaining verify stages were executed individually and
  passed as listed above. Do not describe the original umbrella invocation as a
  successful run.

Logs use `test-results/native-mixed-director-transport-*`. Independent Sol
review reproduced 22 operation/provider/controller tests and 6 recovery tests;
source-only GO after fixing config parity, async lease expiry, malformed runtime
scope, extra accepted receipt fields and archive/reopen redraw affordance.

## Gates and limitations

Known pre-write rejection can retain pending data without an operation record.
This is intentionally fail-closed: an empty lookup cannot prove a delayed write
will never arrive. A durable proven-no-write/cancellation protocol is required
before enabling. A source-reviewed phase transition past the closed marker is
also absent. Neither the UI nor a caller may clear it to offer a new draw.

Fresh mixed database authorization is pending. No database/SQL/runtime fixture,
real provider/JWT/role acceptance, independent human session, rendered UI,
seating publication, Start, score, financial or physical movement acceptance was
performed. The broader 18-player rehearsal remains NO-GO pending those checks
and the existing Start/Finance/mixed-playoff integration. No hosted records,
saved draft, historical fixture, persistent access, invitations or funds were
read or changed. No production or test website was published.

Frozen publication source and prior checkpoints are preserved. The new archive
receipt is `test-results/native-mixed-director-transport-checkpoint.json` after
creation and byte verification; it is a local source delta, not database
recovery, a full checkout or off-device durability.
