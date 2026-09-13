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
- The recovered fixture tournament used a non-RFC UUID and could not safely be
  exposed through application routes. A new RFC-valid pilot tournament was
  created at `76e9ee59-d939-447c-a175-5be45b978c55`, with audited director and
  co-director roles and a versioned Standard Main setup draft.
- Commit `1dcbde0` deployed to Vercel Production as
  `dpl_8jpYeStCe3S7EN19xnRrTwqk9krV`. External Chrome opened the protected
  tournament and setup routes, edited the city, and saved setup version 2.
  Adding two Satellite event cards produced independent Satellite 2 and 3
  controls with the expected menus; those temporary cards were discarded.

## Limitations

- This closes editable setup-draft entry, not operational event activation.
  The current activation boundary still accepts only one approved Standard
  Singles setup event and remains separately release-gated.
- Exact Q-pool payout arithmetic remains unavailable until the current
  authoritative schedule/rounding fixture is confirmed. The setup screen
  records selections and fees; it does not calculate an official payout.
- Desktop hosted proof passes. A true 320/375-pixel retained-session browser
  proof remains unavailable because the external-browser controller does not
  expose viewport resizing on this host.
