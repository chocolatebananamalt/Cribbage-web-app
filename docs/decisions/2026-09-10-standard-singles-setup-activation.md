# Standard Singles setup activation boundary

Date: 2026-09-10
Status: approved implementation boundary; release remains default-off

## Decision

A current tournament director or co-director may explicitly activate the latest
immutable tournament-setup revision only when it contains exactly one
`standard_singles` event. The activation request is the director approval act;
saving a setup revision remains draft-only and does not imply approval.

Activation is one database transaction. It creates a server-derived operational
event, a ruleset version limited to the sourced Standard Singles scoring core,
an immutable setup-to-event provenance record, an operation receipt, and an
audit event, then changes the tournament from `draft` to `open`. Registration
stays closed and the event publication state stays draft.

The ruleset source is the ACC Official Tournament Rules 2025 PDF already
validated for the scoring core in this repository, including its recorded
SHA-256. The ruleset source string explicitly limits the scope to
`standard_singles_scoring_core_only`; a director's unsourced setup notes do not
become rules.

The public HTTP route remains hidden unless
`ACC_TOURNAMENT_SETUP_ACTIVATION_ENABLED=enabled`. It verifies the caller's
session and same origin, then uses the server-only service client to call the
service-role-only activation function with the verified actor ID. Browser roles
cannot call the database function directly.

## Rejection and replay boundary

The transaction rejects a missing or stale revision, a non-current official,
multiple events, any non-Standard-Singles format, an already operational
tournament, or a caller without a current director/co-director role. Exact
idempotent replay returns the original response. Changed reuse of an operation
key creates immutable conflict evidence without duplicating the event or
receipt. Other authorized business rejections receive a rejected receipt and
audit event.

## Deliberate non-goals

Activation does not create rounds, rotation/seating, participants, games,
scores, finance records, results, payouts, qualifiers, or ACC submissions. It
does not interpret payout, qualification, eligibility, Q-pool, Muggins, or fee
notes stored in the setup draft. Those remain blocked until separately sourced
and approved rules and fixtures exist.

No feature switch is enabled and migration 0108 is not applied to the shared
pilot by this change. Release still requires applying the reviewed migration in
order and completing real protected-route verification with independent
sessions on the intended backend.
