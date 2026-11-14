# Mixed rehearsal API slice — local verification

Scope: the explicit eighteen-player mixed rehearsal only. New codecs, shared
handler factories and four event-scoped Next route files expose capability,
own prescribed paper-opponent result/acknowledgment and official read/capture/
review. There is no enrollment API. Existing ordinary scoring, confirmation,
authentication and workspace routes were not changed by this slice.

## Acceptance and boundaries

- Disabled by default. Before constructing any client, require local opt-in,
  development/test runtime, absent/development Vercel environment and an exact
  loopback backend URL with an explicitly configured port. Hosted Supabase URLs,
  preview and production are rejected. No existing environment file was edited.
- A verified server subject determines the actor. The own-reader and own-ack use
  the authenticated cookie client, never the service client. Officials use the
  service client only after verified identity and actor/event capability checks.
- Exact bounded request shapes and receipt envelopes bind actor, tournament,
  event, game, phase, operation ID and the complete submitted body. Own-ack
  success is explicitly non-authoritative. Unknown or malformed responses fail
  closed with 503; no fallback to ordinary scoring is inferred.
- Source/lifecycle readiness flags describe new-write readiness but do not
  preempt the SQL protocol's exact retained-request replay. Native SQL remains
  the authority for replay and current roles/identity.
- Official reads combine existing paper/hybrid read models with separately
  labeled fictional artifacts. Other events and unenrolled games are removed;
  no hidden ordinary digital/digital submissions are exposed. Valid unrelated
  game-13 rows do not invalidate the target twelve-round projection.
- JSON reads use the existing 2,048-byte reader. Production responses use the
  existing private/no-store response and failure boundary. The factory injection
  seam is code-only; there is no runtime test-adapter or authentication endpoint.

## Executed checks

- `node --conditions=react-server --experimental-strip-types --test tests/synthetic-mixed-api.test.mjs`
  — **8 groups passed**. These execute the actual shared handlers and the
  transpiled Next route exports with controlled RPC fixtures. They cover the
  disabled/hosted gate before clients, verified actor, own/service separation,
  exact bodies, bounded inputs, all four official operations, malformed/native
  errors, known conflicts, scoped receipts and old-version replay after drift.
- Scoped ESLint over the seven new API/library/route files and three test/helper
  files — **passed**.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
  — **passed** in the shared workspace at this checkpoint.
- `node --conditions=react-server --experimental-strip-types tests/run-mixed-capability-local.mjs`
  — **6 isolated PostgreSQL groups passed**. This is a separate real-database
  read/model proof, not browser/provider-auth acceptance. Actual `service_role`
  executes the capability RPC; actual `authenticated` executes the own reader.
  Authenticated callers cannot execute capability or read the private registry.
  Wrong actor/unknown fixture returns null. Real official SQL read models pass
  the scoped codec. Capability reads append no audit rows, and later source
  drift is reported explicitly. **No scores were written.**

Database evidence: `test-results/mixed-capability-local.json`. The capability
proposal SHA-256 is
`8f120fe4e2bec6e326b8f092ae65d0d6fcd31cb15d6a7705b1450a59ccc237e3`.
The exact disposable container
`88e59aa6a71675be4b932dc34934ac8eb19dcd2cf971d6ba40aa5df212599d4b`
was removed and absence verified. The pinned PostgreSQL image used no network,
ports, mounts or hosted credentials. Synthetic historical setup is followed by
current native check-in/publication/start; it is not a new-tournament creation
acceptance test.

## Review and remaining verification

Independent Sol reviewer `/root/date_duration_review` inspected the eleven new
implementation/test files and capability proposal and reported no concrete P1/P2
in this API slice. UI findings are owned by the separate integration task and
are not represented as passing here.

The eight handler groups mock the RPC boundary; the six SQL groups test real
database reads separately. Their combination is **not** a claimed HTTP/browser
to real-database end-to-end result. The root task owns that integration proof and
the final full repository verification. Genuine Supabase-provider authentication,
physical users/cards, offline acceptance, preview publication, hosted enrollment
and financial acceptance remain outside this slice. No hosted record, migration,
deployment, role, credential or money operation occurred.

## Final integration follow-up

A later recovery review identified a P2 gap: the official review HTTP route had
no game ID to compare with a retained record's outer scope before dispatch.
The HTTP envelope now requires `gameId` alongside `request` and `idempotencyKey`.
Capture also binds its inner game ID; every official phase compares the envelope
game with the scoped artifact before any writer RPC. SQL requests are unchanged.
All four phases have a corrupted outer-game regression proving zero writer calls.

The repository audits now follow the actual shared production response factory
to `apiJson`/the existing failure boundary using TypeScript ASTs. They reject an
unsafe replacement or comment-only factory; no route comments were added to make
a regex pass. RPC declaration fallback is limited to two exact own-player calls
in the default-off local factory and the SHA-bound verified proposal. Ordinary
callers remain migration-only; local short argument names are audited too.

Targeted API/RPC/auth suites: **52 tests passed**, followed by scoped ESLint.
The isolated browser fixture's whitelist now includes only the four required
existing offline capability/replay/rejection RPCs, with actual `service_role`,
exact typed arguments, public-only P-256 JWK validation and actor binding. This
does not modify or replace the ordinary production queue/replay handlers.
Actual browser integration of that unchanged queue remains owned by the root
test task and is not inferred from these static/unit results.
