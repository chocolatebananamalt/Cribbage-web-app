# ACC Digital Tournament System — Normative Production Requirements

**Document ID:** PRD-001

**Version:** 1.0

**Status:** Implementation baseline; unresolved ACC decisions are explicitly marked
**Decision baseline:** 2026-09-06 user-approved product decisions and current repository guidance

This document is the self-contained normative baseline for production work. “MUST” is release-blocking unless an approved decision record changes it. “SHOULD” is the default that may be changed only through a recorded product/technical decision. “MAY” is optional.

## 1. Authority, scope, and traceability

Precedence is: (1) current user decisions recorded in the decision log, (2) dated authoritative ACC rules and approved fixtures, (3) this document, (4) the recovered v1.1 specification, and (5) prototype/mockup behavior. A prototype is never evidence that a production requirement is satisfied.

The product is a full sanctioned-tournament suite: registration/check-in, role-based event operations, seating, score entry and verification, cross-checking, corrections, judge reference, flyer/event setup, results, financial reconciliation, and ACC-ready reporting. Delivery is staged for risk control; staging a capability does not remove it from the full product scope.

Every implementation requirement MUST have a source, decision date or effective rule date, observable acceptance criteria, and at least one passing and one rejection-path test. The traceability table below is the minimum index; detailed evidence belongs under `docs/quality/`.

The stable requirement IDs in this document (for example `R-SCORE-01`) are the canonical IDs used in issue titles, fixtures, automated tests, and release evidence. A requirement is not release-ready until its positive and rejection-path evidence is linked to the ID.

| Trace ID | Requirement/source | Decision or source date | Acceptance evidence |
|---|---|---:|---|
| TR-01 | Recovered v1.1 specification, sections 3–43; organized source files under `imports/acc-handoff-2026-09-05` | recovered 2026-09-05 | Requirements-to-test review; no private source served |
| TR-02 | User scorecard and scoring decisions: keypad 1–121, paper-style card, full opponent name, Table/Seat, 0/2/3 game points, friendly skunk icons | 2026-09-06 | Boundary tests, accessibility/browser tests, scorecard render evidence |
| TR-03 | User correction decision: non-self correction, append-only audit, immediate default authority, configurable reason/second approval | 2026-09-06 | Authorization, audit, correction-state and recalculation tests |
| TR-04 | User rules/reference decision: searchable quick reference plus dated official ACC link; offline preferred | 2026-09-06 | Source/version display and offline/fallback test |
| TR-05 | User events/results/finance decisions: standard/custom events, Q-pools, signed-in results, private finance, internal director-assisted export | 2026-09-06 | Export fixtures, reconciliation tests, publication/permission tests |
| TR-06 | ACC Official Tournament Rules 2025: Judge Protocols, Rule 10.1(b), Appendix A items 1–3, rules 12.1–12.2 and 13.2, plus Cross-Checking Guidelines item 20 as applicable | source reviewed 2026-09-06 | Dated approved fixtures; rule-source link shown in rule register |
| TR-07 | ACC read-only sanctioning portal review: Main, Consolation, Satellites, Templates, Side Pool Calculator | reviewed 2026-09-06 | Portal-shaped export validation; manual submission checklist |
| TR-08 | AGENTS.md and `docs/quality/VERIFICATION.md`: two entries/two confirmations, server roles, pending sync, audit, real backend | current repository guidance | Required integration/e2e/rejection and release-gate evidence |
| TR-09 | User paper-scorecard capture/OCR decision: scans accelerate cross-checking but do not replace independent verification | 2026-09-10 | Restricted capture/storage, human-review, comparison, and rejection-path evidence |
| TR-10 | Read-only ACC Director-portal findings and user-approved integration-first/replacement-ready strategy; no ACC records changed and non-Director roles remain unverified | 2026-09-10 | Director-reviewed package/manual portal handoff; automation and replacement gates remain explicitly disabled |

| Requirement ID | Normative requirement | Minimum positive test | Minimum rejection test |
|---|---|---|---|
| R-REG-01 | Registration, check-in, roster identity, tournament QR/link self-registration, manual-payment recording, shared-device clearing, and seating are server-scoped workflows | player uses a tournament QR code/link to submit registration; director resolves duplicates, records payment, checks in player, assigns Table/Seat, and a cleared shared device starts a new context | closed link, unauthorized role, duplicate identity, self-marked payment, stale shared-device context, or cross-tournament seating is rejected |
| R-ROLE-01 | Tournament roles and sensitive operations are server-authorized and tournament-scoped | permitted role performs its assigned operation in its tournament | cross-tournament, role escalation, or UI-only authorization is rejected |
| R-OPS-01 | Rotation, anchors/sit-outs, disputes, and Consolation eligibility are configured workflows gated by approved ACC rules | approved fixture produces a deterministic schedule/eligibility result | missing/unapproved rule fixture blocks official schedule, eligibility, or export |
| R-SCORE-01 | Margin, per-card lines, canonical match linkage, and derived scoring follow the scorecard rules; a one-digit per-game spread renders with a leading zero on the paper-style card | fixture records reciprocal plus/minus, 0/2/3 points, and `01`–`09` per-game rendering | invalid margin, conflicting match/card linkage, or client summary is rejected |
| R-VERIFY-01 | Digital and hybrid results require two independent submissions and two distinct confirmations | eligible actors complete both paths and server persists one verified result | same actor, duplicate/replay, pending sync, dead-phone transcription alone, or mismatch cannot verify |
| R-OFFLINE-01 | Offline queue is authenticated, scoped, idempotent, conflict-aware, and never server verification by itself | queued operation replays once after reconnect and is accepted by server | forged/stale scope, replay, tampered payload, or local success is rejected/held |
| R-CORR-01 | Corrections are append-only with explicit Pending/Applied state and configured standings/export effect | permitted non-self correction records old/new values and applies default policy | self-correction, unauthorized editor, or unapproved pending correction changing standings/export is rejected |
| R-RULE-01 | Judge and cross-check protocol is source-backed, capacity-safe, and non-self-disputing | eligible judge/cross-checker handles a valid dispute within capacity | self-dispute, over-capacity assignment, or uncited rule decision is blocked |
| R-BOUND-01 | Standard singles is the first digital scoring boundary; team/doubles/Canadian Doubles require an approved ruleset | singles scores end-to-end; flyer/export represents other formats as configured | app cannot claim digital scoring for an unapproved format |
| R-RET-01 | Retention defaults to restricted hold/no automatic purge until policy approval | authorized deletion/hold and backup/restore are audited | automatic purge, unauthorized deletion, or restore without integrity check is rejected |
| R-EXP-01 | `acc-results-v1` is an internal director-assisted export pending an ACC golden contract | valid artifact downloads with schema/version and checksum | only export-specific unknowns block export; portal import/API is never claimed |
| R-FIN-01 | Finance/reporting compliance gates reconcile fees, sanctioning fee, Q-pools, payouts, expenses, attachments, and required results | reconciled ledger matches approved result version and report | unreconciled money, missing required report field, or private-data leak blocks release/export |
| R-FINAL-01 | Event finalization requires configured verification, dispute, finance, results, and director approval gates | complete event transitions through reconciliation to approved/final | unresolved dispute, unverified score, unreconciled ledger, or missing approval blocks finalization |
| R-FLYER-01 | Flyer builder captures event formats, disclosures, payouts/qualifiers, and satellite details | approved flyer renders configured event information and Muggins disclosure | missing required disclosure or unsupported format claim blocks publication |
| R-ATTACH-01 | Attachments are classified, access-controlled, retained, and linked to event/ledger/result records | allowed attachment is classified and auditable | unsupported type, oversize/private-source upload, wrong role, or unclassified financial evidence is rejected |
| R-UX-01 | Friendly skunk bands, signed-in audience, cache permission, and measurable accessibility targets are explicit | icons and accessible scorecard pass phone/desktop checks | unofficial labels presented as ACC rules, anonymous access, stale/unpermitted cache, or accessibility failure is rejected |
| R-GUIDE-01 | Brief in-app Start Here / How To guidance supports players and directors, prioritizing the hybrid paper/digital score flow | assigned player can open plain-language hybrid guidance at score entry; director guidance covers check-in, seating publication, and exceptions | guidance cannot claim a paper transcription, one entry, or one confirmation is verified |
| R-SCAN-01 | Authorized paper-scorecard capture and OCR accelerate cross-check comparison without creating verification authority | an authorized cross checker captures, reviews, and compares one or two paper cards against their assigned game | self-card capture/review, unlinked/low-confidence scan, unauthorized image access, OCR-only verification, or silent overwrite is blocked |

## 2. Product boundary and release stages

The full product remains the target. The staged delivery sequence is:

1. **Foundation:** Next.js/TypeScript App Router PWA, Supabase schema/RLS/auth, Vercel staging and production configuration, environment contract, audit primitives, and observability.
2. **Vertical slice:** authenticated two-player game, independent score entries, two distinct confirmations, atomic server verification, audited scorecard, and rejection/concurrency tests.
3. **Event operations:** roster/import boundary, roles, seating/table identifiers, digital/digital and hybrid/paper workflows, corrections, judge reference, offline queue/conflict handling.
4. **Tournament suite:** flyer/event builder, Main/Consolation/Satellite/Q-pool configuration, finance ledger/reconciliation, signed-in published results, and versioned internal director-assisted export.
5. **Pilot/release:** simulated 20–30 person tournament, independent sessions against a real test backend, accessibility/browser checks, backup/restore and rollback drills, director approval, then supervised real-event pilot.

The vertical slice and pilot are validation gates, not a reduced definition of the sanctioned product. Online payment processing and automatic ACC portal submission are explicitly out of the first release: payments are manual, and ACC submission remains director-led until ACC provides a supported API/import contract.

### 2.1 ACC authority and integration boundary

The first pilot is **integration-first and replacement-ready**. This app owns pilot live operations, while the existing ACC system remains authoritative for sanctioning, the official schedule, membership/Master Rating Points, approvals, and historical records. The first supported handoff is a validated, versioned, director-reviewed ACC package followed by manual portal entry. Generation of that package MUST NOT be displayed or recorded as ACC submission, acceptance, or publication.

Credential-based portal automation and automatic ACC submission are out of scope and MUST remain disabled. A future automated connection requires an ACC-authorized API/import contract, sandbox or service identity, documented idempotency and reconciliation, and written approval. A full ACC-system replacement additionally requires formal sponsorship, verified commissioner/statistician/administrator workflows, official data specifications, historical migration, security/privacy/support/disaster-recovery governance, nationwide parallel validation, and approved cutover/rollback. See `docs/decisions/2026-09-10-acc-integration-first-replacement-ready.md`.

## 3. Identity, authentication, and roles

- Account authentication MUST use email magic links.
- A permanent 4-digit PIN MAY be used only for check-in, shared-device confirmation, or the in-game/hybrid confirmation context. It MUST NOT be an account-login credential, password substitute, or role grant.
- Tournament roles MUST be server-enforced and scoped to the tournament: director, co-director, player, cross checker, judge, and read-only/public viewer as applicable.
- A user MUST NOT cross-check or correct their own card.
- Hidden standings, private finance, roster identity, and draft scores MUST be protected by server authorization and database policy, not UI hiding.
- ACC membership/API integration is an adapter boundary and remains disabled until ACC access and contract are approved. Director-managed roster import is the baseline.

Role checks MUST be enforced on the server/database boundary for every read and mutation, including offline replay. A client-visible role, shared-device PIN, cached route, or hidden button is never authorization. `R-ROLE-01` is the direct test mapping for role scope, least privilege, cross-tournament denial, self-check denial, and sensitive-data boundaries.

### 3.1 Registration, check-in, shared devices, seating, and event operations

The full suite MUST include these bounded workflows; they are not deferred by the staged delivery plan:

- **Registration/roster:** a director or authorized co-director creates a tournament roster or imports a director-owned roster. Each player has one tournament-scoped identity, with duplicate ACC number/email/name collisions held for review rather than silently merged.
- **Tournament QR/link registration:** a director may publish a unique, non-guessable URL and matching QR code on a tournament flyer. It identifies the tournament only; it grants no role or private data access. A player may submit their own registration while registration is open. The server holds duplicate or conflicting identity claims for director review rather than automatically enrolling, seating, or charging a player. The bearer secret is fragment-only and reaches only the same-origin application endpoint; that endpoint computes a fixed-length digest in server memory and sends only the opaque link ID and digest to Supabase. Raw bearer values must never appear in a path, query string, RPC argument, database record, audit field, browser storage, or telemetry.
- **Manual payment status:** initial release has no online payment processing. A registrant may state an intended method such as cash or check, but that is never proof of payment. Only an authorized director or co-director may record a private, audited payment status, amount, method, received time, and responsible actor. A player cannot mark themselves paid. A later payment provider must create a separately reconciled ledger record and cannot bypass roster review or registration.
- **Check-in:** an authorized director marks a roster entry checked-in, withdrawn, late, or absent. A player cannot self-assign a role, tournament, or seat. Check-in changes are audited.
- **Check-in lookup:** an authorized director/co-director workspace MUST provide a tournament-scoped player-name search that returns current attendance state and scorecard type, gives an explicit no-match result, and grants no additional roster visibility or mutation authority.
- **Shared-device clearing:** a shared tablet/phone session MUST have an explicit “clear player/context” action. Clearing removes local identity, draft score, and cached private data; the next player must authenticate or use the context-only PIN flow. A stale or uncleared context MUST block check-in and score confirmation.
- **Seating/rotation:** the server assigns a unique current Table/Seat value per round and records effective time and source. Each player also has one permanent, tournament-scoped verification ID assigned when registration closes; it does not change as Table/Seat rotates and is the value entered in the scorecard Verification ID # field. Manual seating overrides require a director reason. Rotation, anchors, sit-outs, family restrictions, lateness/forfeits, and any seating eligibility rule MUST be backed by an approved dated ACC fixture before an official schedule or export is produced.
- **Known absence/forfeit fixtures:** for the narrow Rule 11.4 post-lunch case, a player absent at the scheduled return receives a five-minute grace period before the opponent receives a 2-game-point, +10-spread win and the late player a 0-game-point, -10-spread loss; the late player resumes the next opponent in rotation. The fixture MUST also preserve the Rule 11.4 limits (only one 2/+10 award and later absence may trigger disqualification/substitution or a floating sit-out). Playoff absence is separate: Rule 13.1 starts forfeiting the first game after five minutes and subsequent games every fifteen minutes, without removing the nonappearing qualifier's round-loser prize/MRP entitlement. These are not a substitute for the still-unconfirmed general rotation, anchor, sit-out, replacement, and event-specific timing rules.
- **Disputes:** a player/cross checker can open a dispute against a specific match/card/game. The dispute captures actor, target, evidence source (digital/paper), status, and resolution. A person MUST NOT resolve their own card dispute. A dispute blocks final standings/export until resolved or explicitly dispositioned by an eligible director/judge under the configured policy.
- **Consolation eligibility:** the system may compute a draft eligibility list from configured event data, but MUST label it provisional and block official use until the applicable ACC rule/fixture and director approval are present.
- **Templates and attachments:** duplicating a tournament template copies configuration only—not player identities, scores, payments, corrections, attachments, or private notes. Attachments are virus/type/size checked, access controlled, retained under the retention policy, and linked to the relevant event/ledger/result. Unsupported or private-source uploads are rejected.

Acceptance/rejection gates for these workflows are included in `R-REG-01` and `R-OPS-01`. Rotation, disputes, and Consolation eligibility remain explicit compliance gates where no approved ACC rule is available; the product does not invent those rules.

## 4. Scoring and scorecard requirements

- A player enters a positive whole-number margin from 1 through 121 using a large, high-contrast keypad. Desktop keyboard entry MAY supplement it.
- The entry requires an explicit winner/loser choice. The winner’s Plus Points and opponent’s Minus Points are populated from the same result; the losing card receives the reciprocal values. The card MUST show separate Plus Points and Minus Points columns.
- Game Points are derived, not freely typed: normal win = 2; loss = 0; official ACC skunk threshold (31 or more) = 3. Single/double/triple skunk icons are optional, informal player feedback only; they MUST NOT change records, standings, exports, or official language.
- The digital card MUST mirror the paper layout: game number, derived game points, plus, minus, opponent first and last name, and the opponent's permanent Verification ID # (for example `A-7`), followed by totals, games won/lost, and net plus/minus. Opponent initials are removed. The player-facing entry/review context separately shows the current game Table/Seat for each player.
- Every card line MUST link to a canonical match/game record and contain the player/card side, opponent/card side, round, and event identifiers. Normal verified digital submissions project reciprocal values, but neither card may be flattened into one margin-only record. ACC Rule 12.2 can resolve paper-card discrepancies by retaining different corrected values on the two individual cards; therefore the canonical match is linkage and audit context, **not** a permanent assertion that every corrected card projection has one shared winner/margin. The implementation must preserve both original card claims, the adjudicated card values, source case, actor, and derived totals.
- Required Rule 12.2 fixture coverage is the source's cases (a)–(i). Each fixture MUST assert the resulting state of both cards, canonical match linkage, totals, standings inputs, qualification-position notice where applicable, and audit trail; do not implement from a single-margin fixture or infer an additional ACC rule from a prototype. Until all cases are implemented and reviewed, correction mutation remains disabled by default and is not an official record path.
- Dependent totals and standings inputs MUST be derived from verified source results, not client-supplied summary fields. Minus Points are recorded for net spread and reconciliation; ACC’s current tie-break order uses game points, games won, net spread, plus points, head-to-head when available, then a one-game playoff. **Any conflict between that order and a future ACC source MUST block official calculation pending review; do not invent a replacement.**

## 5. Verification state machines

### 5.1 Shared invariants

All methods use an append-only event/audit trail. A result is **server-verified** only after two independent submissions and two confirmations from eligible, distinct actors, with authorization, tournament/game identity, and replay/concurrency checks passing. Pending sync, a local success message, or one person’s paper transcription is never server verification.

The initial production release is connected-first. Offline score entry is
optional and MUST remain unavailable unless the complete `R-OFFLINE-01`
contract and its reconnect/conflict tests are implemented. Lack of offline
entry does not block that connected-first release; the interface MUST clearly
state that a connection is required and MUST fail closed when the service is
unavailable.

Every offline operation MUST carry an authenticated actor/session binding, tournament/event/card scope, client operation ID, creation time, schema version, and integrity protection. The server MUST reauthorize and validate it on replay, accept an operation at most once, detect stale/conflicting canonical state, and retain rejected/quarantined payload metadata in the audit trail without exposing private data. Local queue state may display `PendingSync` or `Conflict`; it MUST never display `Verified` until the server transaction succeeds. `R-OFFLINE-01` is the direct mapping for queue forgery, cross-tournament replay, duplicate replay, reconnect, and conflict tests.

### 5.2 Digital/digital workflow

`Draft → EntryASubmitted + EntryBPending → BothEntriesSubmitted → ConfirmationAPending/ConfirmationBPending → Verified`.

The two entries MUST be independently captured by the two distinct assigned players and hidden from the other player until comparison. Confirmation A and Confirmation B MUST be performed by two distinct eligible actors who did not submit both entries; a player may confirm only their own submitted result, while a cross checker/director may confirm the assigned review action but cannot satisfy both confirmations alone. A mismatch MUST transition to `MismatchNeedsCrossCheck` and MUST NOT auto-verify. Duplicate taps, replayed requests, and the same actor confirming twice do not satisfy the requirement. Offline submissions remain `PendingSync` until accepted and compared by the server; local “confirmed” status is never server verification.

### 5.3 Hybrid/paper workflow

`PaperOrHybridDraft → PlayerAEntryPending + PlayerBEntryPending → BothEntriesSubmitted → ConfirmationAPending/ConfirmationBPending → Verified`.

The paper card is the source artifact and MUST retain its event/card identity. The primary path is: each assigned player independently enters the paper result on a shared or personal device using their context-only PIN, cannot see the other player's entry before comparison, and confirms their own entry. Each entry and confirmation is bound to that assigned player and canonical card/match. A player who is unavailable leaves the result `PendingCrossCheck`; staff may capture paper evidence and record a pending transcription, but staff cannot substitute for that player's entry or confirmation unless a future, separately approved exception is enabled. A dead-phone/shared-device PIN confirms context only; it never grants account access or bypasses these safeguards. Offline entries remain pending until each player's authenticated action reaches the server. If either entry is missing, the result cannot become server-verified. If entries disagree, the result enters `MismatchNeedsCrossCheck` and requires an eligible cross-check/judge workflow; it cannot be resolved by a single staff transcription or local success message.

### 5.3.1 Paper-scorecard capture and OCR assistance

An eligible cross checker MAY capture a paper scorecard with a device camera or
authorized file upload to accelerate review. The capture MUST be linked to the
specific tournament, canonical game, current card side, and permanent
verification ID before it can be used. OCR produces only an editable,
confidence-labelled draft; the cross checker must visually compare and accept
or correct every scoring value before it becomes a transcription or comparison
input. A cross checker MUST NOT capture, review, or resolve their own card.

For a paper/digital game, the approved scanned draft MAY be compared with the
digital player’s independently submitted result. For a paper/paper game, each
card is captured independently and the app compares the two approved drafts.
Only missing, unreadable, unlinked, low-confidence, or mismatched results may
enter the cross-check queue. A matching OCR draft, one scanned card, a paper
image, or a staff transcription alone MUST NOT create `Verified`, satisfy a
player entry or confirmation, or silently modify a scorecard, standings,
export, or payment record.

Card images and OCR drafts are restricted evidence, not public attachments.
They require role/tournament authorization, encrypted restricted storage,
immutable capture/review/comparison audit data, retention/hold treatment, and
explicit download/view access controls. The capture route must request camera
access only when opened; camera permission remains disabled elsewhere. No
paper-card image or OCR text may be sent to an unapproved third-party service.
The selected OCR implementation, image retention period, supported card
layouts, image size/type limits, deletion/restore behavior, and false-read
fixtures require separate technical and data-governance approval before this
capability is enabled.

### 5.3.2 Start Here / How To guidance

The app MUST provide concise, accessible, in-app guidance for players and directors. The player score-entry screen MUST make the hybrid paper/digital sequence available in plain language: each assigned player independently enters the paper result, each confirms their own entry, and the score is official only after both entries match and both confirmations are accepted by the server. It MUST direct an unavailable player or a mismatch to the pending cross-check workflow; it MUST NOT suggest that a director, one player, or a paper card alone can verify a result. The director guide MUST cover the essential operational actions—check-in, closing registration, publishing seating, handling paper cards, and resolving exceptions—and link to the fuller rule/reference material. Guidance is contextual and brief; it does not replace enforcement, audit, or role controls.

### 5.4 Post-verification correction

`Verified → CorrectionPending | CorrectionApplied → (StandingsUpdated | StandingsUnchanged) → Verified`.

A permitted cross checker may correct any paper or digital card except their own. `CorrectionPending` means the proposed old/new value is recorded and visible to authorized reviewers but has no effect on verified standings or ACC export. `CorrectionApplied` means the correction is authoritative for the operational record, preserves the original verification and audit history, and supersedes derived card totals immediately without requiring player reconfirmation. A new tournament defaults to `CorrectionApplied` on save; if the director enables second cross-checker/director approval, it remains `Pending` until that approval completes. Every correction MUST append original value, new value, editor, timestamp, affected canonical match/card/game/field, optional reason, and approval state. A correction MUST never erase prior values or bypass the baseline independent-entry and confirmation safeguards. A correction to a published result MUST create a new result version and preserve the prior published version as superseded; it MUST NOT silently overwrite publication history.

### 5.5 Official-rule uncertainty

The state machines define product integrity, not unverified ACC policy. The narrow 2025 Rulebook post-lunch and playoff absence rules are specified above, but general rotation, anchors/sit-outs, family restrictions, Main/Consolation timing, replacements, event-specific lateness/forfeits, Q-pool payout/rounding, MRP tables/byes, retention duration, and any ACC import/API contract remain unresolved. The app MUST label such outputs as configuration/draft or block official export until a dated ACC source and approved fixture exist.

### 5.6 Judge and cross-check protocol

The Judge view MUST show the current dated rulebook/reference version, source link, and applicable cross-check protocol. The ACC 2025 baseline recorded in `TR-06` MUST be encoded: two judges are present before a hearing begins; at least one responding judge has the rulebook; and, if either player disagrees with the decision of the first two judges, a third judge may be summoned and the three-judge decision is final. A judge MUST NOT adjudicate, confirm, or correct their own card/dispute. For each individual cross-checking table, the baseline minimum is two cross checkers when that table has 24 or fewer players and three when it has more than 24. If related couples, significant others, or relatives are checking a table where one of them qualifies, a third checker is required for that table; this is a safeguard for the affected table, not a universal prohibition on assignment. The server rejects assignments beyond the applicable table capacity and preserves escalation to another eligible judge/director. Assignments, sources, disagreements, escalations, and resolutions are audited. Any later ACC rule change requires a dated source and fixture update; the app must not invent a universal capacity or conflict definition.

### 5.7 Event finalization

An event MUST remain `Open` or `PendingFinalization` until all configured score verification, unresolved dispute, correction approval, seating/eligibility, finance/reporting, attachment classification, result-version, and director-approval gates pass. Finalization is a server transaction that records the approving director, time, ruleset/source versions, scoring method per event, and export/publication references. `R-FINAL-01` requires rejection tests for each missing gate; a client route or displayed “complete” label cannot finalize an event.

## 6. Rules and offline behavior

The Judge view MUST provide a searchable in-app quick reference and a link to the dated official ACC rulebook. The app SHOULD cache an approved version before an event, display its effective/source date, and fall back to the online official source when available. A stale or missing cache MUST be disclosed; it MUST NOT silently present an undated rule as current.

Cached rulebook text/PDF is permitted only after separate ACC/copyright permission is recorded for the selected asset and distribution scope. The user recorded this permission on 2026-09-07 for the full ACC Rulebook for everyone using the app, including the public review prototype. The selected asset is the official 2025 edition PDF at `https://www.cribbage.org/NewSite/rules/rulebook_2025.pdf`, captured on 2026-09-07 with SHA-256 `db284283420259c99cfcc960bfdf4a6b79c95a5fc1bee02b1817b4af4a02f9fd`. The app must retain edition/source/checksum/capture metadata and refresh it for a later edition or an officially revised same-edition source asset.

## 7. Events, flyers, Q-pools, and finance

- Flyer/event setup MUST support Main, Consolation (display nickname “Consy”), and any number of Satellites. Directors choose a standard event type or Custom event and provide name, date/time, format, game count, fees, pools, payout/qualifying details, and eligibility notes.
- Flyers MUST disclose when Muggins is in effect, using director-provided tournament configuration and without implying a rule that was not selected. Flyer output MUST distinguish Standard Singles digital scoring from non-singles formats that are only manually entered/imported.
- Main and Consolation support up to two Q-pools using the currently observed ACC options: equal payout, equal payout with double to the top qualifier, and graduated payout ratios. Payout/rounding rules require dated approved fixtures before official calculation.
- The first digital scoring boundary is Standard Singles. Team, ordinary Doubles, and Canadian Doubles may be represented in flyer/event configuration and internal director-assisted exports, but their digital scoring, standings, eligibility, payout, and verification rules require a separately approved ruleset and fixtures. The product MUST NOT claim full digital support for those formats before that gate passes.
- For non-singles events before that ruleset gate passes, results MUST be entered manually or imported from an approved external source, visibly labeled `manual/imported — not digitally scored`, and excluded from claims of digital verification. The app may publish those results only through the same configured reconciliation/director-approval gates.
- Finance MUST use manual payment/status entry and the label **ACC Sanctioning Fee** (renamed from Reserve Fee). No online payment processing is in scope.
- Finance is private to authorized tournament roles. It MUST NOT be included in public result pages or public exports except for explicitly approved prize/payout fields.
- A financial ledger MUST reconcile event fees, manual payments, expenses, Q-pools, payouts, sanctioning fee, and adjustments with immutable/audited entries. Unreconciled values block release readiness and official export.

## 8. Public Results lifecycle and audience

Results are a separate post-event publication, not the promotional flyer. A result set has lifecycle states `Draft → Reconciled → DirectorApproved → Published → Superseded/Withdrawn`. Only `Published` results are public. By default, “public” means signed-in app users with the results-view permission; anonymous internet access is a separate product decision and MUST remain disabled until explicitly approved. The audience may view event identity, event type, paid placements, each paid player's placement and prize amount, winner, runner-up, high non-qualifier, and Master Point qualifiers.

Event/Playoff Results and Qualification Results MUST remain distinct. Event/Playoff Results show winner, runner-up, and other paid playoff placements. Qualification Results preserve the completed qualifying-card order from highest to lowest; later playoff outcomes MUST NOT reorder it. The playoff winner and runner-up are members of the qualifying field but may have entered the playoffs at any qualifying rank. The High Non-Qualifier is the first ranked player outside the qualification cutoff and MUST appear as a separately labeled row immediately after the last qualifier in the application report. It is not a playoff placement. A pre-playoff Qualification Preview MUST NOT invent or display an event winner or runner-up. The high non-qualifier MUST be computed from a source-backed approved fixture and must identify the final qualifier tie-playoff loser where that case applies. An ACC export MAY place the same High Non-Qualifier value in a separately required portal field without changing this semantic separation. See `docs/decisions/2026-09-10-qualification-and-playoff-result-separation.md`.

Private roster details, account identifiers, correction reasons, payment status, expenses, and ledger data MUST remain restricted.

Each publication MUST have a stable event/result-set ID, version number, publication timestamp, approving director, source status, scoring method (`digital`, `manual`, or `imported`), and supersedes link. A correction creates a new version; the previous version remains auditable but is marked superseded. Withdrawal MUST leave a public status notice without exposing private data. Results are not “final” merely because a client displays them; publication requires the configured verification, reconciliation, finance, dispute, and director approval gates.

## 9. Internal director-assisted ACC export artifact

The system MUST generate a director-downloadable, versioned **internal director-assisted export** (initial internal identifier `acc-results-v1`) rather than silently submitting to ACC. `acc-results-v1` is not an ACC portal import format or golden contract; its schema and field mapping remain pending ACC confirmation. Only export-specific unknowns may block generation; unrelated unresolved portal/API questions must not be misrepresented as export support.

The artifact MUST include:

- tournament/event identity, dates, venue, director/co-directors, sanctioned event types, and contract/schema version;
- player identity fields approved for ACC reporting, seating/table identifiers as needed, event participation, game points, games won/lost, plus/minus/net spread, placements, payouts, high non-qualifier, and qualifier/Master Point fields;
- Main, Consolation, Satellite, and Q-pool sections where applicable, with explicit event type and custom-event mapping/notes;
- source publication/result-set version, generated timestamp, generating director, correction/version status, and integrity checksum or equivalent artifact ID.

Before download, export generation MUST validate required fields, export-specific approved rule fixtures, duplicate players/events, score bounds, standings consistency, payout/ledger reconciliation, and export-schema mapping. Validation errors block generation; warnings are displayed and recorded. Unrelated unresolved ACC policy/API questions MUST remain visible as gates for their affected features but MUST NOT be mislabeled as export support. A reconciliation summary MUST show that exported placements/payouts/qualifiers match the approved result version and private ledger totals where applicable. The director manually submits the artifact through the ACC portal. Automatic submission MUST remain disabled until ACC supplies and approves a supported API/import contract; that dependency is tracked as an explicit unresolved decision, not guessed.

## 10. Retention, privacy, and release evidence

Retention duration is **pending ACC policy approval**. Until approved, the default is restricted hold with **no automatic purge**. The implementation MUST support configurable retention and legal hold/deletion workflows without selecting or claiming an official duration. Only a designated director/data steward may authorize deletion; deletion requests, approvals, affected records, reason, timestamp, and resulting tombstone/audit entry are retained. Backups follow the same access controls and hold policy; restore requires an integrity check, isolated validation, and an auditable approval before data is returned to service. Private handoff material, correspondence, source photographs, credentials, and private player data MUST never be served or committed.

## 10.1 Finance and reporting compliance gates

Before a tournament can be marked complete or exported, the system MUST explicitly account for:

- entry fees, waivers, refunds, and manual payment status;
- ACC Sanctioning Fee and any other configured sanctioning charges;
- Q-pool receipts, payout method, rounding, and winner/qualifier mapping;
- prize payouts by every paid placement, including amount per player;
- expenses, reimbursements, adjustments, and approval actor;
- attachment classification (receipt, sanctioning evidence, payout evidence, result evidence, or other), metadata, access scope, and retention/hold status;
- ledger-to-results and ledger-to-export reconciliation;
- required ACC result fields, qualifier/high-non-qualifier fields, event format/scoring method, and director approval;
- finalization state, export artifact ID/checksum, and any manual ACC submission acknowledgement.

The exact required ACC report fields, attachment retention period, payout/rounding fixtures, tax/legal reporting obligations, and external submission acknowledgement remain unresolved compliance gates where no dated source exists. Muggins selection/configuration is recorded in the event/flyer data; the disclosure itself is a defined product requirement, not an unresolved gate. Missing or unreconciled items block completion/export; the system must not silently estimate or omit them.

Production release requires a real Supabase test backend, staging/production separation, RLS and server authorization tests, browser checks at phone and desktop sizes, independent sessions for multi-user flows, offline/reconnect/replay checks, backup and restore evidence, rollback/monitoring evidence, and a director-approved simulated tournament. Recovery checks (`npm run verify`, `npm run verify:handoff`) prove repository integrity only; they do not prove production readiness.

Measurable accessibility targets: WCAG 2.2 AA color contrast; all primary actions keyboard and screen-reader reachable; focus indicator visible; minimum 44x44 CSS-pixel touch targets (56x56 for keypad controls); body text at least 16px with no loss of function at 200% zoom; score/keypad critical text remains readable at 320px viewport width; and browser tests cover phone (320/375px) and desktop (1280px) layouts. Any target failure is a release defect, not a preference.

Friendly skunk visuals use informal bands only: 31–60 one icon, 61–90 two icons, and 91–121 three icons. The player-facing screen MAY name them `Skunk`, `Double Skunk`, and `Triple Skunk` without an explanatory disclaimer. They MUST remain separate from official calculations, standings, and ACC exports, where only the official 3-game-point skunk outcome is recorded.

## 11. Acceptance and rejection matrix

| Area | Must accept | Must reject/block |
|---|---|---|
| Margin | integers 1–121; derived plus/minus and 0/2/3 points | 0, 122, decimals, missing winner, client-supplied game points |
| Verification | two independent entries + two distinct eligible confirmations | one entry, duplicate actor, mismatch, pending sync, replay/concurrent duplicate |
| Auth/roles | magic link; scoped role; context-only PIN | PIN account login, unauthorized tournament, self cross-check/correction |
| Correction | append-only old/new/actor/time; immediate default authority | erased history, missing actor/time, correction affecting standings before configured approval |
| Publication | reconciled/director-approved version becomes public | draft/unreconciled/private finance exposure; unversioned overwrite |
| Export | validated `acc-results-v1` artifact matching approved results/ledger | unresolved export-specific fixture/schema mapping, invalid score, duplicate identity, unreconciled payout, automatic portal submission |
