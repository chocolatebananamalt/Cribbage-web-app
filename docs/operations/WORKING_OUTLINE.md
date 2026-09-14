# ACC Tournament Desk — Working Outline

**Last updated:** 2026-09-13

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
or unverified build will be called ready. The release candidate now contains
the required offline, results, finance, and recovery workflows. The remaining
acceptance risk is physical multi-person rehearsal evidence and the external
ACC/director confirmations listed below. Deferred features do not consume
pilot time.

## Working steps

| # | Step and definition of done | Status | Completed / estimated date | Current evidence or dependency |
| --- | --- | --- | --- | --- |
| 1 | **Requirements and design baseline.** Approved score entry, paper-style scorecard, roles, corrections, seating, event/flyer, results, finance, how-to, and paper-capture requirements are traceable and conflicts are recorded. | Complete | **2026-09-10** | `docs/product/production-requirements.md`, decisions, reviewed prototype. Official rules remain versioned inputs, not assumptions. |
| 2 | **Platform and access foundation.** Vercel Production, Supabase Auth/database, private role boundaries, audit receipts, director approval, self-service tournament creation, and safe registration links operate. | Implementation and deployment complete; physical acceptance remains | **Implemented and deployed 2026-09-13; acceptance target 2026-09-16** | Migration 0163, audited app-owner/ACC-administrator governance, and approved-director draft creation are live. The distinct `Full Rehearsal — 09-16-2026` draft exists exactly once; the app owner is its creator and sole primary director, and the separately approved friend is its co-director without Director Administration authority. Both see it under Your tournaments with the correct role. PR/main checks, Vercel Production, responsive live-demo, and runtime-error gates pass. Independent-session rehearsal remains. |
| 3 | **Tournament setup, players, check-in, and initial seating.** Main/Consolation/Satellites, game counts, fees, Q-pools, roster/import, payment status, check-in, closure, table capacity, assignments, event participants, and game schedule operate under one tournament. | Setup-input repair in release verification; rehearsal remains | **Core implemented 2026-09-12; input repair 2026-09-13; rehearsal target 2026-09-16** | Manual/CSV/public intake, claim review/promotion, explicit paper/digital choice, per-tournament cash/check configuration, amount owed/received/remaining/status, check-in, registration freeze, dynamic table plan, printable seating, event enrollment, setup amendment, and reviewed schedule publication are live. The discovered checkbox-style leakage on draft setup text/date/money fields is repaired locally with persistent event/Q-pool guidance and is undergoing release verification. One actual registration-close → seating → enrollment → schedule rehearsal remains. Flyer import is deferred. |
| 4 | **Scoring, scorecards, cross-checking, disputes, and offline durability.** Standard Singles two independent submissions plus two distinct eligible confirmations, verified-only scorecards, manual paper evidence, non-self dispute/correction handling, durable offline replay, and failed-device recovery all pass. | Implementation complete; physical proof remains | **Implemented 2026-09-13; physical proof target 2026-09-17** | Digital/digital, paper/paper, and hybrid digital/paper authority; scorecards; disputes; the reviewed migration 0140 Rule 12 corrections; progression; offline queue/page replay; audited failed-device recovery; and private digest-verified paper-card upload plus independent-official readback are implemented. OCR stays optional and disabled. Hosted fixtures and the automated gate pass. Real independent-session disconnect/reload/reconnect, authorized phone upload/readback, and physical reconstruction remain. |
| 5 | **Results and financials.** Standings, qualification/high-non-qualifier, playoff results, approved MRP/Q-pool calculations, expenses, fees, payouts, reconciliation, and director exports operate per event. | Manual pilot workflow implemented and deployed; ACC confirmation/rehearsal remains | **Implemented and deployed 2026-09-12; acceptance target 2026-09-17** | Correction-aware standings, immutable qualification, cutoff-tie rejection, HNQ ordering, playoff placement, manual MRP/Q-pool/award entry, payment/expense snapshots, cent-conserving finalization, private working-copy export, and an authorized-role final event-results PDF bound to exact finalized versions are live in Production. Hosted rollback fixtures pass on both databases; the production root/demo return 200, the private PDF route rejects an anonymous request, and the post-release runtime scan is clean. The server deliberately does not invent ACC formulas; current-effective ACC values and the director's completed rehearsal remain acceptance inputs. |
| 6 | **Pilot release proof.** Phone/desktop/zoom, independent sessions, offline/reconnect, backup/restore, rollback, monitoring, and director rehearsal pass against the release candidate. | In progress | **Target 2026-09-18** | Automated 320/375/640/1280 rendering, full local gate, hosted rollback fixtures, Production smoke/runtime monitoring, Vercel rollback, and isolated schema reconstruction/parity pass. On 2026-09-13 `pnpm verify:live-demo` operated 20 distinct production-demo screens at 320/640/1280 with zero overflow, CSP violations, failed requests, console errors, or page errors and parsed both required PDFs. Hosted rollback proof now covers migrations through `0163`, including director administration and independent paper-image authorization, while retaining no synthetic fixture users or tournaments. Independent player/official sessions, single-device and whole-venue disconnect/reconnect, a private-record backup/content restore, and the director walkthrough remain physical acceptance rehearsals in `OCTOBER_PILOT_REHEARSAL.md`. |
| 7 | **Supervised October 3 event.** Monitor the first tournament, preserve rollback/recovery paths, and capture issues without losing scorecards. | Not started | **2026-10-03** | Requires Step 6 and director approval. |
| 8 | **Deferred full suite.** Production Rulebook/quick-reference integration, Judge Desk, digital team scoring, flyer creation/import, online payments, SMS, live OCR activation, and automatic ACC submission. | Foundations prepared; live integrations deferred | **After 2026-10-03** | These do not block the Standard Singles pilot. Future payment methods are catalogued default-off. Private paper-card storage and the OpenAI draft adapter are implemented, but OCR remains disabled until live provider/false-read evidence passes. October uses audited cash/check payment, printed seating, and human paper-card entry. |

## Current highest-priority work

1. Use the isolated `Full Rehearsal — 09-16-2026` draft and its six fictional
   identities. Complete setup → roster/check-in → registration-close → seating
   → enrollment → schedule without altering the real October tournament.
2. Run the complete independent-session, single-device outage, whole-venue
   outage, paper/hybrid, failed-device, results/financial-finalization,
   backup/restore, and director rehearsal by September 18.
3. Record the current-effective ACC values used for MRP/Q-pool/payout entry and
   retain the manual reviewed finalization path; do not invent a formula.

The owner-private, plain-language blocker dashboard is published at
<https://acc-tournament-production-readiness.chocolatebananamalt.chatgpt.site>.

The detailed rule/ACC decision split is maintained in
`docs/operations/ACC_RULE_CONFIRMATION_CHECKLIST.md`.
Owner corrections and the mandatory solve-first protocol are maintained in
`docs/operations/DURABLE_PROJECT_MEMORY.md`.

## Exact shared-pilot preparation state

Read-only inspection on 2026-09-13 found the following in the approved pilot
database for **October 3 Pilot Tournament**. These are operational preparation
facts, not missing integrations or hidden engineering work.

| Item | Current count/state | What closes it |
| --- | --- | --- |
| Tournament setup | Activated | No engineering action remains for the setup shell. |
| Private roster identities | 2 | Director completes the real roster by manual entry, CSV import, or approved public registration claims. |
| Assigned official accounts | 2 — director and co-director; 0 cross-checkers as of the last hosted read | Use the protected Cross-checker Assignments screen after the intended officials' accounts are linked. At least two independent cross-checkers are required for the rehearsal. |
| Assigned player accounts | 0 | At least two real test players sign in and are linked before independent-session proof can begin. |
| Check-ins | 0 | Director records arrival during the rehearsal. |
| Event enrollments | 0 | Director enrolls the final roster after registration closes. |
| Seating publications | 0 | Director reviews table capacity and publishes the initial assignments once registration closes. |
| Scheduled games | 0 | Director imports/reviews and publishes the event schedule after enrollment. |

Do not fill these rows with invented production identities or prematurely
close registration merely to turn the tracker green. The product supplies the
required manual, CSV, QR/link, account-link, check-in, seating, enrollment, and
schedule workflows; the remaining values must represent the real rehearsal or
tournament participants.

## ACC confirmation checklist

### Part A — Codex confirms from official ACC sources

| Confirmation | Status | Target |
| --- | --- | --- |
| Current Rulebook edition plus game-point, spread, scorecard, and cross-check source extraction | Complete — cached 2025 edition reviewed 2026-09-10 | 2026-09-10 |
| Complete released score/cross-check rule-to-code fixtures and real workflow proof | Automated fixtures complete; physical workflow proof remains | 2026-09-17 |
| Qualification order, playoff count, bracket, and bye fixtures | Automated fixtures complete; current-effective ACC acceptance remains | 2026-09-17 |
| Event styles, game-count options, sanctioning fields, role vocabulary, and rotation-exception sources | In progress — no general automatic rotation fixture is available, so director-entered/imported scheduling is the pilot fallback | 2026-09-15 |
| MRP, Q-pool, payout, and reporting-source inventory | In progress — Codex must exhaust cached/public schedules and build fixtures before requesting any missing current-effective confirmation | 2026-09-16 |
| Rule-to-code traceability, positive fixtures, and rejection/edge-case fixtures | Implemented for the Standard Singles pilot; final dated evidence reconciliation remains | 2026-09-17 |

### Part B — ACC/director confirmations needed

| Your checklist item | Status | Needed by |
| --- | --- | --- |
| Written approval to use the app as an official digital operational record | Waiting for ACC/director response | Before pilot acceptance of Step 3 |
| Approved ACC portal API, import, or director-reviewed export process | Waiting for ACC/director response | 2026-09-16 for official pilot export; API itself remains optional |
| Current authoritative MRP, Q-pool, and payout schedules for supported events | Waiting for ACC/director response | 2026-09-16 for the September 17 results gate |
| Paper-scorecard image/OCR retention and access policy | Approved for private restricted hold with no automatic purge — 2026-09-12 | Complete for storage foundation; live OCR still requires provider evidence |
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
