# 2026-09-18 Tournament Day CSV Import Fallback

## Scope verified

- Added a director/co-director-only **Tournament Day CSV Import** page under the
  tournament workspace registration/payment phase.
- Added a tournament-specific CSV parser, header template, and blank CSV
  download with 100 starter rows and a clearly stated 500-player-per-file
  upload limit. Supported amount columns:
  - `<Event Name> Entry`
  - `<Event Name> Q Pool 1`
  - `<Event Name> Q Pool 2`
  - `<Event Name> Side Pool: <Pool Name>`
- Added migration `0219_tournament_day_csv_import.sql` with service-role-only
  workspace/import RPCs.
- The import:
  - requires First name, Last name, ACC #, Scorecard Type, and Payment Status;
  - accepts adult/youth ACC formats such as `HI296` and `HI296Y`;
  - reuses or creates active roster identities by ACC identity;
  - enrolls selected players in active finalized events;
  - records amount owed for paid and unpaid rows;
  - records received payment evidence only for rows marked `Paid`;
  - leaves rows marked `Unpaid` enrolled but routed to the desk by event QR
    check-in until payment is recorded;
  - records operational Side Pool elections and collections.

## Explicit limitations

- This fallback does not send email, create app-access invitations, process
  online payments, submit to ACC, publish seating, start play, or grant
  score-entry authority.
- Q Pool dollars are included in payment/audit evidence only. The app still
  needs a separate operational Q Pool election ledger before Q Pool elections
  can be managed like Side Pools.
- Side Pool imported collection currently accepts Cash/Check because the
  operational Side Pool ledger is cash/check-shaped.
- CSV files cannot contain real spreadsheet dropdown fields. The downloadable
  template provides the correct columns; spreadsheet-level dropdowns require a
  future `.xlsx` export.
- Hosted Supabase migration execution and authenticated browser proof are still
  pending. The protected page depends on migration 0219 being applied to the
  target backend before it can load real tournament data.

## PR reviewer checklist

### Setup and template

- [ ] Create a new rehearsal tournament without deleting the prior rehearsal.
- [ ] Complete and finalize Tournament Setup with Main, Consolation, Satellite,
  Q Pool, Side Pool, co-director, cross-checker, and judge configuration.
- [ ] Confirm **Tournament Day CSV Import** appears in both the Tournament
  workspace and finalized Setup administration area.
- [ ] Download the tournament-specific blank CSV and confirm it contains 100
  starter rows; adding rows through a maximum of 500 players remains allowed.
- [ ] Confirm its event, Q Pool, and Side Pool columns match the finalized setup.

### CSV validation and import

- [ ] Import valid adult and youth ACC numbers (`HI296`, `HI296Y`).
- [ ] Reject malformed ACC numbers, missing required fields, duplicate ACC
  identities, unknown event/pool columns, invalid amounts, and files over 500
  players without partially importing the file.
- [ ] Confirm Digital/Paper, Paid/Unpaid, and Cash/Check/Digital/Venmo/Zelle/Other
  values are handled as documented.
- [ ] Confirm paid rows create receipt evidence and unpaid rows create amounts
  due without falsely recording payment.
- [ ] Confirm selected events enroll the player and unselected events do not.
- [ ] Confirm Side Pool elections and Cash/Check collections reach the existing
  operational Side Pool ledger.
- [ ] Confirm Q Pool amounts remain payment/audit evidence only; do not treat
  them as a completed operational Q Pool ledger.
- [ ] Retry the exact same import and confirm the idempotent receipt prevents
  duplicated roster, enrollment, payment, or Side Pool records.

### Tournament-day flow

- [ ] Use event QR check-in for a paid imported player and confirm check-in can
  complete for the correct event.
- [ ] Use event QR check-in for an unpaid imported player and confirm the player
  is routed to the desk.
- [ ] Confirm an unregistered/wrong-event player is not silently checked in.
- [ ] Publish seating and schedules, then confirm Digital score entry remains
  locked until that event is started.
- [ ] Complete Digital/Digital, Digital/Paper, and Paper/Paper evidence paths.
- [ ] Confirm only verified or officially corrected results affect the live
  leaderboard.
- [ ] Complete cross-checking and corrections with role and self-review
  restrictions enforced.
- [ ] Generate Main/Consolation qualification, playoff brackets, ACC MRP output,
  Side Pool payout/reconciliation, and Satellite no-MRP results.

### Release proof

- [x] Focused Tournament Day import tests pass locally.
- [x] Repository verification passes locally.
- [x] Private handoff verification passes locally.
- [ ] Apply migration 0219 to the hosted test/production Supabase project.
- [ ] Verify independent Director and Player browser sessions against the hosted
  backend at phone and desktop sizes.
- [ ] Deploy the reviewed PR and complete a production smoke test.
- [ ] Review production runtime logs and record any remaining failures before
  using Tournament Day Mode for live play.

## Commands run

- `node --conditions=react-server --experimental-strip-types --test tests/tournament-day-import.test.mjs`
  - Pass: 5/5.
- `pnpm lint`
  - Pass.
- `pnpm test`
  - Pass: 600/600 application tests.
- `pnpm build`
  - Pass; route `/tournament/[tournamentId]/tournament-day-import` and API
    `/api/v1/tournaments/[id]/tournament-day-import` appear in build output.
- `pnpm providers:check`
  - Pass; manual fallbacks remain declared.
- `node --test tests/workspace.test.mjs`
  - Pass: 8/8.
- `pnpm verify`
  - Pass.
- `pnpm verify:handoff`
  - Pass: 6/6.

## Files changed

- `database/migrations/0219_tournament_day_csv_import.sql`
- `src/lib/api/tournament-day-import.ts`
- `src/lib/roster/tournament-day-csv.ts`
- `src/app/api/v1/tournaments/[id]/tournament-day-import/route.ts`
- `src/app/tournament/[tournamentId]/tournament-day-import/page.tsx`
- `src/app/tournament/[tournamentId]/tournament-day-import/tournament-day-import-client.tsx`
- `src/app/tournament/[tournamentId]/page.tsx`
- `tests/tournament-day-import.test.mjs`
- `docs/operations/DURABLE_PROJECT_MEMORY.md`
- `docs/product/requirements.md`
- `PROJECT_STATUS.md`
