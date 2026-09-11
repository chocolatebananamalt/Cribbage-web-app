# ACC Tournament Desk — Working Outline

**Last updated:** 2026-09-10

**How to ask for this:** `Show Outline`
**Planning baseline:** This is a living delivery tracker, not a promise that
an unverified feature is ready. Estimates assume prompt decisions, continued
access to the current Vercel/Supabase projects, and no newly discovered ACC
rule conflict. Any item that needs a real director decision or real-world test
shows that dependency explicitly.

## Completion forecast

| Target | Earliest realistic date | What must be true |
| --- | --- | --- |
| Protected pilot workflow ready for supervised testing | **2026-10-16** | Core workflows, paper/digital handling, and preliminary results/finance work in a non-public pilot; not yet a public launch. |
| Production-readiness evidence complete | **2026-11-13** | Independent-user, accessibility, recovery, security, simulated-tournament, and director-acceptance evidence pass. |
| First monitored production event | **After 2026-11-13** | Director approves the pilot, ACC rule/recording fixtures are approved, and production hosting/operations are signed off. |

These dates are intentionally conservative. The most likely reasons they move
are ACC fixture/portal clarification, decisions about OCR storage and payment
processing, or defects found in real multi-person and venue testing.

## Working steps

| # | Step and definition of done | Status | Completed / estimated date | Current evidence or dependency |
| --- | --- | --- | --- | --- |
| 1 | **Requirements and design baseline.** Approved score entry, paper-style scorecard, roles, corrections, seating, event/flyer, results, finance, how-to, and paper-capture requirements are traceable and conflicts are recorded. | Complete | **2026-09-10** | `docs/product/production-requirements.md`, decisions, reviewed prototype. Official rules remain versioned inputs, not assumptions. |
| 2 | **Secure platform foundation.** Protected Vercel Preview, private Supabase schema/RLS boundaries, server-only routes, audit receipts, and safe registration-link lifecycle exist. | In progress | **Estimated 2026-09-17** | The shared pilot is now current through migration 0105, and post-apply proof confirms that all seven suspended Rule 12 correction RPCs have no browser-role execution grants. Registration issue/rotate/close protections and atomic registration close are deployed to the pilot. The role-gated QR-registration workspace renders one-time fragment links locally without browser persistence; director management and public claims use distinct default-off gates. Remaining proof is real races, independent sessions, browser operation, production-scoped Vercel values, and real-address magic-link delivery. |
| 3 | **Core live tournament workflow.** Director setup, registration/check-in, closure, seating and table-plan exceptions, event enrollment, two-player independent scoring/confirmation, corrections, judge/cross-check queues, and official ACC fixtures operate server-authoritatively. | In progress | **Estimated 2026-09-30** | Foundations exist for setup, check-in, seating, enrollment, scores, and a director-facing registration-close control. The preliminary correction writer is now deliberately suspended: Rule 12.2 can require non-reciprocal individual card corrections, which the current shared-result model cannot represent. Replacement modeling, fixtures, operational completion, and real multi-user execution remain. |
| 4 | **Connected hybrid and paper-card workflow.** Shared/dead-phone handling; paper/digital guidance; restricted paper-card camera capture, human-reviewed transcription, comparison, and exception-only cross-check queue. Offline scoring is deferred and does not block the connected-first release. | In progress | **Estimated 2026-10-16** | Paper-card capture and verification contracts exist, but the connected camera/storage/review flow and real card tests do not. The offline-queue contract remains a safe future foundation; no offline interface will be enabled for the initial connected release. |
| 5 | **Results, finance, ACC reporting, and finalization.** Rule-backed standings/tie-breaks, Q-pools/payouts, result versions, financial reconciliation, all configured events, ACC-ready exports, and finalization safeguards. | Not started | **Estimated 2026-10-30** | Requires dated ACC fixtures and portal/export confirmation. No mock total may become an official result. |
| 6 | **Minimum release wiring and accessibility.** Correct Preview/Production connections, private server settings, a basic backup/restore and rollback path, basic error reporting, and phone/desktop/zoom accessibility evidence. | Not started | **Estimated 2026-11-06** | Hosting projects exist. The release needs correct Production values, one proven backup/restore, one rollback drill, basic failure visibility, and real accessibility evidence. A custom domain and enterprise security tooling are not launch blockers. |
| 7 | **Supervised tournament simulation and approval.** 20–30 person simulation covering digital/digital, digital/paper, paper/paper, offline/reconnect, corrections, seating exceptions, results, finance, export, and director acceptance. | Not started | **Estimated 2026-11-13** | Requires a real director-approved simulation and successful issue resolution. |
| 8 | **Production launch and first-event monitoring.** Promote only the verified build, publish the approved domain, monitor the first event, and retain a rollback path. | Not started | **After 2026-11-13** | Requires completion and evidence from Steps 1–7; no automatic date is safe until then. |

## Current highest-priority work

1. Wire tournament setup into real registration, check-in, seating, and
   score-entry operations now that the shared-pilot migration gap is closed.
2. Prove the complete two-player score flow in independent sessions and
   continue through corrections, standings, results, and finance.
3. Complete connected paper/digital operation before optional offline scoring,
   online payment processing, or other conveniences.

The owner-private, plain-language blocker dashboard is published at
<https://acc-tournament-production-readiness.chocolatebananamalt.chatgpt.site>.

The detailed rule/ACC decision split is maintained in
`docs/operations/ACC_RULE_CONFIRMATION_CHECKLIST.md`.

## ACC confirmation checklist

### Part A — Codex confirms from official ACC sources

| Confirmation | Status | Target |
| --- | --- | --- |
| Current Rulebook edition plus game-point, spread, scorecard, and cross-check fixtures | In progress | 2026-09-17 |
| Qualification order, playoff count, bracket, and bye fixtures | In progress | 2026-09-22 |
| Event styles, game-count options, sanctioning fields, flyer requirements, role vocabulary, and rotation-exception sources | In progress — public Director Resources/Policy Manual flyer inventory and odd-table extra-game exclusion are recorded, but no general automatic rotation fixture or current regional-form confirmation is available | 2026-09-24 |
| MRP, Q-pool, payout, and reporting-source inventory | In progress — public MRP/payout source inventory recorded; current-effective confirmation and Q-pool/payout fixtures remain | 2026-09-30 |
| Rule-to-code traceability, positive fixtures, and rejection/edge-case fixtures | Not started | 2026-10-02 |

### Part B — ACC/director confirmations needed

| Your checklist item | Status | Needed by |
| --- | --- | --- |
| Written approval to use the app as an official digital operational record | Waiting for ACC/director response | Before pilot acceptance of Step 3 |
| Approved ACC portal API, import, or director-reviewed export process | Waiting for ACC/director response | Before Step 5 |
| Current authoritative MRP, Q-pool, and payout schedules for supported events | Waiting for ACC/director response | Before Step 5 |
| Paper-scorecard image/OCR retention and access policy | Waiting for ACC/director response | Before Step 4 |
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
