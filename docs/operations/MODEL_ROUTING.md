# Codex model routing for this project

The default pattern is **balanced lead, economical workers, stronger independent review**. Model availability can change, so use the nearest available equivalent and state any substitution in the task evidence. Never use `gpt-6-astra` for this project.

## Roles

### Lead

Preferred: `gpt-5.6-terra` with `medium` reasoning. Increase to `high` when coordinating several interacting parts.

The lead owns the plan, acceptance criteria, task boundaries, integration, and final answer.

### Plan and high-risk reviewer

Preferred: `gpt-5.6-sol` with `high` reasoning. Use it for plan review, architecture decisions, security and data-integrity review, difficult debugging, and release review. Use `xhigh` only when a release or unresolved high-risk problem justifies it.

The reviewer must inspect the requirements, diff, and executed evidence. The reviewer does not approve assumptions merely because tests pass. Use Sol for a focused review rather than the whole implementation whenever practical.

### Routine implementation worker

Preferred: `gpt-5.6-luna` with `medium` reasoning. Use for isolated UI components, straightforward refactors, test implementation from already-approved cases, documentation updates, and mechanical repository work.

If the work has several interacting modules or Luna cannot complete it cleanly, escalate to `gpt-5.6-terra` with `medium` or `high` reasoning.

### Mechanical worker

Preferred: `gpt-5.4-mini` with `low` reasoning. Use for bounded inventory, file classification, formatting, renames, locating references, running commands, and summarizing test output. Do not use it as the sole author or reviewer of behavior that changes tournament results or access to data.

## Automatic routing rules

The lead should delegate only when the subtask is concrete, independent, and has a checkable deliverable. Use at most two workers in parallel unless the work has clearly independent parts. Avoid duplicate assignments and avoid delegation overhead for a task the lead can finish immediately.

Always require Sol review for these areas, even if Terra, Luna, or Mini helps implement them:

- scoring, qualifying, seating, payouts, MRPs, and financial reconciliation;
- authentication, authorization, PIN handling, personal data, audit history, and database policies;
- two-player confirmation, concurrency, offline synchronization, migrations, deployment, backup/restore, and release readiness;
- unclear requirements or conflicts with current ACC rules.

Escalate a worker's task when requirements are ambiguous, a relevant test fails twice, the change expands beyond its assigned files, or it discovers a security/data-integrity concern. The worker should return evidence and uncertainty instead of guessing.

## Builder-reviewer sequence

1. Lead defines scope, success cases, failure cases, permitted files, and required checks.
2. Economical worker implements the bounded task and returns changed files plus exact test results.
3. Lead integrates and runs the repository verification. For high-risk changes, use a fresh `gpt-5.6-sol` review focused on requirements, security, concurrency, and missing failure tests.
4. Fix findings and rerun affected checks. Record the model roles, commands, results, and limitations under `docs/quality/`.
5. A task is done only when the checks required by `docs/quality/VERIFICATION.md` pass. Model strength never substitutes for evidence.

## Practical Codex limitation

`AGENTS.md` can direct delegation and model choice for subagents. It cannot guarantee that an already-running task silently changes its own model. Start ordinary Cribbage tasks with Terra; let the lead route bounded work to Luna or Mini and send plans/high-risk results to Sol for focused review.
