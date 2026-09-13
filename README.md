# Cribbage Web App

Software project for the cribbage tournament system.

## Start here

Open this folder as its own Codex project. Read `START_HERE.md`,
`PROJECT_STATUS.md`, and `docs/operations/DURABLE_PROJECT_MEMORY.md`. The
recovered ACC handoff is already organized; `docs/recovery/inventory.json` maps
all artifacts. Use `docs/operations/WORKING_OUTLINE.md` for current delivery
status and `docs/operations/OCTOBER_PILOT_REHEARSAL.md` for the remaining
physical go/no-go evidence.

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
- `database/`: ordered production schema/permission migrations

Run `pnpm verify` for the complete repository gate and
`pnpm verify:handoff` when the ignored private handoff is present. Private
handoff material is intentionally ignored by Git and must be restored from the
original ZIP on another machine. The Standard Singles release candidate is
deployed at <https://cribbage-web-app.vercel.app/>; its public `/demo` uses only
fictional data. Deployment alone is not pilot approval—the independent-person,
offline/recovery, paper-image, backup/content-restore, and director rehearsals
remain mandatory.
