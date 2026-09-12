# Player game navigation verification — 2026-09-11

## Outcome

Published director-reviewed games are now discoverable by their assigned
digital players through **My Games**. The list puts unresolved games first,
retains verified/corrected games, links unresolved rows to the existing
protected score-entry route, and links completed rows and each represented
event to the verified-only scorecard.

## Evidence

- Migrations `0118_player_assigned_games_reader.sql` through
  `0120_published_player_games_only.sql` are applied to Supabase project
  `fnjkwymxpnsqvxtpronk`.
- Hosted rollback fixture `tests/event-schedule-publication.sql` passed after
  creating a disposable published schedule. It proved two assigned rows for
  one player, zero rows for a tournament viewer without participation, no
  cross-tournament result, permanent Verification ID binding, tournament-date
  formatting, and the intended anon/authenticated grants. A deliberately
  inserted canonical game without director-reviewed publication provenance
  was excluded. The transaction retained no synthetic data.
- `pnpm verify` passed: dependency audit, lint, 247/247 application tests,
  production build, and 6/6 workspace checks.
- `pnpm verify:handoff` passed 6/6 recovered private-handoff checks.
- Supabase advisors were rerun. The new reader is intentionally reported with
  the existing authenticated SECURITY DEFINER reader set; its caller identity
  is `auth.uid()` and cannot be supplied by the browser. The prior reader core
  is private and has no direct browser or service-role execution grant. Private `app` tables
  remain RLS-forced with no direct policies. No new public table exposure was
  introduced. Performance notices remain expected unused-index observations
  on the lightly used pilot.

## Remaining release evidence

The real pilot is intentionally not activated, so it has no genuine player
schedule to display. Production browser verification must therefore confirm
the authenticated empty state at desktop and 375 CSS pixels after deployment;
the populated player path remains part of the later full simulated-tournament
and independent-session gate.
