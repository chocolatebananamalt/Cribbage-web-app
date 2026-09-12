# Durable Project Memory

**Last updated:** 2026-09-11
**Purpose:** Preserve owner corrections and verified source facts across tasks
so a future worker does not depend on chat recall or ask the owner to repeat
recoverable information.

## Mandatory solve-first protocol

Before reporting a blocker or asking the owner what happens next:

1. Read this file, `PROJECT_STATUS.md`, the working outline, applicable
   requirements/decisions, and the relevant quality evidence.
2. Search the repository, cached source documents, tests, and existing
   implementation for the answer.
3. Inspect connected Vercel/Supabase state when relevant and authorized.
4. Try at least one safe, concrete, in-scope solution or diagnostic when one
   is available. Record the result.
5. Continue with any other independent in-scope work instead of stopping.
6. Ask the owner only when the remaining need is a genuine choice, approval,
   credential, physical-world test/action, or unavailable external fact.
   State exactly what was tried, what evidence failed, and the smallest action
   needed. Never stop without explaining the blocking condition.

Status reports must distinguish:

- **source available / implementation remaining**;
- **implemented / verification remaining**;
- **external approval or access required**; and
- **genuinely missing information**.

Do not call an item an information blocker merely because its code or
end-to-end proof is unfinished.

## Correction capture protocol

When the owner corrects or clarifies the project:

1. Add or amend the durable fact below with the date and provenance type
   (`Owner decision` or `ACC source`).
2. Reconcile `docs/product/requirements.md`, the applicable decision record,
   `docs/operations/WORKING_OUTLINE.md`, and tests when behavior changes.
3. Update `PROJECT_STATUS.md` and add quality evidence for material work.
4. If an owner statement conflicts with an official ACC source, preserve both,
   flag the conflict, and fail closed for official calculations until resolved.
5. Never silently overwrite a dated official rule or completed-tournament
   ruleset; create a new version.

## Durable pilot facts

| Fact | Provenance | Consequence |
| --- | --- | --- |
| September 18, 2026 is the target for director onboarding; October 3, 2026 is the supervised first tournament. | Owner decision, 2026-09-11 | Prioritize only the Standard Singles pilot minimum. |
| Required pilot functions are tournament/event/Q-pool setup, roster/check-in, initial seating/table plan, score entry, scorecards, cross-check/corrections, durable offline recovery, results/qualifiers, and financials. | Owner decision, 2026-09-11 | These are implementation and verification work, not optional prototype polish. |
| Production Rulebook UI, Judge Desk, digital team scoring, flyer creation/import, online payments, SMS, OCR, and automatic ACC submission are deferred. Team events use paper cards for this pilot. | Owner decision, 2026-09-11 | They do not consume the September pilot schedule. |
| One tournament contains separately configured Main, Consolation, and any Satellite events. | Owner decision, 2026-09-11 | Do not force directors into separate tournament logins/identities for related events. |
| Paper-only roster members must exist as full event participants without being forced to create an app account; a linked identity is required only for that player to submit digitally. | Owner requirements consolidated 2026-09-11 | Enrollment, scheduling, paper capture, cross-checking, reconstruction, scorecards, and results must operate on roster-backed participants, while digital writes remain account-bound. |
| The permitted cached official source is `public/rulebook/acc-rulebook-2025.pdf`, SHA-256 `DB284283420259C99CFCC960BFDF4A6B79C95A5FC1BEE02B1817B4AF4A02F9FD`. | ACC source reviewed 2026-09-10 | Use this source before asking the owner to restate scoring, scorecard, cross-check, or qualification rules. |
| Rule 12.1 supplies the Standard Singles 0/2/3 game-point derivation, spread convention, and leading-zero scorecard display. | ACC source reviewed 2026-09-10 | Scoring arithmetic has a source; operational wiring and real-device proof remain. |
| Rule 12.2(a)-(i) governs scorecard discrepancies and recalculation, including independent non-reciprocal adjudicated card values in applicable cases. | ACC source reviewed 2026-09-10 | Cross-check rules have a source; complete released workflow and multi-user proof remain. |
| Rule 13.2 and the ACC playoff-bracket source require cross-checked/tallied cards, one qualifier per four entrants rounded up, and byes for the highest qualifiers as required. | ACC source reviewed 2026-09-10 | Qualification structure has a source; complete event finalization still requires current calculation fixtures. |
| Separate plus and minus columns are required; ranking uses game points, games won, net spread, plus points, then the approved remaining tie process. Minus points are not an extra tie-breaker. | ACC source review plus owner clarification, 2026-09-10 | Preserve both columns and do not invent a minus-points tie-breaker. |
| Event/playoff winner and runner-up do not determine qualifying-round rank. Qualifiers stay highest-to-lowest; High Non-Qualifier is an unnumbered row immediately after the last qualifier. | Owner correction, 2026-09-11 | Apply this ordering to screens, PDFs, and exports. |
| Every skunk level shown to players awards 3 game points; double/triple labels are informal player aids, not official scoring labels. | Owner clarification, 2026-09-06 | Store official 3-point result; keep informal labels out of official records. |
| Offline score entry and failed-device reconstruction are mandatory for October 3. Unsynced data is never called server-verified; recovery uses surviving server/opponent/paper evidence plus audited non-self confirmation. | Owner decision, 2026-09-10 | This is an engineering requirement not supplied by the ACC rulebook; implementation and real reconnect/recovery proof remain. |
| Results and financials are not waiting for the owner to explain general ACC rules. The cached Rulebook and reviewed ACC resources are the starting sources. | Owner correction, 2026-09-11 | Proceed autonomously with source extraction, fixtures, implementation, and tests before escalating. Only a demonstrably absent/current-effective schedule, approval, or portal access may be escalated. |

## Source-versus-work ledger

| Area | Source state | Work state |
| --- | --- | --- |
| Standard Singles score entry and scorecard arithmetic | Available and already translated into core tests. | Finish production UI/API wiring and real independent-session proof. |
| Cross-check discrepancies and corrected totals | Rule 12.2 source and fixture oracle available. | Finish released lifecycle, projections, permissions, and multi-user proof. |
| Qualification count, ordering, brackets, and byes | Rulebook/public bracket sources available; core preview fixtures exist. | Finish event-scoped finalization and end-to-end proof. |
| MRP, Q-pool, payout, and official reporting | Public resource inventory exists. | Codex must first extract and test all usable current schedules. Escalate only a missing effective-date decision or unavailable authoritative schedule. |
| Financial ledger and reconciliation | Owner requirements and protected payment foundations exist. | Finish expenses, pools, payouts, reconciliation, and conservation tests. |
| Offline queue/recovery | Owner-approved behavioral requirements exist. | Implement durable authenticated queue/replay and failed-device recovery; prove reconnect, replay, conflicts, session changes, and reconstruction. |

## Genuine external dependencies

The worker must try all repository/source/service checks before escalating
these:

- ACC authorization for the app to replace or constitute an official digital
  operational record;
- an ACC-supported portal API/import boundary and credentials, if automated
  submission is desired;
- an authoritative current-effective schedule that cannot be established from
  the cached/public materials;
- real people/devices for final independent-user and physical pilot rehearsal;
- an owner/ACC policy choice where more than one safe interpretation remains.

These dependencies do not justify pausing unrelated implementation or tests.
