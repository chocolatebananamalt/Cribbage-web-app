# Cribbage Web App

Software project for the cribbage tournament system.

## Start here

Open this folder as its own Codex project. Read `START_HERE.md` and `PROJECT_STATUS.md`. The recovered ACC handoff is already organized; `docs/recovery/inventory.json` maps all artifacts. Review `docs/recovery/REVIEW.md` for implementation findings and `docs/operations/LAUNCH_PLAN.md` for next steps.

## Folder map

- `docs/product/`: requirements, workflows, and user stories
- `docs/architecture/`: technical design and data model
- `docs/research/`: rules and source research
- `docs/decisions/`: durable engineering decisions
- `src/`: application source code
- `tests/`: automated tests
- `public/`: static web assets
- `data/samples/`: non-sensitive sample data
- `imports/`: recovered chats and source material awaiting review
- `scripts/`: maintenance and data-processing scripts
- `archive/`: superseded material retained for reference
- `prototypes/`: recovered interactive review demo, separate from production code
- `docs/design/`: mockup and reference catalog
- `docs/quality/`: required checks, acceptance criteria and evidence
- `docs/operations/`: hosting, deployment and pilot planning
- `database/`: future schema/permission migrations

Run `node --test tests/workspace.test.mjs` locally (or `npm run verify` where npm is installed). Private handoff material is intentionally ignored by Git and must be restored from the original ZIP on another machine. No application is currently deployed.
