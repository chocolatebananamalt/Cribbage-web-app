# Director manual roster intake — 2026-09-11

## Acceptance criteria

- A signed-in director or co-director can create a private roster identity from
  a player name and optional email/ACC number without public registration.
- The server rejects malformed, unauthorized, duplicate, idempotency-conflict,
  unavailable-tournament, and post-seating requests.
- Exact retries return the original receipt and do not duplicate the player.
- The operation is audited and does not create an account, role, event
  enrollment, payment, check-in, Table/Seat, verification ID, or score.
- Retry storage contains only the operation ID, never player contact data.

## Verification evidence

- `pnpm verify`: pass — dependency audit, lint, 230/230 application tests,
  Next.js production build, and 6/6 workspace gates.
- `pnpm verify:handoff`: pass — 6/6 private handoff integrity checks.
- Supabase migration `director_manual_roster_intake` applied successfully to
  project `fnjkwymxpnsqvxtpronk`.
- Controlled authenticated pilot transaction: one fictional manual roster row
  was created; exact replay remained one row; a second operation for the same
  identity returned `duplicate_roster_entry`; two receipts and two immutable
  audit events record the accepted and rejected outcomes.
- Post-migration advisors report the existing intentional private-schema/RPC
  pattern. The new table access remains RLS-forced with no direct client table
  grants; the authenticated security-definer RPC is intentionally role-checked.

## Remaining proof

- Vercel Production deployment and external-browser desktop/phone interaction
  are recorded after this commit reaches the hosted application.
- Spreadsheet batch import is not part of this slice. Directors can enter a
  spreadsheet roster one player at a time; a bounded batch import may be added
  after the core pilot path is complete.
