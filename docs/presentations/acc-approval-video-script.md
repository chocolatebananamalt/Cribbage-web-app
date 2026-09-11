# ACC Tournament Desk — Board and Technical Approval Video

**Target running time:** about 5 minutes  
**Audience:** ACC Board, VP of Operations, membership/database owners,
tournament commissioners, and technical staff  
**Purpose:** Demonstrate the intended tournament workflow and request the
minimum approvals and integration access needed for a limited pilot.

## Recording guidance

- Read at a calm pace of about 125–135 words per minute.
- Use the public synthetic demonstration only. Do not display real player
  records, private portal pages, credentials, or production administration
  screens.
- Keep the mouse still while speaking. Click only at the cues below.
- The persistent “Public Demonstration · Sample Data Only” banner should
  remain visible at the beginning so reviewers understand the boundary.
- Describe planned production behavior as “the production design” or “the
  proposed pilot,” not as already completed functionality.

## Teleprompter script

### 0:00–0:20 — Purpose

**On screen:** Open the public demo on the Score Entry screen. Pause before
clicking anything.

Hello, and thank you for reviewing the ACC Tournament Desk. This demonstration
uses sample data only. The app is intended to reduce tournament paperwork and
duplicate entry while preserving the ACC’s authority over membership,
sanctioning, official rules, Master Rating Points, and historical records. I
am requesting approval for a limited supervised pilot and a narrow, supported
ACC integration.

### 0:20–1:05 — Game entry and independent verification

**On screen:** Select “Demo Player won.” Enter `88`. Pause on the derived
result and double-skunk graphic. Click **Review Result**.

The player selects the winner and enters the spread points. The app derives
the game points and reciprocal spreads, allowing both players to review what
will appear on their cards. The skunk graphic is only a player-friendly aid;
official scoring follows approved ACC rules.

The production design requires independent entries and confirmations from
both players. One phone cannot verify a game by itself. Matching entries,
confirmations, role restrictions, and an audit trail are enforced by the
server.

### 1:05–1:35 — Familiar scorecard and resilient records

**On screen:** Click **Scorecard**. Slowly point to Game Points, positive and
negative Spread Points, Opponent Name, Verification ID, and totals.

The scorecard keeps the familiar paper structure while calculating totals
consistently. The proposed pilot stores offline entries until service returns,
but never labels them verified before synchronization. If a phone fails,
synchronized opponent records or paper evidence can reconstruct the card
through an audited cross-check process.

### 1:35–2:20 — Operations and paper compatibility

**On screen:** Click **Operations**. Briefly highlight Set Up Tournament,
Players & Check-In, Seating, Cross Check, Judge Desk, Events and Flyer, and
Financials. Open **Set Up Tournament** for several seconds, return to
Operations, and open **Cross Check**.

Directors enter the tournament, event, fee, pool, venue, and official details
once. Those facts support registration, operations, flyers, results, and an
ACC-ready submission package. Players can register by QR code or web address;
after registration closes, the app assigns starting seats and provides
searchable check-in and seating lists.

Paper remains supported. Cross checkers compare digital and paper records and
may correct another person’s card while the system preserves the original
value, editor, and timestamp. Paper-card photography remains off until the ACC
approves its retention and access rules.

### 2:20–2:55 — Results, money, and reporting

**On screen:** Click **Results**. Point to Main, Consolation, and Satellite
event groups. Do not imply that sample totals are official.

One tournament contains its main, consolation, and satellite events. Using
dated ACC-approved rules, the production workflow will calculate standings
and qualifiers, track Q pools, payouts, expenses, and MRPs, and prepare a
director-reviewed results package. Nothing is described as submitted or
official until the approved ACC process confirms it. Manual portal entry can
remain the pilot fallback.

### 2:55–3:15 — Rules at the point of use

**On screen:** Click **Rulebook**. Point to Quick Reference Search, ACC
Rulebook Cached, and ACC Rulebook Online.

The current rulebook and searchable quick reference remain available inside
the app. Every scoring, qualification, and payout rule is tied to a dated
source and test. A later rule change cannot rewrite a completed tournament.

### 3:15–4:45 — Exact technical and operational request

**On screen:** Replace the app view with a clean title card reading
“Requested ACC Decisions and Technical Access.” Reveal the five numbered
items as they are spoken.

I am requesting five specific decisions.

First, written approval for a supervised pilot using the electronic scorecard,
verification record, correction history, and results package as approved
tournament operational records.

Second, a supported read-only member-verification method—ideally an API, but
an approved import service could work. A lookup by ACC number should return a
stable member ID, official name, membership status, and only ACC-authorized
contact fields through a scoped service account, never direct database access.

Third, guidance for contact changes. I recommend no ACC write access initially.
The app can store a tournament-specific address or phone while leaving the ACC
record unchanged. The ACC may later choose a reviewed update request or a
narrowly scoped, audited endpoint.

Fourth, a supported sanctioning and results exchange: documented API endpoints
or an approved import format, plus a sandbox, test records, scoped credentials,
field definitions, retry rules, and a stable ACC tournament ID. Until then,
we will use director-reviewed export and manual entry.

Fifth, confirmation of current event, qualification, MRP, Q-pool, payout,
role, and paper-record retention rules.

### 4:45–5:05 — Close

**On screen:** Show a final title card: “Proposed next step: limited supervised
pilot · read-only membership verification · director-reviewed ACC submission.”

I am not asking for unrestricted database access or to replace ACC systems.
I am asking for technical and operational contacts, the minimum approved data
interface, and agreement on pilot records and rules. We can then integrate
against test data, demonstrate reconciliation and rollback, and return for
final approval before live use. Thank you.

## Shot list for video assembly

| Time | Visual | Action |
| --- | --- | --- |
| 0:00–0:20 | Score Entry overview | Hold still; preserve public-demo banner. |
| 0:20–1:05 | Score Entry and Review Result | Select sample winner, enter 88, pause on double skunk, open review. |
| 1:05–1:35 | Scorecard | Slow pointer movement across headers and fixed totals. |
| 1:35–2:20 | Operations, Setup, Cross Check | Show the operations map, setup fields, then cross-check queue. |
| 2:20–2:55 | Results | Show event group structure only. |
| 2:55–3:15 | Rulebook | Show cached, online, and quick-reference choices. |
| 3:15–4:45 | Technical request title card | Reveal five requests one at a time. |
| 4:45–5:05 | Closing title card | Hold for the full closing statement. |

## Approval checklist shown on the technical title card

1. Approve a supervised digital-record pilot.
2. Provide or approve read-only membership verification.
3. Choose how player contact changes should be handled.
4. Provide an API/import path and sandbox for sanctioning and results.
5. Confirm authoritative rules, roles, payouts, and retention policy.

## Minimum technical access request for follow-up discussion

### Required for the preferred integration

- A non-production sandbox or test environment.
- A scoped service identity; no shared staff password and no direct database
  login.
- A read-only member lookup contract keyed by normalized ACC number.
- ACC-approved response fields and masking rules. Candidate fields are stable
  member ID, ACC number, official display name, active/current membership
  status, and—only if approved—address, telephone, and email.
- Documentation for authentication, authorization, rate limits, error codes,
  availability expectations, versioning, and deprecation.
- Synthetic or expressly authorized test-member records.
- A stable ACC tournament/sanction identifier and supported results handoff,
  either through API endpoints or an import schema.
- Idempotency/reconciliation rules so retries cannot duplicate members,
  tournaments, results, payouts, or MRPs.
- Named ACC technical and operational contacts for sandbox issues, schema
  changes, and result reconciliation.

### Recommended initial boundary

- Read ACC membership identity and status only.
- Do not write contact changes into the ACC system.
- Store a player-authorized tournament contact override separately in the app.
- Generate a director-reviewed sanctioning/results package for manual ACC
  entry until an automated interface is approved and tested.
- Keep the ACC authoritative for membership, sanctioning, MRPs, approvals, and
  historical records.

## Items deliberately not requested in the first meeting

- Direct access to ACC database tables.
- Administrator credentials or a shared portal password.
- Unrestricted write permission to member records.
- Automated portal browser control.
- Immediate nationwide replacement of existing ACC systems.
- Live paper-card OCR before the ACC approves image handling and retention.

## Public sources supporting the discussion

- ACC Tournament Director Resources:
  `https://www.cribbage.org/NewSite/sched/tournament_dir.asp`
- ACC Schedule and Results:
  `https://www.cribbage.org/NewSite/sched/default.asp`
- ACC Rules:
  `https://www.cribbage.org/NewSite/rules/default.asp`

These public pages confirm the ACC's existing sanctioning, tournament-resource,
schedule/results, scorecard, MRP, and payout materials. They do not document a
public membership, sanctioning, or results API; the presentation therefore
asks the ACC to identify the supported interface rather than assuming one.
