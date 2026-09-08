# Product Requirements

> **Normative baseline:** [production-requirements.md](production-requirements.md) is the authoritative, self-contained production requirements document. This file remains the traceability summary and historical source map; when a summary line and the normative document differ, the normative document and its cited decision/source control.

Status: recovered baseline v1.1 plus user-approved product decisions through 2026-09-07. See source-documents/ACC_Digital_Tournament_System_Specification_v1.1_EXTRACTED_TEXT.txt and matching DOCX/PDF. It retains the v1.0 title and adds sections 31-43. Historical ACC-confirmed labels still need current verification.

Precedence: current user decisions and verified current ACC rules; v1.1 specification; v1.3 prototype as illustration; older mockups as history. Flag contradictions.

| ID | Requirement group | Source sections | Current status |
|---|---|---|---|
| ACC-01 / R-REG-01 | ACC identity/profile, private PIN/reset, registration/check-in and shared-tablet clearing | 3-6 | Design only |
| ACC-02 / R-ROLE-01 | Per-tournament server-enforced roles, judge isolation, no self cross-check, hidden standings | 7,9,17,23-25 | Visual demo |
| ACC-03 / R-OPS-01 | Physical table geometry, anchors, approved family restrictions, rotation/sit-outs, disputes, and Consolation eligibility | 8,10 | Rules unresolved; official schedule/eligibility gated |
| ACC-04 / R-VERIFY-01 | Two reciprocal independent entries AND two distinct eligible confirmations before atomic verification | 12-13 | Missing |
| ACC-05 | Hybrid/dead-phone handoff with opponent authentication; distinguish method | 14-15 | Scripted hybrid only |
| ACC-06 / R-OFFLINE-01 | Authenticated pending queue, reconnect, duplicate/replay protection; authoritative server verification | 16 | Missing |
| ACC-07 / R-SCORE-01 | Paper-style scrollable scorecard: game points, separate plus/minus columns, opponent full name and Table/Seat; canonical per-card lines linked to a match; verified-only derived totals | 11-12,26; user decision 2026-09-06 | Partial demo; redesign approved |
| ACC-08 / R-CORR-01 | Cross-check corrections retain actor, timestamp, and old/new values; explicit Pending/Applied state; reason and second approval are director-configurable, optional by default | 17,23,25; user decision 2026-09-06 | Mock screens |
| ACC-09 / R-FINAL-01 | Cross-check gate, ranking/ties, qualification/byes, Consolation eligibility, and event finalization | 18-19 | Missing |
| ACC-10 | Separate Main/pool ledgers, versioned MRP/payout rules, reconciliation | 20-22,36-38 | Static demo |
| ACC-11 | Guided creation, configuration-only duplication, feature dependencies/readiness | 31-35,40-42 | Mostly missing |
| ACC-12 / R-FLYER-01 / R-FIN-01 / R-ATTACH-01 / R-EXP-01 | Manual expense/attachments, reviewed extraction, flyer/QR, configurable satellite events, Muggins disclosure, signed-in results, financial tracking, and internal director-assisted export | 36-40; user decision 2026-09-06 | Mock screens |
| ACC-13 | Large type, contrast, keyboard access, mobile/tablet/desktop and older-player usability | 26,41-42 | Needs user/browser tests |

## Confirmed scoring, scorecard, and accessibility decisions

- Players enter a positive game margin from 1 through 121 using a large, high-contrast on-screen number keypad. The normal keyboard remains available on desktop. The winner/loser choice determines whether the margin is recorded in Plus Points or Minus Points.
- The scorecard mirrors the familiar paper-card layout. It contains Game Number, Game Points, Plus Points, Minus Points, opponent first and last name, and Table/Seat (for example, `A-7`). Opponent initials are removed.
- A normal win earns 2 game points; a loss earns 0; any skunk-level result earns 3. The official ACC rule is a skunk at a win of 31 or more points. Single/double/triple skunk icons are an optional player-facing, non-official visual distinction and never alter official scoring or records.
- Current ACC qualifying order is game points, games won, net point spread, plus points, head-to-head (when available), then a one-game playoff. Minus points support net-spread calculation and cross-checking but are not an additional tie-breaker.
- Cross checkers may correct paper or digital cards other than their own. Corrections use a signed plus/minus control, preserve the prior verification, prior value, editor, and timestamp, and recalculate dependent totals immediately by default without player reconfirmation. A reason is available and optional by default; tournament directors can require a reason and/or an additional cross-checker or director approval, in which case the correction remains pending. Corrections to published results create a new result version.
- The judge experience includes an in-app searchable quick reference and a link to the dated official ACC rulebook. Cached offline access is preferred but not required.
- Score Entry presents the tournament context (name, city, date, and event), `Game Result`, `Game Winner:`, and the large Spread Points keypad on one screen. Once both values are present, it previews both cards: winner/loser wording, each player’s Game Points, and reciprocal signed Spread Points. The appropriate player-facing skunk aid appears alongside the entered spread.
- The digital scorecard keeps the familiar 12-game paper-card hierarchy without copying it exactly: player name followed by ACC number, Table/Seat in the card header, current `Game n of 12`, opponent name, grouped `Game` (#/Points), grouped `Spread Points` (+/-), `Opponent`, and grouped `Verification` (ID #). It displays Games Won, but does not display initials, a loss-count field, or `Checked by` to the player.
- After registration closes and seating is assigned, digital players receive their Table/Seat in the app. The director, co-director, and authorized administrative staff need a printable/viewable paper-player seating list so that Table/Seat values can be written on and distributed with paper cards. SMS delivery is a future optional notification channel only after consent, a provider, and message-delivery/error requirements are approved; it is not an assumed fallback.
- The format-review prototype presents a `Current Game Results` screen and a separate `Review Current Game Result` screen. The review screen is a player-facing confirmation step; production submission continues to require the previously specified independent two-player verification workflow and must never treat a single review as authoritative.

## Confirmed event, flyer, results, and financial decisions

- Rename the existing Reserve Fee label to **ACC Sanctioning Fee**; its amount behavior is otherwise unchanged.
- Flyer creation supports Main, Consolation (with the familiar display name "Consy"), and a dedicated Satellite Events section. Directors can select a standard event type or create a custom event, with name, date/time, format, game count, fees, pools, payout/qualifying details, eligibility notes, and a Muggins-in-effect disclosure.
- Main and Consolation support up to two Q-pools with the ACC portal's current equal, equal-with-top-qualifier-double, and graduated payout options. Exact payout and rounding fixtures remain subject to current ACC approval.
- A post-event Results page is visible by default to signed-in app users with results-view permission and includes every paid placement with amount per player, winner, runner-up, high non-qualifier, and Master Point qualifiers for each event. The high non-qualifier uses a source-backed approved fixture and includes the final qualifier tie-playoff loser where applicable. Non-singles results are visibly marked manual/imported, never digitally scored until an approved ruleset exists. Results feed financial reconciliation and produce an internal, versioned director-assisted export (`acc-results-v1`) for manual portal submission; it is not an ACC portal import format. Anonymous access and automatic ACC submission require separate approval/contracts.

## Rule register

Verified 2026-09-06:

| Topic | Current source and implementation rule |
|---|---|
| Game points and scorecard corrections | [ACC Official Tournament Rules 2025](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf), rules 12.1-12.2: normal win 2, skunk 3, loss 0; cross-check discrepancies require adjusted game and spread totals. |
| Qualification tie breaks | [ACC Official Tournament Rules 2025](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf), Cross-Checking Guidelines item 20: game points, games won, net point spread, plus points, head-to-head, then one-game playoff. |
| Playoff qualification | [ACC Official Tournament Rules 2025](https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf), rule 13.2: one in four entrants qualifies, with any fraction rounded up. |

Still require dated authoritative fixtures and approval: rotation, anchors/sit-outs, Main/Consolation timing, Q-pool and payout rounding, MRP tables/byes, lateness/forfeits, family restrictions, membership integration access, and any ACC portal import format. Do not use unapproved calculations for sanctioned results.

## Proposed pilot

Simulated 20-30 person event: manual registration/payment status, verified seating plan, digital/digital and hybrid scoring, disputes, cross-checking, result export, separate ledgers, and approved flyer/event configuration. Online payment processing and receipt AI remain deferred. Confirm scope with Daron/director before implementation commitments.
