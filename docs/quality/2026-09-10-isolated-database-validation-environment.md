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
- An existing, empty, separate Supabase project was verified as active and was
  selected as the disposable validation target. It contains no public tables
  and is not the pilot project.
- The connector can run read-only SQL in that target and can apply simple
  public-schema migrations. Its current migration endpoint rejects DDL that
  references `auth.users`, including the application's core schema, with only
  `INVALID_ARGUMENT`. The direct SQL endpoint also rejects DDL. This is a
  connector boundary, not evidence that the reviewed migrations fail in
  Postgres.

## What was not changed

- No migration, data, authentication setting, or feature flag was changed in
  the shared pilot project.
- No public feature was enabled.
- The incomplete activation migrations `0090`–`0095` remain unapplied to the
  pilot.

## Consequence and next safe path

The required real two-connection proof cannot be honestly claimed from this
host until a database connection method that supports the full `auth`-referencing
migration chain is available (for example, an approved Supabase CLI/local
stack or a dedicated disposable project connection). Static regressions and
deployed disabled-route checks can continue; they do not replace that proof.

## Observable acceptance criteria for the eventual live test

- Apply migrations `0001`–`0095` to an isolated database with no pilot data.
- Execute concurrent issue/redeem, issue/cancel, approval/cancel, and
  registration close/claim attempts through two independent authenticated
  sessions.
- Confirm one authoritative outcome, durable conflict receipts where required,
  no self-check, no direct browser access to service-only procedures, and no
  leaked credential in storage or URLs.
- Retain the command output and persisted-row evidence in this folder before
  enabling either release flag.
