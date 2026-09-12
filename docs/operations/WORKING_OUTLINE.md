# ACC Tournament Desk — Working Outline

**Last updated:** 2026-09-11

**How to ask for this:** `Show Outline`
**Planning baseline:** This is a living delivery tracker, not a promise that
an unverified feature is ready. Estimates assume prompt decisions, continued
access to the current Vercel/Supabase projects, and no newly discovered ACC
rule conflict. Any item that needs a real director decision or real-world test
shows that dependency explicitly.

## Completion forecast

| Target | Target date | What must be true |
| --- | --- | --- |
| Director onboarding build | **2026-09-18 — at risk** | The narrowed Standard Singles pilot minimum below passes real server, offline, independent-user, phone/desktop, backup/restore, and rehearsal checks. |
| Supervised first tournament | **2026-10-03** | The September build survives director rehearsal and any release-blocking defects are closed. |
| Deferred full-suite capabilities | **After 2026-10-03** | Production Rulebook/quick-reference integration, Judge Desk, digital team scoring, flyer creation/import, online payments, SMS, OCR, and automatic ACC submission are delivered separately. The demonstration may retain a reference-only Rulebook preview. |

September 18 is the requested operating target, not a promise that an unsafe
or unverified build will be called ready. It is at risk because seven calendar
days remain and durable offline operation, complete results/finance wiring,
and real multi-person release evidence are still open. Deferred features do
not consume pilot time.

## Working steps

| # | Step and definition of done | Status | Completed / estimated date | Current evidence or dependency |
| --- | --- | --- | --- | --- |
| 1 | **Requirements and design baseline.** Approved score entry, paper-style scorecard, roles, corrections, seating, event/flyer, results, finance, how-to, and paper-capture requirements are traceable and conflicts are recorded. | Complete | **2026-09-10** | `docs/product/production-requirements.md`, decisions, reviewed prototype. Official rules remain versioned inputs, not assumptions. |
| 2 | **Platform and access foundation.** Vercel Production, Supabase Auth/database, private role boundaries, audit receipts, and safe registration links operate. | In progress | **Target 2026-09-12** | Hosting, passwordless sign-in, named tournament chooser, audited director/co-director access, migrations through 0136, and indexed foreign keys are live. The October public fragment-only QR link accepted a fictional claim without granting access; the director rejected it through the live protected queue and the test never entered the roster. A genuinely independent browser/account release session and complete pilot proof remain. |
| 3 | **Tournament setup, players, check-in, and initial seating.** Main/Consolation/Satellites, game counts, fees, Q-pools, roster/import, payment status, check-in, closure, table capacity, assignments, event participants, and game schedule operate under one tournament. | In progress | **Target 2026-09-14** | The October Main Event is activated. Manual/CSV/public claim intake, protected claim review, separate roster promotion, payment evidence, check-in, registration freeze, table plan, paper/digital enrollment, and reviewed schedule publication are implemented. Hosted roster/freeze/schedule fixtures pass after migration 0136. Roster-account activation code exists but its independent Production gate remains closed pending real-session proof. One actual registration-close → seating → enrollment → schedule rehearsal remains. Flyer import is deferred. |
| 4 | **Scoring, scorecards, cross-checking, disputes, and offline durability.** Standard Singles two independent submissions plus two distinct eligible confirmations, verified-only scorecards, manual paper evidence, non-self dispute/correction handling, durable offline replay, and failed-device recovery all pass. | In progress | **Target 2026-09-16** | Assigned games, device-bound offline replay, expiring offline page reload, hybrid scorecard reconstruction, correction-aware totals, and audited failed-device recovery are implemented; the latest hosted recovery, correction, and paper-evidence fixtures pass. Real two-session disconnect/reload/reconnect and physical failed-device reconstruction remain. OCR is deferred, so paper evidence is entered manually. |
| 5 | **Results and financials.** Standings, qualification/high-non-qualifier, playoff results, approved MRP/Q-pool calculations, expenses, fees, payouts, reconciliation, and director exports operate per event. | In progress | **Target 2026-09-17** | Paper-inclusive correction-aware standings, completion evidence, immutable qualifying-round finalization, provisional qualifiers, cutoff-tie rejection, High Non-Qualifier, audited expenses, and a versioned settlement draft/private working copy are implemented; the latest hosted standings/finalization/settlement/expense fixtures pass. Approved Q-pool/MRP calculations, reconciliation, publication, and official export remain; affected outputs fail closed. |
| 6 | **Pilot release proof.** Phone/desktop/zoom, independent sessions, offline/reconnect, backup/restore, rollback, monitoring, and director rehearsal pass against the release candidate. | Not started | **Target 2026-09-18** | Required before the director relies on the app. A green build alone is insufficient. |
| 7 | **Supervised October 3 event.** Monitor the first tournament, preserve rollback/recovery paths, and capture issues without losing scorecards. | Not started | **2026-10-03** | Requires Step 6 and director approval. |
| 8 | **Deferred full suite.** Production Rulebook/quick-reference integration, Judge Desk, digital team scoring, flyer creation/import, online payments, SMS, OCR, and automatic ACC submission. | Deferred | **After 2026-10-03** | These do not block the Standard Singles pilot. The demo Rulebook preview is reference-only; team events use paper scorecards. |

## Current highest-priority work

1. Close Q-pool/MRP/payout, playoff results, and financial reconciliation from
   current authoritative sources with fail-closed fixtures.
2. Run the actual setup → roster/check-in → registration-close → seating →
   enrollment → schedule rehearsal against the shared pilot.
3. Run the complete two-player, offline/reconnect, recovery, and
   release rehearsal by September 18.

The owner-private, plain-language blocker dashboard is published at
<https://acc-tournament-production-readiness.chocolatebananamalt.chatgpt.site>.

The detailed rule/ACC decision split is maintained in
`docs/operations/ACC_RULE_CONFIRMATION_CHECKLIST.md`.
Owner corrections and the mandatory solve-first protocol are maintained in
`docs/operations/DURABLE_PROJECT_MEMORY.md`.

## ACC confirmation checklist

### Part A — Codex confirms from official ACC sources

| Confirmation | Status | Target |
| --- | --- | --- |
| Current Rulebook edition plus game-point, spread, scorecard, and cross-check source extraction | Complete — cached 2025 edition reviewed 2026-09-10 | 2026-09-10 |
| Complete released score/cross-check rule-to-code fixtures and real workflow proof | In progress | 2026-09-16 |
| Qualification order, playoff count, bracket, and bye fixtures | In progress | 2026-09-15 |
| Event styles, game-count options, sanctioning fields, role vocabulary, and rotation-exception sources | In progress — no general automatic rotation fixture is available, so director-entered/imported scheduling is the pilot fallback | 2026-09-15 |
| MRP, Q-pool, payout, and reporting-source inventory | In progress — Codex must exhaust cached/public schedules and build fixtures before requesting any missing current-effective confirmation | 2026-09-16 |
| Rule-to-code traceability, positive fixtures, and rejection/edge-case fixtures | Not started | 2026-09-17 |

### Part B — ACC/director confirmations needed

| Your checklist item | Status | Needed by |
| --- | --- | --- |
| Written approval to use the app as an official digital operational record | Waiting for ACC/director response | Before pilot acceptance of Step 3 |
| Approved ACC portal API, import, or director-reviewed export process | Waiting for ACC/director response | 2026-09-16 for official pilot export; API itself remains optional |
| Current authoritative MRP, Q-pool, and payout schedules for supported events | Waiting for ACC/director response | 2026-09-16 for the September 17 results gate |
| Paper-scorecard image/OCR retention and access policy | Deferred with OCR | Before enabling image/OCR capture after the pilot |
| Confirmed official role list, including multiple co-directors | Waiting for ACC/director response | Before Step 3 acceptance |
| Payment authority and processor choice, only if app payments are enabled | Not yet needed | Before enabling payments |

The detailed checklist explains the source, purpose, and exact evidence for
each item. When either side completes an item, its status and date are updated
here and in the detailed record.

## Rules for status updates

- **Complete** means the stated definition of done has direct recorded
  evidence, not merely a prototype screen, migration, or passing static test.
- **In progress** means useful implementation exists but a requirement or
  verification gate remains open.
- Every `Show Outline` response reports the table above, highlights changes
  since the prior report, and revises estimates only when evidence warrants it.
- A new critical defect reopens the affected step and its estimate; it is never
  hidden behind a green deployment.

## Source of truth

The detailed requirements and release gates remain in
`docs/product/production-requirements.md`, `docs/quality/`, and
`docs/operations/LAUNCH_PLAN.md`. This document is their plain-language
execution tracker.
