# Protected check-in name search verification

Date: 2026-09-11 (Pacific/Honolulu)

## Acceptance criteria

1. The protected director/co-director check-in workspace provides a visible
   player-name search before the roster.
2. Search is case-insensitive, ignores surrounding whitespace, and matches
   partial names.
3. The interface reports the displayed and total player counts and provides an
   explicit no-match result.
4. Filtering changes only the displayed roster. Check-in state, registration
   closure, checked-in-player calculations, and initial seating continue to
   consume the complete server-provided roster.
5. The public synthetic demonstration mirrors the interaction without reading
   Supabase or exposing operational tournament data.

## Evidence

- `tests/check-in-search.test.mjs`: PASS, covering empty/whitespace, mixed-case
  partial matches, and no-match behavior.
- `tests/dashboard-semantics.test.mjs`: PASS, covering the accessible search,
  count/no-match text, and the invariant that `present` and `draft` continue to
  use the complete `checkIn` array rather than the filtered view.
- Focused ESLint and TypeScript checks: PASS.
- `pnpm verify`: PASS after the complete implementation; 221/221 application
  tests, dependency audit, lint, production build, and workspace checks.
- `pnpm verify:handoff`: PASS; 6/6 recovered private-handoff checks.
- External Chrome desktop interaction against local Next.js: PASS. Operations
  → Players & Check-In rendered four synthetic players; entering `paper`
  displayed only Paper Guest and announced “Showing 1 of 4 players.” The page
  had no error overlay.

## Limitations

- The protected page was not opened with a real director session because no
  live tournament role or test account was invented for this UI-only change.
  Its server workspace, role gate, and mutation routes are unchanged.
- The available external-browser controller cannot set a phone viewport, and
  the separate `agent-browser` executable is unavailable on this host. The
  responsive CSS keeps the search and count stacked below 700 pixels, but a
  real narrow-phone visual pass remains required before this item is called
  release-complete.
- No Supabase table, RPC, role, policy, hosted setting, or pilot data changed.

## Result

The requested production behavior is implemented and locally verified except
for the required narrow-phone visual evidence. It is safe to retain as an
incomplete production slice while that evidence is scheduled with the broader
authenticated phone/desktop pilot test.
