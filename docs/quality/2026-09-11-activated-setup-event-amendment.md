# Activated setup event amendment evidence

Date: 2026-09-11
Environment: local Windows worktree, Node 24 / pnpm; approved Supabase pilot

## Acceptance criteria

- A current director/co-director can append one or more later events to an already activated open tournament.
- Existing activated setup/event/ruleset and all downstream operational data remain immutable.
- Standard Singles additions are digital; non-singles additions are manual.
- Exact replay creates no duplicate; changed replay, stale concurrent request, duplicate name/client ID, second Consolation, unsupported menus, excess events, non-director, and direct browser RPC fail closed.
- The accepted amendment and authorized rejections are receipt-bound and audited.
- The setup screen retains an ambiguous request for exact retry and shows the refreshed complete active-event projection after success.

## Evidence

- Focused setup tests passed: 17/17.
- Full clean-clone verification passed 357/357 application tests, dependency
  audit, lint, production build, workspace checks, and private-handoff checks.
- Migration `0137` was applied successfully to the approved Supabase pilot on
  2026-09-11 (Hawaii time).
- The first rollback-only fixture run exposed a fixture-only Supabase role
  simulation error: PostgreSQL role was set to `service_role`, but the JWT role
  claim read by `auth.role()` was absent. The transaction rolled back and left
  no synthetic data.
- After the fixture set both the PostgreSQL role and matching JWT claim, the
  complete hosted fixture passed. It covered accepted append, exact replay,
  changed replay, stale competing revision, duplicate event, browser-role
  denial, activation projection, grants, and rollback.

## Remaining required proof

- Exercise two independent director/co-director connections concurrently and confirm one accepted amendment plus one stale rejection without duplicates or deadlock.
- Verify the protected setup screen at desktop and phone widths against that backend, including ambiguous-response exact retry.
- Run the full repository verification after integration with concurrent work. Until these checks pass, this slice is implemented but not released.
