# Shared Pilot Database Change Control

**Status:** required procedure; no shared-pilot change is authorized by this
document.

## Purpose

The shared Supabase pilot is not a disposable development database. A partial
schema update could cause an otherwise healthy hosted build to interpret data
incorrectly, expose an unfinished operation, or make a valid pilot workflow
unavailable. This procedure makes a pilot update deliberate, reversible where
possible, and evidence-led.

## Current baseline

On 2026-09-10 the shared pilot ended at migration
`0089_foreign_key_coverage`. Source migrations `0090` through `0103` are not
yet pilot-approved. The separate synthetic validation project has been used
for later migration evidence. The application recognizes the missing `0103`
assigned-game response field and fails closed rather than displaying a partial
score-entry form.

## Required change packet

Before a maintainer proposes applying any later migration, the packet must
contain all of the following:

1. The exact ordered migration range and a plain-language purpose for every
   file. The range is never cherry-picked out of order.
2. A dependency review showing which existing functions, routes, and hosted
   deployments require the new schema contract.
3. Synthetic-data evidence from the separate validation project, including
   success, authorization denial, replay/concurrency where relevant, and a
   post-test cleanup check.
4. A security review of new or changed tables, RLS, grants, views, triggers,
   and `SECURITY DEFINER` functions. No anonymous execution or browser table
   access may be introduced.
5. A recovery plan. For additive migrations this may be a documented
   fail-closed application rollback plus a forward repair; destructive or
   irreversible changes require a tested restore plan before approval.
6. The expected before/after migration history, advisor results, and a
   deployment compatibility plan.
7. Explicit pilot-change authority from the project owner for the named
   project and ordered range.

## Application order

1. Confirm the Vercel build to be used either remains compatible with the
   current pilot schema or is held from release until the database update
   completes.
2. Capture a read-only baseline: migration history, security/performance
   advisor output, function-grant inventory, and relevant empty/synthetic test
   scope. Do not copy personal player data into evidence.
3. Apply the reviewed ordered range in the separate synthetic validation
   project first. Rerun the packet's checks there.
4. Obtain the explicit pilot-change approval described above.
5. Apply the exact same ordered range once to the shared pilot during a
   planned maintenance window. Do not alter live tournament data to create
   proof fixtures.
6. Immediately re-run read-only migration, advisor, grant, and narrowly
   scoped application-contract checks. If an expected contract is missing,
   keep the affected app surface unavailable.
7. Deploy or promote only the build reviewed against that resulting schema,
   then perform browser smoke checks without sending a score, registration, or
   payment mutation unless the approved packet specifically authorizes a
   synthetic test.
8. Record the evidence, limitations, Vercel deployment ID, and final pilot
   migration history in `docs/quality/` and `PROJECT_STATUS.md`.

## Current non-authorization

This procedure does **not** authorize applying `0090`–`0103` now. That range
contains account-activation foundations and Rule 12 correction safety
suspensions in addition to the `0103` assigned-game retry-contract update.
The score screen's current unavailable state is intentional protection until a
reviewed, explicitly authorized migration packet exists.

The exact proposed ordered range, checksums, validation evidence, and required
post-apply proof are prepared in `PILOT_MIGRATION_PACKET_0090_0103.md`. It is
a review aid only and does not grant authority to change the shared pilot.

## Acceptance criteria for a future pilot update

- The pilot history exactly matches the approved ordered range.
- The approved app build either provides its intended workflow or fails closed
  without showing partial controls.
- Security advisor and grant review show no new anonymous execution or direct
  browser table access.
- The documented negative paths and relevant independent-session evidence
  pass on the resulting schema.
- A quality record names what was checked, the environment, results, and every
  remaining limitation.
