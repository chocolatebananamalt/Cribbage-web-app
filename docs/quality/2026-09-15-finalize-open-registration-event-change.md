# Finalize/open-registration and event-change verification

Date: 2026-09-15

## Scope

Implements the owner-approved two-stage event setup lifecycle and exceptional
pre-start event recovery workflow.

## Evidence

- Migration `0194_finalize_registration_and_event_change_lifecycle` applied
  successfully to the approved pilot Supabase project.
- Read-only database probe confirmed the finalization RPC, event-change RPC,
  and event operational-state column exist. No tournament had been finalized
  by that probe.
- `pnpm exec tsc --noEmit` passed.
- `pnpm test` passed: **515/515** tests.

## Required production evidence still pending

- Merge/deploy this application revision and confirm Vercel production reports
  a successful deployment with no runtime errors.
- In an authorized independent browser session, save a draft, confirm the
  exact finalization dialog, verify QR/link management opens, and confirm the
  public registration claim succeeds only after finalization.
- Confirm a pre-start retire/replace action retains the visible roster/payment
  history and is denied after Start Play. Use fictional rehearsal records only.
