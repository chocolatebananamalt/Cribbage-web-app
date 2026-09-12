# Live tournament setup workspace — 2026-09-11

## Acceptance criteria

- A signed-in director or co-director can open **Set Up Tournament** from the
  protected tournament workspace.
- The screen saves the tournament, Main, Consolation, repeatable Satellite,
  fees, current observed style/game menus, up to two Q Pools, and satellite
  payout selection through the existing versioned server RPC.
- Ambiguous network outcomes retain the exact request for safe retry. Saving a
  draft does not silently create operational events or claim rule approval.
- Team formats remain visibly paper-scored for the October Standard Singles
  pilot.

## Verification evidence

- `pnpm verify`: pass — dependency audit, lint, 226/226 application tests,
  Next.js production build, and 6/6 workspace gates.
- `pnpm verify:handoff`: pass — 6/6 private handoff integrity checks.
- Hosted pilot inspection found one tournament, five profiles, one event, no
  setup revision, and zero tournament-role rows. A controlled transaction
  granted the most recently signed-in non-fixture profile `co_director` access
  to the existing pilot tournament and added a matching immutable audit event.
- Hosted browser verification and release deployment remain to be recorded
  after the reviewed commit reaches Vercel Preview.

## Limitations

- This closes editable setup-draft entry, not operational event activation.
  The current activation boundary still accepts only one approved Standard
  Singles setup event and remains separately release-gated.
- Exact Q-pool payout arithmetic remains unavailable until the current
  authoritative schedule/rounding fixture is confirmed. The setup screen
  records selections and fees; it does not calculate an official payout.
