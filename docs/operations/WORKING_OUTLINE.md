# ACC Tournament Desk — Working Outline

**Last updated:** 2026-09-15

> **October standard correction (approved 2026-09-14):** October is not
> Standard-Singles-only. Two-person Traditional Doubles and Canadian Doubles
> support captain-selected Digital or Paper team scoring; participant seating
> lookup and up to six configurable Side Pools are release blockers. See
> `docs/decisions/2026-09-14-october-team-scoring-seating-and-six-side-pools.md`.

**How to ask for this:** `Show Outline`
**Planning baseline:** This is a living delivery tracker, not a promise that
an unverified feature is ready. Estimates assume prompt decisions, continued
access to the current Vercel/Supabase projects, and no newly discovered ACC
rule conflict. Any item that needs a real director decision or real-world test
shows that dependency explicitly.

## Completion forecast

| Target | Target date | What must be true |
| --- | --- | --- |
| Director onboarding build | **2026-09-18 — at risk** | The corrected October pilot minimum below (Standard Singles plus supported two-person doubles, seating directory, and six Side Pools) passes real server, offline, independent-user, phone/desktop, backup/restore, and rehearsal checks. |
| Supervised first tournament | **2026-10-03** | The September build survives director rehearsal and any release-blocking defects are closed. |
| Deferred full-suite capabilities | **After 2026-10-03** | Production Rulebook/quick-reference integration, Judge Desk, flyer creation/import, online payments, SMS, OCR, and automatic ACC submission are delivered separately. Supported doubles team scoring, seating directory, and six Side Pools are release work. |

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
| 3 | **Tournament setup, players, check-in, seating, and directory.** Main/Consolation/Satellites, supported doubles, game counts, fees, Q-pools, roster/import, payment status, check-in, closure, capacity, assignments, scoped lookup, event participants, and schedules operate under one tournament. | Deployed; rehearsal remains | **Deployed 2026-09-15; rehearsal target 2026-09-16** | Manual/CSV/public intake, registration freeze, dynamic table plan, printable seating, audited schedule publication/amendment, captain-selected shared team mode, team claims, scorer designation/linkage, published starting/current Table/Seat and permanent IDs, participant directory with private-field filtering, and printable paper-card lists are live. One registration-close → seating → directory → schedule rehearsal remains. |
| 4 | **Singles and supported team scoring, scorecards, cross-checking, disputes, and offline durability.** Standard Singles plus Traditional/Canadian Doubles support independent verification, reciprocal team lines, paper/hybrid paths, corrections, and durable offline replay. | Deployed; physical proof remains | **Deployed 2026-09-15; physical proof target 2026-09-17** | Team-specific records, four-member display, one opposing designated-scorer submission per team, two distinct eligible confirmations, self-confirmation rejection, team standings, paper-card counts, audit-safe corrections, and offline recovery are live without changing singles safeguards. Hosted fixtures pass; independent-session disconnect/reload/reconnect and physical reconstruction remain. |
| 5 | **Results and financials.** Standings, qualification/high-non-qualifier, playoff results, six Side Pools, Main/Consolation MRP calculation, expenses, fees, payouts, reconciliation, and director exports operate per event. | Deployed; rehearsal remains | **MRP calculation applied 2026-09-15; rehearsal target 2026-09-17** | Main/Consolation MRP values are server-calculated only from the owner-approved currently published ACC schedule source `acc-published-mrp-2016-08-01`, after complete recorded playoff exit rounds. Satellite reports remain MRP-not-applicable. Six configurable event-scoped Side Pools support unique names, equal-fee pools with different names, elections, collections, corrections, payouts, reconciliation, CSV/PDF reports, and seventh-pool rejection. Physical results/finance review remains. |
| 6 | **Pilot release proof.** Phone/desktop/zoom, independent sessions, offline/reconnect, backup/restore, rollback, monitoring, and director rehearsal pass against the release candidate. | In progress | **Target 2026-09-18** | Automated 320/375/640/1280 rendering, full local gate, hosted rollback fixtures, Production smoke/runtime monitoring, Vercel rollback, and isolated schema reconstruction/parity pass. On 2026-09-13 `pnpm verify:live-demo` operated 20 distinct production-demo screens at 320/640/1280 with zero overflow, CSP violations, failed requests, console errors, or page errors and parsed both required PDFs. Hosted rollback proof now covers migrations through `0163`, including director administration and independent paper-image authorization, while retaining no synthetic fixture users or tournaments. Independent player/official sessions, single-device and whole-venue disconnect/reconnect, a private-record backup/content restore, and the director walkthrough remain physical acceptance rehearsals in `OCTOBER_PILOT_REHEARSAL.md`. |
| 7 | **Supervised October 3 event.** Monitor the first tournament, preserve rollback/recovery paths, and capture issues without losing scorecards. | Not started | **2026-10-03** | Requires Step 6 and director approval. |
| 8 | **Deferred full suite.** Production Rulebook/quick-reference integration, Judge Desk, flyer creation/import, online payments, SMS, live OCR activation, and automatic ACC submission. | Foundations prepared; live integrations deferred | **After 2026-10-03** | These do not include supported October doubles, seating directory, or six Side Pools, which block the September 18 gate. Future payment methods remain default-off; OCR remains disabled. |

## Current highest-priority work

### Rehearsal findings priority rule

1. **Must fix before October 3:** blocks safe scoring, verification, results,
   finances, seating, or data recovery.
2. **Fix before director setup begins:** required for accurate or practical
   director setup, including setup of **Full Rehearsal — 09-16-2026**.
3. **Post-rehearsal improvement:** valuable work to complete before later
   pilots, but not required for the rehearsal or October 3.

For a finding that could reasonably fit more than one class, present the owner
with the recommendation and these three choices before assigning it. The
calculated Main/Consolation ACC Sanctioning Fee is Category 2.

**Category 2 — Structured tournament contact information:** implementation and
verification are required before Full Rehearsal setup. The open-ended Director
contact-details field is replaced with required tournament phone/email, an
optional player-facing mailing address, role-backed primary-director name, and
versioned audit history. It must not access or display a director’s private
address.

1. Use the isolated `Full Rehearsal — 09-16-2026` draft and its six fictional
   identities. Complete setup → roster/check-in → registration-close → seating
   → enrollment → schedule without altering the real October tournament.
2. Run the complete independent-session, single-device outage, whole-venue
   outage, paper/hybrid, failed-device, results/financial-finalization,
   backup/restore, and director rehearsal by September 18.
3. Complete the source-versioned automatic Main/Consolation MRP proof in the
   rehearsal, retain director-reviewed finalization, and do not invent Q-pool
   or payout formulas.

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
| Event styles, game-count options, sanctioning fields, role vocabulary, and rotation-exception sources | Complete for the defined operations — the 2019 Manual/2025 Rulebook drive fixed outcomes; mixed rotations use a validated, audited director-entered correction because no automatic pairing is prescribed | 2026-09-14 |
| MRP, Q-pool, payout, and reporting-source inventory | In progress — Codex must exhaust cached/public schedules and build fixtures before requesting any missing current-effective confirmation | 2026-09-16 |
| Rule-to-code traceability, positive fixtures, and rejection/edge-case fixtures | Implemented for Standard Singles and supported two-person Traditional/Canadian Doubles; final dated evidence reconciliation remains | 2026-09-17 |

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
