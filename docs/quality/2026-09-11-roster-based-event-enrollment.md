# Roster-based event enrollment — 2026-09-11

## Acceptance criteria

- A checked-in roster member can become an event participant without an app
  account, while an account-linked member retains the identity required for
  digital score submission.
- Enrollment is limited to activated, approved Standard Singles digital
  events and current director/co-director actors.
- One roster identity maps to at most one participant per event. A batch is
  atomic, bounded to 500 unique UUIDs, audited, receipt-bound, and safely
  replayable with the same operation ID.
- Main, Consy, and Standard Singles Satellites have independent enrollment
  lists under the same tournament. Enrollment remains possible after initial
  seating so Main non-qualifiers can later join Consy with their original
  verification IDs.
- The protected UI visibly distinguishes account-linked and paper-only
  participants and can select all checked-in players not already enrolled.

## Verification evidence

- Supabase migration `roster_based_event_enrollment` applied successfully to
  project `fnjkwymxpnsqvxtpronk`.
- A hosted transaction created a disposable activated Standard Singles event,
  one account-linked checked-in roster member, and one paper-only checked-in
  roster member. One batch enrolled both; replay returned the exact result;
  two participants existed with exactly one null profile. The transaction
  rolled back and a residue query returned zero disposable tournaments.
- Supabase advisors were rerun after the migration. The new private conflict
  table has forced RLS and no client policy by design; the new RPCs are
  service-role-only. Existing private-schema no-policy notices, intentional
  authenticated SECURITY DEFINER notices for legacy/user-scoped RPCs, and
  unused-index observations remain the known baseline.
- Focused tests pass 7/7. `pnpm verify` passes with no known production
  dependency vulnerabilities, lint, 239/239 application tests, the Next.js
  production build, and 6/6 workspace gates.
- Commit `7170f8d` was promoted to Vercel Production as deployment
  `dpl_FSgY8KjdS5fTG6dZEY6Lye79HsAP`; the stable domain is
  `https://cribbage-web-app.vercel.app`.
- Authenticated external Chrome loaded the protected **Event Participants**
  page from the stable Production domain. Because the real pilot setup is not
  yet activated, it correctly displayed **Activate tournament events first**
  instead of exposing an unusable enrollment control.

## Remaining proof

- A real narrow-phone visual check and a live accepted enrollment remain. The
  real pilot cannot exercise enrollment until its complete event setup is
  saved and deliberately activated.
- Participant enrollment does not generate rounds, pairings, or games. The
  approved/director-entered schedule boundary remains the next operational
  dependency.
