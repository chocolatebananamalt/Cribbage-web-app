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
- A post-cleanup table scan found no remaining `validation_probe` table. The
  security advisor has no critical RLS-disabled table finding. Its remaining
  private-table RLS and service-procedure notices match the reviewed
  RPC-only architecture.
- No public feature was enabled.
- The incomplete activation migrations `0090`–`0095` remain unapplied to the
  pilot.

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
  sessions.
- Confirm one authoritative outcome, durable conflict receipts where required,
  no self-check, no direct browser access to service-only procedures, and no
  leaked credential in storage or URLs.
- Retain the command output and persisted-row evidence in this folder before
  enabling either release flag.
