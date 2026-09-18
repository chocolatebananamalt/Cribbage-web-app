# Engineering handoff: Tournament workflow streamlining and live Judge Calls

**Audience:** Luke or another repository-connected engineering agent
**Scope:** Pull request containing migrations 0211–0214 and the accompanying
Tournament Setup, workspace navigation, role, and transient Judge Call code.
**Instruction:** Verify the repository and deployed behavior. Do not infer that
the owner's entire seven-phase product vision is complete merely because this
PR passes its automated suite.

## What this change actually implements

### Tournament Setup consolidation

- Combines the ACC sanctioning-fee running total and rate adjustment controls.
  Main and Consolation rates are read-only until their individual Adjust action
  is chosen; only one can be edited at a time; saving requires a reason; Start
  Play locks further changes.
- Adds required State/Territory plus an IANA time-zone selector. Migration 0214
  enforces the application boundary in PostgreSQL, including the no-DST and
  territory mappings for Arizona, Hawaii, Puerto Rico, U.S. Virgin Islands,
  American Samoa, Guam, and Northern Mariana Islands.
- Moves Co-Director, Cross-Checker, and Judge management beneath Tournament
  Setup. Each role supports up to 12 pending/active people. Nomination requires
  first name, last name, exact email, and adult/youth ACC number. Authority is
  granted only after exact-email secure sign-in; role removal is immediate and
  history remains.
- Removes ordinary workspace menu entries for Officials and Cross-Checker
  assignments; legacy URLs redirect to their Setup management pages.
- Adds capability-based access projection (`roles`) while preserving the
  legacy highest-priority display role.

### Tournament workspace phases

- Groups the protected Tournament workspace into five visible director phases:
  Setup; Registration and payments; Check-in and seating; Cross-check and
  recovery; Results and reporting.
- Accurately states that multiple event check-in windows can be open
  independently.
- This is navigation/layout consolidation. It does not replace the underlying
  protected workspaces or change their data authority.

### Transient live Judge Calls

- A participant in their current started Singles or supported team game can
  call Judges from the score-entry interface.
- Judge-role users see the live Judge Desk. The first two non-playing Judges
  may accept. A Judge who is playing in the affected game is rejected. A third
  accept is rejected after two assignments.
- Either assigned Judge can press **Situation Resolved**; the transient call is
  deleted and disappears for all Judges.
- The call stores no question, ruling, score, correction, or financial data.
  It creates no operation receipt or audit/ruling history. Players remain the
  only people who record the resulting game score. A third Judge, if needed,
  is summoned verbally. The permanent discrepancy/correction workflows remain
  separate and unchanged.

## Database changes already applied

- `0211_setup_official_management_timezones_and_fee_controls.sql`
- `0212_transient_judge_calls.sql`
- `0213_transient_judge_call_integrity.sql`
- `0214_setup_state_timezone_integrity.sql`

All four are applied to both the disposable validation project
`donfxulkliuyteiannir` and the rehearsal/pilot project
`fnjkwymxpnsqvxtpronk`.

The first disposable attempts caught two atomic failures before the rehearsal
database was touched: 0211 tried to rewrite immutable Setup history, and 0212
contained a trailing table-definition comma. Both were corrected. Existing
Setup history is now preserved, and old revisions remain readable with an
empty State/Territory until a deliberate new revision is saved.

`tests/transient-judge-calls.sql` passed transactionally against both hosted
projects and rolled back. Counts before and after on the rehearsal project
remained three tournaments, seven events, and zero active Judge Calls.

## Security boundaries to re-check

- `app.active_judge_calls` has RLS enabled and forced.
- `anon` and `authenticated` have no direct table privileges.
- Judge Call RPCs are executable only by `service_role`; HTTP routes verify the
  signed-in subject, tournament membership, origin, UUIDs, and exact JSON.
- Setup official mutations are primary-director-only. Co-directors can view
  official summaries but cannot add/remove/restore officials.
- A nomination does not enroll a player and does not grant authority until the
  exact invited email signs in.
- Never add ruling text or score-writing capability to the Judge Call path.

## Automated evidence at handoff

- Focused tests: 10/10 passed.
- `pnpm verify`: passed, including dependency audit, lint, 561 application
  tests, provider readiness, TypeScript/optimized Next.js build, workspace and
  recovery integrity.
- `pnpm verify:handoff`: 6/6 passed.
- Hosted rollback Judge fixture: passed on disposable and rehearsal projects.
- Direct hosted permission check: `authenticated` cannot execute
  `open_live_judge_call_v1`; `service_role` can.

Re-run:

```text
pnpm verify
pnpm verify:handoff
```

Then execute `tests/transient-judge-calls.sql` inside a transaction against a
disposable Supabase project that has all migrations through 0214.

## Required manual/independent-session verification

These remain unproven by static tests and must not be marked complete without
evidence:

1. Primary director adds one Co-Director, Cross-Checker, and Judge; email
   provider accepts delivery; exact-email sign-in activates each role; wrong
   email and expired invitation fail; removal immediately removes authority.
2. Verify invitation expiry is midnight after the configured local tournament
   end date in Hawaii, Arizona, a DST-observing state, and one U.S. territory.
3. On phone and desktop, verify the combined fee panel, State/Territory and
   Time Zone selectors, compact official summaries, Add/Remove screens, and
   phase-grouped workspace have no clipping or horizontal overflow.
4. Use independent player and Judge sessions on a started Singles game:
   player calls; player/Judge conflict rejects; exactly two Judges accept;
   other Judges see two assigned; assigned Judge resolves; every device loses
   the call.
5. Repeat the same Judge Call sequence on a supported two-person team game.
6. Confirm that a Judge resolution creates no score, correction, ruling,
   operation receipt, or audit record and that the players can subsequently
   enter the score normally.
7. Review Production runtime logs after those flows.

## The owner's broader seven-phase streamlining vision: gap matrix

This PR is a foundation, not completion of the full vision.

| Product phase | State after this PR | What still needs design/implementation or proof |
| --- | --- | --- |
| 1. Grant TD permission | Existing director application/owner approval foundation remains. | ACC-website click-through integration and its email handoff are external/unimplemented. |
| 2. Set up tournament | Setup consolidation, time zones, officials, events, pools, scoring choices, QR lifecycle, fee controls exist in separate mature paths. | End-to-end 20-minute usability rehearsal and paper-only tournament configuration proof. |
| 3. Registration | QR/manual/CSV, duplicate protection, withdrawal/reinstatement, cash/check evidence exist. | Requested Venmo/Zelle/custom method semantics and online payment remain outside the October provider gate; deletion stays correctly non-destructive. |
| 4. Event-day check-in | Event-specific rotating QR, five-minute completion session, desk flow, enrollment/payment gates exist. | Simultaneous-event exclusivity policy, playoff check-in QR, side-pool changes during check-in, safe close/reopen UX, and complete all-registrants/no-show close gate need implementation/proof. |
| 5. Begin Event | Explicit event Start Play and verified-only preliminary standings exist. | Global pause/resume, equal-games-played leaderboard projection, automated end-of-digital-play notice, and explicit Close Event → cross-check transition remain incomplete. |
| 6. Cross-checking | Paper/hybrid evidence, corrections, disputes, cross-checking, qualification and result paths exist. | A single Finalize Cross-Checking orchestration, automatic playoff creation, Consolation eligibility across configured playoff rounds, and Consolation offer/payment loop require further work and authoritative fixtures. |
| 7. ACC reporting | Event PDFs/exports, Main/Consolation MRP work, Satellite no-MRP reporting and financial reports exist. | Approved ACC API submission remains external; production reports still need full rehearsal acceptance. |

## High-risk review targets

- Do not relax two independent submissions plus two confirmations for Digital
  scoring.
- Do not let a Judge, director, or cross-checker write a player's live score.
- Do not add browser grants to private `app` tables or service-only RPCs.
- Do not reinterpret blank historical State/Territory values or mutate old
  Setup revisions.
- Do not claim an official invitation was sent unless the provider confirms
  acceptance for delivery.
- Do not claim the broad workflow simplification complete until every gap in
  the matrix has code plus independent-session evidence.
