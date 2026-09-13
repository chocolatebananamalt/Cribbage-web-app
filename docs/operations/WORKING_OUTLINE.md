# ACC Tournament Desk — Working Outline

**Last updated:** 2026-09-12

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
| 2 | **Platform and access foundation.** Vercel Production, Supabase Auth/database, private role boundaries, audit receipts, and safe registration links operate. | Implementation complete; acceptance proof remains | **Implemented 2026-09-12; acceptance target 2026-09-16** | Production hosting, passwordless sign-in, named tournament chooser, registration link/claim/review, audited role boundaries, migrations through 0151, rollback, and runtime-error checks pass. A genuinely independent account/session rehearsal remains. |
| 3 | **Tournament setup, players, check-in, and initial seating.** Main/Consolation/Satellites, game counts, fees, Q-pools, roster/import, payment status, check-in, closure, table capacity, assignments, event participants, and game schedule operate under one tournament. | Implementation complete; rehearsal remains | **Implemented 2026-09-12; rehearsal target 2026-09-16** | Manual/CSV/public intake, claim review/promotion, explicit paper/digital choice, manual payment evidence, check-in, registration freeze, table plan, printable seating, event enrollment, setup amendment, and reviewed schedule publication are live. One actual registration-close → seating → enrollment → schedule rehearsal remains. Flyer import is deferred. |
| 4 | **Scoring, scorecards, cross-checking, disputes, and offline durability.** Standard Singles two independent submissions plus two distinct eligible confirmations, verified-only scorecards, manual paper evidence, non-self dispute/correction handling, durable offline replay, and failed-device recovery all pass. | Implementation complete; physical proof remains | **Implemented 2026-09-12; physical proof target 2026-09-17** | Digital/digital, paper/paper, and hybrid digital/paper authority; scorecards; disputes; Rule 12 corrections; progression; offline queue/page replay; and audited failed-device recovery are implemented. Hosted fixtures and the 407-test gate pass. Real independent-session disconnect/reload/reconnect and physical reconstruction remain. OCR is optional and deferred. |
| 5 | **Results and financials.** Standings, qualification/high-non-qualifier, playoff results, approved MRP/Q-pool calculations, expenses, fees, payouts, reconciliation, and director exports operate per event. | Manual pilot workflow implemented; ACC confirmation/rehearsal remains | **Implemented 2026-09-12; acceptance target 2026-09-17** | Correction-aware standings, immutable qualification, cutoff-tie rejection, HNQ ordering, playoff placement, manual MRP/Q-pool/award entry, payment/expense snapshots, cent-conserving finalization, and private working-copy export are implemented and hosted fixtures pass. The server deliberately does not invent ACC formulas; current-effective ACC values and the director's completed rehearsal remain acceptance inputs. |
| 6 | **Pilot release proof.** Phone/desktop/zoom, independent sessions, offline/reconnect, backup/restore, rollback, monitoring, and director rehearsal pass against the release candidate. | In progress | **Target 2026-09-18** | Automated 320/375/640/1280 rendering, full local gate, hosted rollback fixtures, Production smoke/runtime monitoring, and a Vercel rollback-and-restore drill pass. Independent player/official sessions, disconnect/reconnect, backup/restore, and the director walkthrough remain physical acceptance rehearsals in `OCTOBER_PILOT_REHEARSAL.md`. |
| 7 | **Supervised October 3 event.** Monitor the first tournament, preserve rollback/recovery paths, and capture issues without losing scorecards. | Not started | **2026-10-03** | Requires Step 6 and director approval. |
| 8 | **Deferred full suite.** Production Rulebook/quick-reference integration, Judge Desk, digital team scoring, flyer creation/import, online payments, SMS, OCR, and automatic ACC submission. | Planned | **After 2026-10-03** | These do not block the Standard Singles pilot. Payment, SMS, and OCR activation gates and exact external dependencies are recorded in `PROVIDER_ACTIVATION_PLAN.md`; OCR remains a desired next capability, while October uses audited manual payment, printed seating, and human paper-card entry. |

## Current highest-priority work

1. Run the actual setup → roster/check-in → registration-close → seating →
   enrollment → schedule rehearsal against the shared pilot.
2. Run the complete two-player, offline/reconnect, paper/hybrid, failed-device,
   results/financial-finalization, backup/restore, and director rehearsal by
   September 18.
3. Record the current-effective ACC values used for MRP/Q-pool/payout entry and
   retain the manual reviewed finalization path; do not invent a formula.

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
