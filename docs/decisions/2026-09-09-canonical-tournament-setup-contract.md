# Canonical tournament setup contract

Date: 2026-09-09
Status: approved implementation boundary; no writer or UI exists yet.

## Decision

`Set Up Tournament` is the sole canonical configuration record for a
tournament request. It is distinct from `app.events`, `app.ruleset_versions`,
and every operational scoring/financial record. An operational event represents
an already-approved scoring context; a setup version represents what a director
has configured or reviewed. One must never be silently converted into the
other.

The first implementation will be a private, append-only, director/co-director-
only configuration history. Its future writer can save a complete reviewed
draft and provide a single current version to Flyer, Seating, Results, and
Finance features. Saving configuration will **not** publish a flyer, create an
event, enroll a player, open registration, assign a seat, calculate a
payout/qualification, create a result, create a financial obligation, or
submit anything to ACC.

## Required configuration scope

Each immutable version records the following typed, validated content:

- tournament identity, city/venue, start/end local date/time with an IANA
  timezone, and contact/display details; the director reference must equal the
  existing tournament director, and no more than two distinct co-director
  references may be included only when each already has the current same-
  tournament co-director role;
- an ordered set of configured event entries: exactly zero or one Main, zero or
  one Consolation (displayed as `Consy`), and any number of Satellite or Custom
  entries;
- for every event: director-provided display name, date/time, style, format,
  game count, nonnegative integer USD-cent entry fee, bounded fee-includes
  description, distinct payout, qualification, and eligibility notes, and explicit
  Muggins state (`unset`, `in_effect`, or `not_in_effect`);
- for Main and Consolation only: no more than two Q-pool descriptors, each with
  type, entry fee, and director-provided explanatory text;
- ACC Sanctioning Fee configuration as a draft field, never a payment, balance,
  or reconciliation result;
- an explicit source status for every style, Q-pool, payout, qualification, and
  MRP-related item: `director_configured_unverified` until it has a dated
  authoritative source and approved fixture.

Each event has a stable client row identifier, a unique name and order, and the
whole version has an explicit bounded event-row limit. The first writer may
accept observed portal-shaped option codes as opaque
director configuration. It must not assert that they are a current ACC option,
derive their monetary consequences, or constrain a director to an unverified
or stale list. A later source/fixture increment may add validated official
enumerations without rewriting prior history.

## Required persistence model

The implementation uses private, forced-RLS tables:

1. `tournament_setup_revisions`: immutable version number, normalized
   tournament-level content, author, operation receipt, and timestamp.
2. `tournament_setup_event_versions`: immutable ordered child records linked to
   exactly one setup version; never linked to, or identified by, an operational
   `app.events` row.
3. `tournament_setup_q_pool_versions`: immutable child records linked to one
   Main/Consolation event-version, with a database maximum of two per parent.
4. An immutable conflict record for a changed idempotency-key reuse.

Every relationship carries tournament provenance where a composite foreign key
can enforce it. Direct access by `anon` and `authenticated` is revoked. The
future reader/writer RPCs are authenticated-only `SECURITY DEFINER` functions
with an empty search path and current server-side tournament-role checks.

## Writer contract

`save_tournament_setup_version(tournament_id, expected_version, payload,
idempotency_key)` is the implemented authenticated-only writer. Its payload
has exactly these root keys: `tournamentName`, `city`, `venue`, `startsAt`,
`endsAt`, `timezone`, `contactDetails`, `sanctioningFeeCents`, `officials`, and
`events`. Each official has only `profileId` and `role`. Each event has only
`clientRowId`, `eventKind`, `displayName`, `startsAt`, `timezone`, `styleCode`,
`formatCode`, `gameCount`, `entryFeeCents`, `feeIncludesNote`, `payoutNote`,
`qualificationNote`, `eligibilityNote`, `mugginsStatus`, and `qPools`; each
Q-pool has only `poolTypeCode`, `entryFeeCents`, and `note`.

The writer must:

1. require an authenticated current director or co-director;
2. advisory-lock the actor/idempotency key, lock the tournament row, then check
   role authority and exact replay before changing anything;
3. accept only `draft` or `open` tournaments with no initial-seating
   publication, scoring round, canonical game, result publication, or
   finalization state; it must reject any later
   lifecycle rather than revise historical operating conditions;
4. reject unknown payload keys and validate bounds, required textual fields,
   ISO local date/times plus an IANA timezone, nonnegative integer USD cents,
   one Main/Consy limit, Q-pool parent/type/count limits, distinct stable event
   row IDs/order/names, current official references, and no client
   supplied status, approval, actor, receipt, event ID, ruleset ID, score,
   financial result, or formula output;
5. exact-replay an existing payload response without a second version; route a
   changed payload using the same key into immutable conflict evidence rather
   than a second operation receipt;
6. atomically create the version, child rows, operation receipt, and audit
   event; rejected authorized attempts are also receipted/audited; and
7. return an explicit response that says the configuration remains draft-only
   and that no operational event, scoring, payment, seat, flyer, result, or ACC
   submission was created.

The current implementation rejects syntactically invalid ISO-local timestamps
and unknown IANA timezone names. A formal policy for ambiguous local times at
DST folds remains a release gate; no stored timestamp is represented as an
official ACC schedule interpretation yet.

The reader must return only the current authorized tournament configuration and
the minimum immutable history needed for a director to compare versions. It
must never expose private roster, payment, or attachment data.

## Explicitly blocked outcomes

- No automatic ACC portal entry, scraping, or submission without a documented,
  authorized ACC API/import contract.
- No official MRP, Q-pool, payout, qualification, rotation, Consolation
  eligibility, fee-balance, or sanctioning-fee calculation without a dated
  authoritative source and approved fixture.
- No conversion of an unverified configuration row into a digital-scoring event
  without a separately approved ruleset and operational-event creation flow.
- No change after initial seating publishes, scoring begins, results publish,
  or finalization; a future
  correction/supersession design must preserve prior setup versions and bind
  the affected operational/result version explicitly.
- No flyer publication or public visibility merely because a configuration was
  saved.

## Acceptance and rejection evidence required

| Scenario | Required result |
| --- | --- |
| Current director saves valid version 1 | One private setup version and atomic immutable receipt/audit; no operational side effect |
| Exact same retry | Same saved response, no extra setup version or receipt |
| Same key, changed payload | Structured conflict and immutable conflict evidence, no extra receipt/version |
| Co-director with current role | Same authorized behavior as director |
| Player, revoked official, anonymous caller | No data change, no unauthorized audit noise |
| Stale expected version/two writers | One version wins; other receives receipted stale rejection |
| Duplicate directors/co-directors; mismatched existing director; cross-tournament official reference | Rejection with no partial rows or role grant |
| Two Main or two Consolation rows; >2 Q-pools; duplicate row IDs/names/orders | Rejection with no partial child/version rows |
| Negative/noncanonical money; unsafe dates/times/timezone; unknown keys; forged actor/status/formula IDs | Rejection with no partial rows |
| Tournament with seating/round/game/publication/finalization | Rejection with no setup mutation |
| Saved configuration | No `app.events`, ruleset, registration, participant, payment, seat, score, result, export, or flyer record is created |

## Sources and limitations

This contract implements the user-approved canonical setup decision and the
observed ACC-sanctioning-portal field shape recorded in `TR-05` and `TR-07`.
It does not treat the portal as an API or a source for official calculation
rules. Exact ACC dropdown values, payout/rounding, MRP, eligibility, and portal
import mapping remain unresolved, dated-source gates.
