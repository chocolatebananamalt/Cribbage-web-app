# Start here: ACC Digital Tournament System

Read AGENTS.md, PROJECT_STATUS.md, docs/recovery/REVIEW.md, docs/quality/VERIFICATION.md and docs/operations/MODEL_ROUTING.md before work.

Baseline: recovered specification v1.1 (43 sections). Latest demo: pilot v1.3. Originals live in imports/acc-handoff-2026-09-05; docs/recovery/inventory.json maps every file to its organized copy.

## Mandatory checks and balances

No task is done merely because code was written or a screen looks right.
1. Define an observable acceptance criterion before coding.
2. Run `pnpm verify` after every material change; run `pnpm verify:handoff` for local recovery work. Clean-clone CI intentionally runs `pnpm verify` only because the private handoff is ignored.
3. Add and run a relevant regression test for every behavior change, including failure/rejection cases when applicable.
4. UI changes require browser checks at phone and desktop sizes. Multi-user changes require independent sessions against a real test backend.
5. Review the diff against requirements. Record commands, environment, results, evidence and limitations under docs/quality/.
6. Update PROJECT_STATUS.md. Failed or unrun required checks mean incomplete. Prototype tests do not establish production readiness.

## Folder map

On this computer the bundled Node executable must be invoked by absolute path; see docs/quality/2026-09-05-handoff-review.md for the copy-and-paste PowerShell command. With Node on PATH, use `pnpm verify`. For mandatory local handoff checks, use `pnpm verify:handoff`; CI uses pnpm 11.19.0 with Node 24 and does not require the private ignored handoff.

- prototypes/: recovered demo, not the production app.
- docs/product/: requirements and source specifications.
- docs/design/: historical visual references and design decisions.
- docs/architecture/: module and data design.
- docs/quality/: acceptance criteria and test evidence.
- docs/operations/: hosting, pilot, deployment and recovery plans.
- database/: future schema migrations and permissions.
- src/: future production code; tests/: executable verification.
- imports/ and docs/private/: preserved source material and correspondence, never served publicly.

Next: agree pilot scope, validate ACC rule fixtures, then build a two-player server-backed score submission and dual-confirmation flow with its rejection and concurrency tests.
