# Cribbage Web App Instructions

This repository contains the cribbage tournament web application.

## Working rules

- Read `PROJECT_STATUS.md` before making changes.
- Treat files in `imports/` as source material; do not overwrite them.
- Convert recovered requirements into `docs/product/requirements.md` with source references.
- Record important technical choices in `docs/decisions/`.
- Keep production code in `src/` and tests in `tests/`.
- Use sample or anonymized tournament data only.
- Never commit credentials, tokens, private player data, or unrelated financial information.
- Update `PROJECT_STATUS.md` at the end of material work.

## Model routing

- Follow `docs/operations/MODEL_ROUTING.md`. Never use `gpt-6-astra` for this project.
- Preferred routing on the current Codex host: `gpt-5.6-terra` medium for the lead; `gpt-5.6-sol` high for focused plan/high-risk review; `gpt-5.6-luna` medium for routine implementation; `gpt-5.4-mini` low for mechanical work.
- Never let a lower-cost worker be the sole authority for scoring, qualifying, seating, money, identity, permissions, audit, multi-user verification, sync, database policy, deployment, or release readiness.
- Workers must return changed files, exact checks, results, and uncertainty. The Terra lead owns integration and definition of done; Sol reviews the plan or high-risk result rather than performing the whole build whenever practical.

## Mandatory definition of done

- Read START_HERE.md and docs/quality/VERIFICATION.md before work.
- Define observable acceptance criteria before implementation.
- Run `pnpm verify` after material changes and add relevant regression tests for behavior changes. Include rejection paths for scoring, identity, roles, sync and money. Run `pnpm verify:handoff` locally when the private handoff is present; clean CI intentionally omits it.
- UI changes require browser verification at phone and desktop sizes. Multi-user features require independent sessions and a real test backend.
- Review the diff against requirements after testing. Record commands, environment, pass/fail, evidence and limitations in docs/quality/. Failed or unavailable required checks mean incomplete; never call untested work done.
- Official scoring/seating/payout rules need dated authoritative ACC sources and reviewed test fixtures. Prototype assumptions are not official rules.
- Require two independent submissions plus two confirmations before digital verification. Pending sync is never server verified. Enforce roles and self-check restrictions on the server.
- Preserve original HTML; develop production code separately. Never serve imports, private correspondence or source photographs. Do not upload private handoff material by default.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
