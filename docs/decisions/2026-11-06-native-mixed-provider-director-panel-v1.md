# Disabled Director provider and panel integration

Status: source-only; no route, live executor, grant, migration or feature enablement.
The pending disposable mixed-database approval did not arrive during this phase.

## Narrow result

The existing injected provider/handler boundary now supports cancellation,
historical cancellation recovery and fresh next-phase observation. Each is a
separate capability: older leases cannot call it accidentally. They reuse the
verified subject/session/current Director checks, exact project/actor/event
target and expiry checks before and after executor access. All executor data
and error results are snapshotted before awaited post-call authentication.
Only exact typed outcomes are accepted. Reads do not retry writes, and missing
history never proves no committed operation. Handlers use bounded, same-origin
POST bodies with route-operation binding; the two read methods remain read-only
despite using a POST body for the exact original request. No route calls them.

The new client-only Director panel directly drives the existing injected
controller. It imports no fetch/RPC client and generates no operation IDs.
Default flags hide controls without opening storage. A verified client host
must explicitly provide the controller, current scope/session, prepared request
and historical display materials. These props are not server authorization.

The panel offers one prepared plan/phase action, read-only Check for pending
work, an explicit reasoned cancellation, or Close for a resolved step. Unknown
operations have no retry/redraw shortcut. Closed accepted history carries only
a display hint for the next action; actual advancement still requires the
controller's fresh source proof and exact CAS/save/readback before dispatch.
Failed/canceled records are terminal. No Start, scoring or money controls were
added.

## Review and privacy

The existing one-table movement preview is reused. Review/publication requires
the exact own historical plan→draw→review chain, matching IDs/digests and a
structurally verified 18-seat movement model. The three review acknowledgments
and publication confirmation bind the complete displayed materials and prepared
request; they reset logically when either changes. Cancellation reason and
acknowledgment bind the exact pending request. No physical attendance or room
certification is claimed.

Host props are bounded JSON snapshots; cyclic, malformed, oversized or foreign
materials fail closed. Context is validated before mounting a scoped panel.
On account/session/role change the keyed instance unmounts, invalidates old
callbacks and deactivates its controller without clearing retained work. A new
instance displays neutral loading state until its own activation completes,
even when the host identity callback is late. Historical controller state is
not read during that first render.

## Acceptance and next gate

Source and isolated browser checks prove presentation/controller behavior only.
The full 18-player rehearsal is still not ready. A separately authorized local
database must prove installation, ACL, locks, rollback, cancellation races and
phase transitions. A later server adapter must verify its actual configured test
project, construct narrowly authorized leases and call the private routines
through a reviewed permission boundary. No such adapter, public RPC, route or
grant was added speculatively here. Real independent provider sessions and UI
acceptance must follow, before any separately approved hosted rollout.

Canceled non-draw restart and cross-Director handoff remain unsupported.
Rehearsal Start, mixed scoring/Finance/playoff integration and human room review
remain separate gates. Existing setup, saved drafts and test records were not
read or modified.

## Later bounded runtime evidence — 2026-11-06

Daron explicitly approved one fresh local mixed fixture; parent clarified fixture-only NOLOGIN roles and grants were allowed. That one fixture is now consumed, removed and cleanup verified. All111 pinned SQL files installed. Native registered-roster admission, simulated funding, own-account consent, nonself fictional paper review, plan/draw and historical recovery passed. Independent108-pair/12-opponent graph and24 zero ordinary-state table checks passed. Revocation blocks readiness. This is local role/GUC testing, not real provider/browser acceptance or grant authorization for hosted systems.

Automatic review denied the command containing local native publication before execution. It was not retried; bounded permitted draw/recovery continued. No publication/Start/scoring/financial completion is established. Keep the feature disabled. The scoring admission dependency on ordinary checked-in/Start and legacy reviewed-publication evidence remains unresolved; do not manufacture these. See ../quality/2026-11-06-approved-native-mixed-bounded-runtime.md for exact evidence and harness corrections.
