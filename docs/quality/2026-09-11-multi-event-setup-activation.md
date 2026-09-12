# Multi-event tournament setup activation — 2026-09-11

## Acceptance criteria

- One saved tournament revision activates its Main, optional Consy, and every
  Satellite as separate operational events under the same tournament.
- Activation requires exactly one Main, the latest unchanged setup revision,
  a current director/co-director, a draft tournament, and no existing
  operational lifecycle state.
- Standard Singles is digital. Team, doubles, Canadian Doubles, and custom
  formats are manual/paper-scored and cannot use digital score mutation.
- The operation is atomic, audited, receipt-bound, and idempotent.
- The browser exposes activation only for a saved unchanged revision, retains
  an opaque retry operation, and locks configuration after success.

## Verification evidence

- Supabase migration `multi_event_setup_activation` applied successfully to
  project `fnjkwymxpnsqvxtpronk` while the Production release gate remained
  disabled.
- Hosted transaction test created a disposable Main, Consy, and Canadian
  Doubles setup; activation returned three events, persisted two digital and
  one manual event, opened the tournament, and produced three activation rows.
  Replaying the same operation returned the exact receipt without duplicates.
  The transaction was rolled back, leaving no test tournament or event.
- `pnpm verify`: pass — no known production dependency vulnerabilities, lint,
  232/232 application tests, Next.js production build, and 6/6 workspace gates.
- `pnpm verify:handoff`: pass — 6/6 private handoff integrity checks.

## Remaining proof

- Deploy the commit, verify the protected setup screen in external Chrome,
  enable the Production activation gate, redeploy, and exercise the read path.
- Do not activate the real October pilot setup until its actual complete event
  list is saved; activation intentionally locks that setup revision.
