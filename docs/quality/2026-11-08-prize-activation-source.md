# Local snapshot-bound prize activation source

Scope: implement registration finalization for explicitly adopted V2 Main and
Consolation prize plans, with native Satellite metadata preserved. No prize
calculation, financial finalization or playoff execution is enabled. Mixed
legacy/V2 drafts remain saveable but cannot use this new finalization branch.

Changed source: `database/proposals/event-prize-activation-source-v1.sql`,
`src/lib/api/event-prize-activation-v1.ts`, and the series-only resolver in
`src/lib/playoffs/event-playoff-parameters-v1.ts`. Added focused tests and the
exported port-based `tests/event-prize-activation-local-acceptance.mjs`.

The immutable outer request binds the complete existing V4 activation request,
exact prize snapshot/digest and confirmed context. A deferred foreign key ties
the new pin row to the existing immutable preparation journal. Preparation,
operational activation and recovery reuse the existing journals. Current roles,
setup/settings/prize sources and exact outer bytes are checked in SQL; owned
recovery does not depend on the current head. The ordinary authenticated subject
prepares and recovers; the finalizer retains the existing service-role boundary.
No JWT/GUC impersonation is introduced by the production source.

The existing legacy proof and writer are preserved. Guarded unique install
anchors create the latest branch and dispatch actual series-only assessment at
preparation, context trigger, operational proof and binding trigger. No neutral
legacy payout is created. New operational rows bind through their existing
immutable intent actor/operation/tournament identity; no columns are added to
those rows, preserving historical `to_jsonb(binding)` source fingerprints.

The prize snapshot's settings digest is checked against the actual nested save
reservation hash. The separate V4 activation digest retains its original domain.
All Main/Con rows need explicit V2 plans and configured series; Satellite has no
new series/prize binding or calculation. The existing native core still owns
ruleset activation, association materialization and registration opening.

New V2 bindings block the common newer operational Finance source before it can
interpret dormant V1 payout fields. Existing accounting backstops remain. The
pre-playoff source explicitly returns `new_prize_playoff_integration_required`.
The result is registration-only, not a completed playable tournament.

Executed source checks:

- Node `--conditions=react-server --experimental-strip-types --test` across the
  new activation suite and eight relevant prize/playoff suites: 80 passed.
- TypeScript `tsc --noEmit --incremental false`: exit 0.
- Scoped ESLint for the four TS/test files: exit 0.
- Static tests exercise each install-time SQL replacement against current
  unfrozen prerequisite sources and require exactly one matching anchor.

These checks do not parse/install PostgreSQL or prove real locks, deferred FK
behavior, rollback, native activation, provider identity or browser recovery.
The exported acceptance function creates no container, enables no flag and
grants no access. It accepts caller-owned SQL/authenticated/service-call ports
for the separately approved disposable runtime. SQL and runtime acceptance are
pending lead execution/review at this source checkpoint. Phone/desktop browser,
actual signed-in provider, full integrated verification and independent review
remain required. The previously denied dependency audit was not retried.

No root SetupClient, provider composition, fixture launcher, frozen release
package, hosted system, grant, deployment or payment was modified by this slice.
The lead owns integrated status/memory updates and runtime evidence.
