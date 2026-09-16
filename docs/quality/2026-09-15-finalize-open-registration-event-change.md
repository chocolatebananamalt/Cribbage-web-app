# Finalize/open-registration and event-change verification

Date: 2026-09-15

## Scope

Implements the owner-approved two-stage event setup lifecycle and exceptional
pre-start event recovery workflow.

## Evidence

- Migration `0194_finalize_registration_and_event_change_lifecycle` applied
  successfully to the approved pilot Supabase project.
- Migration `0195_event_replacement_enrollment_and_credit_transfer` applied
  successfully to the same project. It adds a private immutable transfer ledger
  and transaction-local trigger that creates replacement-scoped eligible
  individual/team enrollment rows, team-contribution rows, and
  tournament-payment-credit references without copying a cash/check receipt.
- Read-only catalog checks confirmed the transfer ledger and trigger exist;
  neither `anon` nor `authenticated` can execute the internal transfer
  function, while only the server authority can use the event-change RPC. No
  retained replacement operation or fixture data was created in the pilot.
- Read-only database probe confirmed the finalization RPC, event-change RPC,
  and event operational-state column exist. No tournament had been finalized
  by that probe.
- `pnpm verify` and `pnpm verify:handoff` passed, including TypeScript, lint, **515/515** application
  tests, provider readiness, production build, and workspace checks.
- Pull request #53 merged at `3ba6673ee4b00915477c9a30031674c974988b2a`.
  Vercel production deployment `dpl_HwB73Hbcm9rBN4oDPFzw5ZdBJizx` is READY.
  Root and sign-in smoke probes returned HTTP 200; the new anonymous protected
  event-change endpoint returned its expected HTTP 401/no-store response; the
  Vercel 30-minute runtime-error scan reported no errors.

## Required production evidence still pending

- In an authorized independent browser session, save a draft, confirm the
  exact finalization dialog, verify QR/link management opens, and confirm the
  public registration claim succeeds only after finalization.
- Confirm a pre-start retire/replace action retains the visible roster/payment
  history, carries eligible enrollments/credit references into the replacement,
  and is denied after Start Play. Use fictional rehearsal records only.
