# Required verification

Every task requires observable acceptance criteria and at least one meaningful executed check. One trivial check is insufficient for multi-user or financial behavior.

`pnpm verify` is the clean-clone safety suite: production dependency audit,
lint, application tests, production build, and workspace/recovery integrity.
It runs in clean CI. `pnpm verify:handoff` requires the private ignored
handoff and is local-only. Passing either does not constitute production
certification.

Before coding define success and failure cases. Add regression tests, run relevant checks, review the diff against requirements, then record commands/environment/results/evidence. A missing or failed required check means incomplete.

## Production gates

Local Node-only alternative: `node --test tests/workspace.test.mjs`; mandatory local handoff: `node --test tests/handoff.test.mjs`. CI is pinned to pnpm 11.19.0 and Node 24; the handoff check is intentionally excluded from clean-clone CI because the private source is ignored.

- Unit: boundary/invalid scores, ranking/ties, qualifier rounding, byes, MRP fixtures, payout cents and ledger conservation. ACC rules need dated approved fixtures.
- Integration: hidden independent entries, distinct confirmations, authorization and cross-tournament denial, no self-check, append-only corrections, atomic concurrent/repeated requests.
- Browser: digital/digital, hybrid/dead-phone, mismatches/judges and cross-checking using independent sessions. Refresh, reconnect, duplicate taps, rejected PINs and queue replay.
- Accessibility: keyboard/focus/labels, contrast, zoom, phone/desktop clipping and real older/paper-player usability.
- Release: production build, dependency checks, staging smoke tests, backup AND restore exercise, monitoring, rollback drill and director-approved simulated tournament.

Assert actual persisted data, not only success messages. Never weaken a test to accept a defect. CI blocks merges only after required checks/branch protection are configured in GitHub. Record any unavailable check as unverified.
