# Cancellation and next-phase guards: source verification

Environment: local Windows, Node 24.19.0, pnpm 11.19.0, 2026-11-05.
Scope: source-only changes; no SQL execution or database fixture.

Acceptance: a missing operation is not proof of no write; a cancellation has
durable exact recovery, blocks delayed/replacement draws, and cannot erase a
committed result. Phase advancement must use fresh current readiness plus bound
accepted history, preserve the closed record atomically until next pending is
saved, and fail closed on stale/foreign/expired/competing inputs. Default paths
must remain unavailable with no grants, real transport or page wiring.

## Files

- New cancellation SQL proposal: one private immutable table, one unique
  canceled-draw index, seven private functions and six guards (four reciprocal
  operation insert guards plus update/delete and truncate protection).
- New transition SQL proposal: two private functions, including a disabled
  read-only current-source observation; no writes or random sampler calls.
- New TS cancellation and transition codecs; modified injected device controller.
- Three new test files for cancellation source/contracts, phase observations and
  controller cancellation recovery. Prior test files remain intact.

All proposals remain outside executable migrations. Existing publication,
funding, attendance and recovery SQL files were not changed. No production
component, route, role grant or provider executor is enabled.

## Checks

- Final focused selection: **46/46 pass** across operation/provider, prior
  recovery, controller, transition and cancellation tests.
- Final TypeScript `--noEmit`: **pass**.
- Final full `pnpm verify`: **exit 0**, 2,099/2,099 application tests,
  production dependency audit (no known vulnerabilities), provider declarations,
  production build, workspace 8/8 and private handoff 6/6 passed. Lint has
  zero errors and 119 existing warnings. The run used registry access for its
  read-only audit; no hosted app/database access was performed. An earlier full
  run also passed; the final run followed the last cancellation hardening.
- Independent Sol review: source-only GO for transition, cancellation SQL/codec
  and updated controller. Reviewer independently reproduced 13 then 18 controller
  tests and seven cancellation tests. Both source findings were fixed: arbitrary
  draw tombstones cannot freeze an event; tombstone recovery actively rejects
  contradictory committed-operation reservations.

Logs: `test-results/native-mixed-recovery-transition-*`.

No SQL parser/install/runtime, real PostgreSQL locks/concurrent sessions, actual
provider/JWT/role access or rendered browser acceptance was exercised. Static SQL
assertions and in-memory ports are not substitutes for those checks.

## Required disposable runtime scope (authorization pending)

Verify install/default-off/ACL and guard enforcement; both write-versus-cancel
race orders; exact replay and lost cancel response; actor/op reuse across four
domains; malformed/foreign plan rejection; no terminal draw replacement even
when feature flag later turns off; consent revocation with historical recovery;
no contradictory committed row forwarded as no-write proof; rollback and
no ordinary attendance/Start/financial effects. Verify phase concurrency and
stale-source rejection with independent sessions, then resource cleanup.

Actual provider transport, cross-Director handoff, canceled non-draw restart,
native rehearsal Start/scoring and complete Finance/playoff closure remain
unsupported. The 18-player human trial is not declared ready.

This checkpoint is a local source delta only, not a database recovery point,
complete checkout, uploaded artifact or off-device copy. Prior archives and
frozen dependencies must be byte-verified before its receipt is written.
