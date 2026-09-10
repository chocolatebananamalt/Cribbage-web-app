# Isolated database validation environment — 2026-09-10

## Purpose

Prepare a safe, disposable environment for the real multi-session and
concurrency checks required before any public registration or account
activation release. The shared ACC Tournament Pilot Integration project was
not used for this work.

## Environment findings

- The Supabase organization is on the Free plan. Dashboard preview branches
  require Pro, despite the connector reporting an hourly branch-compute rate.
  A branch-create request was rejected before any branch was created.
- An existing, separate Supabase project is the approved disposable validation
  target. It already contains anonymized synthetic test fixtures and an
  ordered migration history through the pre-activation schema. It is not the
  shared pilot project.
- The earlier connector errors were caused by attempting to create schema
  objects that the test project already had, not by an `auth.users` migration
  limitation. The account-activation migrations were then applied in order to
  the disposable project successfully.

## What was not changed

- No migration, data, authentication setting, or feature flag was changed in
  the shared pilot project.
- Two temporary connector-probe tables were created only in the disposable
  project and immediately removed. A follow-up security scan must remain clear
  of those probes before test evidence is recorded.

## Activation installation and access-boundary evidence

- Migrations `0090` through `0095` applied successfully, in order, to the
  disposable project. Its four activation tables are RLS-enabled and currently
  contain no activation data.
- A post-install catalog query confirmed that `anon` and `authenticated` have
  no EXECUTE privilege on the issue, redemption, decision, or cancellation
  procedures. The `service_role` has the intended narrow EXECUTE privileges.
- A service-role execution attempt against an already linked synthetic roster
  entry returned the controlled `activation_unavailable` rejection. It did not
  create another activation. This is rejection-path evidence only; it does not
  substitute for the still-required new-fixture issue/redeem/decision race
  matrix.
- A separate issue attempt naming a player rather than a director was rejected
  by the database before any activation row was created. A follow-up count
  confirmed zero activation rows; only the earlier authorized-but-ineligible
  rejection receipt exists. This proves the authorization check fails without
  mutating activation state in this fixture.

## End-to-end witnessed activation evidence

On 2026-09-10, an isolated synthetic fixture completed the full expected
sequence through the real stored procedures:

1. A service-only director issued a registration link for an open synthetic
   tournament.
2. A synthetic registration claim was received, independently approved by the
   director, and promoted to an unlinked roster entry.
3. The director issued a 10-minute account activation for that roster entry.
4. A different, existing synthetic profile redeemed the matching digest and
   received a confirmation phrase.
5. The director approved the matching phrase. The database recorded an
   approved activation and request, exactly one roster/account link to the
   redeeming profile, and three activation events (issue, request, approval).
6. Repeating the exact approval operation returned the original approved
   receipt without another link, event, or receipt (counts remained 1 link,
   3 events, and 1 approval receipt).

This is genuine sequential database evidence for the issued → pending →
approved lifecycle and exact replay. It does **not** prove simultaneous race
outcomes, browser-session behavior, QR presentation, or release readiness.

## Concurrent redemption/cancellation evidence

A second fresh synthetic roster entry was created through the same real
registration and roster procedures. A 10-minute activation was issued, then
redemption and director cancellation were invoked concurrently through two
independent database requests.

- Both requests completed; neither hung or returned a deadlock error.
- Redemption reached `pending`; cancellation then reached `cancelled` under
  the shared advisory lock.
- Final persisted state was `activation=cancelled`, `request=rejected`, and
  `link_count=0`, with three lifecycle events. No account link was created.

This is direct evidence that the repaired shared lock ordering handles the
issue/redeem/cancel family safely in one contention ordering. The reverse
ordering and decision/cancel contention remain required before release.

## Concurrent approval/cancellation evidence

A third fresh synthetic roster entry was issued and redeemed to a pending
witnessed request. Independent, concurrent director approval and cancellation
requests were then submitted.

- Both requests returned normally; there was no deadlock.
- Cancellation won the serialized transition. Approval returned the controlled
  rejection rather than creating a link after cancellation.
- Persisted state was `activation=cancelled`, `request=rejected`,
  `link_count=0`, and three lifecycle events.

Together with the earlier redemption/cancellation run, this proves both
multi-command races that motivated the activation lock-order repair. A second
run with the opposite request arrival ordering would be additional confidence,
but the transaction ordering itself is now exercised in both mutable paths.
- A post-cleanup table scan found no remaining `validation_probe` table. The
  security advisor has no critical RLS-disabled table finding. Its remaining
private-table RLS and service-procedure notices match the reviewed
RPC-only architecture.
- No public feature was enabled.
- The incomplete activation migrations `0090`–`0095` remain unapplied to the
  pilot.

## Atomic registration-closure evidence

On a fourth, newly seeded, clearly named synthetic fixture in this same
disposable project, an actual call to `close_tournament_registration_v2` ran
under the service-role claim. Before the call, the fixture had an open
tournament registration state, an open head at version 1, and one enabled,
issued signup link.

- The procedure returned `registration_closed` with both `registrationClosed`
  and `linkClosed` true.
- Persisted state was `registration_status=closed`, `head_state=closed`,
  `head_version=2`, `link_lifecycle_state=closed`, and `enabled=false`.
- Replaying the exact same operation then left exactly one closure receipt,
  one link-closure lifecycle event, and one registration-closure audit event.

This proves the stored procedure’s atomic close-plus-link-retirement path and
its exact replay for this isolated fixture. It does not prove concurrent
claim-versus-close behavior, director browser interaction, or public-release
readiness.

## Registration-link rotation/closure serialization evidence

Two further explicitly named synthetic fixtures exercised the real
registration-link lifecycle procedures in the disposable project. Both calls
used separate connector requests with a service-role claim; no pilot data or
release setting was changed.

1. **Concurrent rotate/close.** Rotation and registration closure were sent
   concurrently against one open head at version 1. Closure returned
   `registration_closed`; rotation returned the controlled
   `link_unavailable` rejection. The durable final state was
   `registration_status=closed`, `head_state=closed`, `head_version=2`, and
   its only link was `closed` and disabled. The two requests produced exactly
   two operation receipts, one lifecycle event, and one closure audit event.
   Neither request deadlocked or left an active signup link.
2. **Rotate then close.** A second fixture first completed an accepted
   rotation (open head version 2 on a replacement link), then completed the
   real registration-close procedure. The final state was
   `registration_status=closed`, `head_state=closed`, `head_version=3`, with
   the replacement link `closed` and disabled. It retained exactly two
   operation receipts, three lifecycle events (issuance, rotation, closure),
   and two audit events (rotation and closure).

Together these cover both safe serializations: a closure can reject a
contending stale rotation, and a closure that follows a completed rotation
retires the replacement link rather than leaving registration open. This is
database contention evidence only; it does not replace authenticated,
independent browser-session proof or the remaining claim-versus-close test.

## Registration-claim/closure serialization evidence

One more newly named synthetic fixture sent a valid claimant submission and
the real registration-close operation concurrently through independent
database requests. The claimant completed first in the serialized order and
returned `received`; registration closure then returned
`registration_closed`. The final persisted state was still closed
(`registration_status=closed`, `head_state=closed`, version 2, link closed and
disabled) with one accepted pre-closure claim and one closure receipt. A
fresh valid-digest claim submitted after that close returned the generic
`unavailable` result and created no additional claim.

This shows the expected safe boundary in this arrival order: a claim that was
already committed before closure is retained for director review, while no
claim can be accepted after closure. It found no deadlock or orphaned active
link.

A final separate fixture exercised the complementary close-first ordering:
the close returned `registration_closed`, then a valid-digest claimant request
returned `unavailable`. Persisted state remained closed at head version 2,
with a closed disabled link, one closure receipt, and **zero** claims. Together
with the concurrent claim-first run, both ordering outcomes now have direct
database evidence. Real independent authenticated browser sessions remain
required before any public-registration release.

## Consequence and next safe path

The required real two-connection proof can now be performed against this
disposable project. It must use isolated, newly created synthetic fixtures and
must not reinterpret the existing fixture data as a production-like workload.
Static regressions and deployed disabled-route checks do not replace that
proof.

## Observable acceptance criteria for the eventual live test

- Confirm migrations `0090`–`0095` are installed in the isolated database and
  that no connector probe artifacts remain.
- Execute concurrent issue/redeem, issue/cancel, approval/cancel, and
  registration close/claim attempts through two independent authenticated
  sessions. Rotation/closure serialization is now covered at the database
  boundary, and claim/close is covered in both database ordering outcomes;
  both still need browser-session coverage.
- Confirm one authoritative outcome, durable conflict receipts where required,
  no self-check, no direct browser access to service-only procedures, and no
  leaked credential in storage or URLs.
- Retain the command output and persisted-row evidence in this folder before
  enabling either release flag.
