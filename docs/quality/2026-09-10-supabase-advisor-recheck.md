# 2026-09-10 Supabase Advisor Recheck

## Scope

Fresh read-only security and performance-advisor checks ran against both the
pilot (`fnjkwymxpnsqvxtpronk`) and the separate empty disposable integration
database (`donfxulkliuyteiannir`). No player, tournament, claim, or payment
records were read.

## Security result

Both projects report the same intentional private-RPC posture:

- 40 private `app` tables have forced RLS and no policies while direct browser
  table grants remain revoked.
- The two currently legacy public-registration `SECURITY DEFINER` functions
  remain anonymously callable. They are the already-recorded path-token
  release blocker and are not a new exposure.
- 31 authenticated `SECURITY DEFINER` functions remain the reviewed,
  role-checked application RPC boundary. This evidence does not replace the
  required real independent-session tests.

## Performance result

The advisor currently reports 13 `unindexed_foreign_keys` INFO notices on both
databases. This corrects an older report that said the notice count was zero.
Catalog inspection shows every listed child lookup already has equivalent
leading-column coverage:

- receipt-scope foreign keys are covered by their globally unique receipt-ID
  indexes;
- setup revision/event foreign keys are covered by indexes leading with the
  globally unique revision/event IDs;
- initial seating and roster links are covered by their existing unique
  tournament/roster or leading publication indexes.

The advisor compares declared foreign-key column order mechanically and does
not recognize those equivalent unique/equality paths. Adding its suggested
duplicates would increase write and storage cost without improving the parent
lookup. No index was added or removed. The databases are empty/synthetic, so
the 91 unused-index notices are likewise not evidence to remove integrity
indexes before representative-load testing.

## Result

No newly discovered browser data exposure or actionable missing-index defect
was found. The secure replacement of the two legacy public registration
functions remains required before any public registration release.
