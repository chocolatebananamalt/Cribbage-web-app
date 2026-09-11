# Standard Singles setup activation evidence

Date: 2026-09-10
Commit inspected before the change: `98deb422feee601d65db4fafd96eb64dd3af3581`
Environment: Windows, Node `v24.19.0`, pnpm `11.19.0`, Next.js `16.3.4`

## Observable acceptance criteria

- A verified current director or co-director can activate the latest immutable
  setup revision when it contains exactly one `standard_singles` event.
- One transaction creates exactly one sourced scoring-core ruleset, one
  operational event with draft publication state, one setup provenance record,
  one accepted operation receipt, and one audit record, then opens and renames
  the tournament from the approved setup.
- The server generates the activation, ruleset, and event IDs. Exact retry
  returns the original response without a duplicate row.
- The response and persisted rows state the narrow boundary: no rounds,
  participants, seating, finance, results, payout, qualification, or ACC
  submission side effect.
- The HTTP route is private-by-default, same-origin, verified-session bound,
  and uses only the server secret boundary. Browser roles cannot directly call
  the database activation function.

## Observable rejection criteria

- Reject a missing/stale revision, a revision that is no longer latest, a setup
  containing zero/multiple events, a non-Standard-Singles event, stale setup
  officials, an already activated/operational tournament, or a caller without
  a current director/co-director role.
- Changed reuse of an operation ID records an immutable conflict and cannot
  create a second event or operation receipt.
- A disabled feature returns the private not-found response; malformed input,
  cross-origin mutation, missing verified session, transport failure, and a
  malformed database response all fail closed.

## Checks and results

| Check | Result | Evidence |
| --- | --- | --- |
| Focused ESLint plus Node contract tests | PASS | `pnpm exec eslint src/lib/api/setup-activation.ts 'src/app/api/v1/tournaments/[id]/setup/activation/route.ts' tests/setup-activation.test.mjs`; `node --conditions=react-server --experimental-strip-types --test tests/setup-activation.test.mjs`; 6/6 passed |
| Rollback-only database integration fixture | PASS | The corrected 0108 function and `tests/standard-singles-setup-activation.sql` executed in one self-contained `BEGIN`/`ROLLBACK` transaction on the isolated synthetic Supabase validation project. Assertions covered acceptance, replay, changed-key conflict, unsupported format, outsider role, a replaced primary director with a stale snapshot, exact row counts, grants, and no rounds/participants/seating. |
| Database advisors | PASS | Three activation composite foreign-key index-order gaps were added and the advisor rerun reports no unindexed activation, paper-card, or independent-correction foreign key. Private deny-all tables remain intentionally RLS-enabled without browser policies. |
| Full repository verification | PASS | `pnpm verify`: production audit found no known vulnerability; lint passed; 214/214 application tests passed; production build passed and listed the dynamic activation route; workspace safety tests passed. |
| Private handoff verification | PASS | `pnpm verify:handoff`; 6/6 passed. |
| Patch whitespace check | PASS | `git diff --check`; no errors (only Git line-ending notices). |

The first focused test attempt found that Node's strip-types runner could not
resolve an extensionless local import. The import was made explicit as
`./validation.ts`; the focused and full gates above then passed.

## Data and release impact

- No shared-pilot migration was applied, no deployment was made, and no feature
  switch was enabled.
- Validation migrations retain the reviewed function/index definitions in the
  isolated synthetic schema. The self-contained fixture rolled back its three
  fresh accounts and tournament rows. An earlier pre-fix fixture set remains
  isolated to this disposable validation project and is not pilot or production
  data.
- No player, score, payment, private handoff, or ACC submission data was used.

## Remaining release evidence and external blockers

- Migration 0108 was independently reviewed and applied in order with 0106–0110
  to the shared pilot. The route remains disabled.
- A deliberate owner release decision is required before setting
  `ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED=enabled` in a deployment.
- Real protected-route proof remains required on the intended backend with an
  authorized director/co-director session, an independent unauthorized
  session, and retained receipt/audit inspection. The default-off route was not
  browser-tested because enabling or deploying it was explicitly out of scope.
- This slice intentionally cannot create rotation/seating, payout,
  qualification, eligibility, finance, or ACC-submission behavior. Those need
  their own dated authoritative rules/fixtures or owner/ACC decisions.
