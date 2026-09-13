# Requirements Hardening Verification - 2026-09-06

## Scope

Independent review findings were applied to the normative requirements baseline and its traceability summary. No production app code, imports, credentials, or external services were changed.

## Evidence added

- Stable requirement IDs `R-REG-01` through `R-UX-01` now map each high-risk area to positive and rejection-path evidence.
- Registration/check-in/shared-device clearing, seating/rotation gates, disputes, Consolation eligibility, template duplication, and attachment rules are explicit.
- Digital and hybrid workflows identify distinct eligible entry and confirmation actors; offline, paper, dead-phone, mismatch, replay, and self-confirmation paths reject verification.
- Per-card score lines are linked to canonical match/game records; Rule 12.2 fixture cases (a)-(i) are required and may not be reduced to one margin.
- Corrections distinguish `Pending` from `Applied`, define default and configured effects, and leave reconfirmation/published-result behavior as explicit policy gates.
- Judge/cross-check source display, capacity configuration, escalation, and self-dispute restrictions are explicit.
- Standard Singles is the first digital scoring boundary; other formats remain representable but gated by a separate approved ruleset.
- Retention defaults to restricted hold/no automatic purge; deletion, legal hold, backups, restore, and audit controls are explicit.
- `acc-results-v1` is explicitly internal/director-assisted and pending an ACC golden contract; finance/reporting gates, signed-in results audience, informal skunk bands, accessibility targets, and rulebook-cache permission are explicit.

## Commands and results

Environment: Windows PowerShell; bundled Node 24.19.0 runtime.

- `node --test tests/workspace.test.mjs` - PASS, 6/6.
- `node --test tests/handoff.test.mjs` - PASS, 3/3.
- `git diff --check` - PASS, no whitespace errors.

## Limitations

These are requirements/documentation checks, not production certification. The application, backend schema/RLS, ACC-approved rotation/eligibility/payout/retention/copyright/export fixtures, browser workflows, backup/restore drill, and Rule 12.2 implementation fixtures remain to be built and verified.

## Second hardening pass

- Hybrid/paper now requires each assigned player to independently enter and confirm their own paper result with a context-only PIN. An unavailable player leaves `PendingCrossCheck`; staff capture cannot substitute without a future approved exception.
- The cited ACC 2025 judge baseline is encoded: two judges before hearing, one rulebook, third judge on disagreement; cross-check minimum per individual table is two for 24 or fewer players and three above 24, with the related-couple/significant-other/relative safeguard requiring a third checker only for an affected qualifying table, and no self-dispute.
- Corrections are immediately `Applied` by default, preserve prior verification/audit, supersede derived totals without reconfirmation, remain `Pending` when second approval is enabled, and create new result versions after publication.
- Published signed-in results include paid-placement amount per player, source-backed high non-qualifier handling including a qualifier tie-playoff loser where applicable, and Muggins-in-effect flyer disclosure.
- Finance/reporting gates are enumerated rather than hidden; non-singles output is manual/imported until a separately approved ruleset exists.
- `docs/architecture/README.md` now prevents a single-margin games model and maps role, offline, finalization, flyer, attachment, finance, result-version, and export boundaries.

## Final source-accuracy corrections

- Expanded `TR-06` to name ACC 2025 Judge Protocols, Rule 10.1(b), Appendix A items 1–3, and the existing 12.1, 12.2, 13.2, and Cross-Checking Guidelines item 20 references.
- Removed Muggins disclosure from unresolved compliance gates; only event selection/configuration remains data to record.
- Architecture now updates all affected scorelines atomically and uses normalized side-pair/round/event assignment uniqueness with explicit rematch/version and replay/idempotency handling.
