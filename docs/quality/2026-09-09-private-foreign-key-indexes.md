# Private foreign-key index repair

## Finding

The live Supabase performance advisor reported 14 private-schema foreign keys
without covering indexes. The pilot is small, but those missing indexes can
make referential-integrity checks progressively more expensive as append-only
seating, check-in, account-link, and setup histories grow.

## Repair

The advisor requested 14 specific covering B-tree indexes, which were applied
as migration `0058_private_foreign_key_indexes.sql`. Independent review then
confirmed 13 overlap existing unique or leading-column indexes for the same
equality checks. Migration `0059_prune_redundant_private_foreign_key_indexes.sql`
removes those 13 from the empty pilot and retains only
`roster_account_links_profile_id_idx`, the one index without existing usable
leading-column coverage. Neither migration changes a row, table grant, RLS
policy, trigger, function, tournament rule, score, or financial calculation.

Because the local Supabase CLI is not installed, the reviewed migration was
applied through the connected Supabase migration service. The first migration
is recorded as `private_foreign_key_indexes` at version `20260909101945`; the
pruning migration is recorded as
`prune_redundant_private_foreign_key_indexes` at version `20260909102445`.

## Verification

- Direct pilot index catalog inspection confirmed the prior local-column
  indexes did not cover the advisor’s referenced composite keys.
- Supabase performance advisor was rerun after the first application: its
  `unindexed_foreign_keys` lint cleared. It was rerun again after pruning: 13
  INFO-level `unindexed_foreign_keys` notices intentionally returned for the
  existing equivalent index paths the advisor does not recognize by its exact
  covering-index rule. The pilot now has 79 empty-pilot `unused_index` notices.
  Neither notice class certifies capacity or justifies adding/removing indexes
  without representative-load query-plan evidence.
- The static regression test asserts exact initial index table/column
  definitions, the exact 13 pruning statements, retention of the one needed
  profile index, and prohibition of grants, policies, or table alterations.
- Local verification after the review repair passed: lint, 64 tests, production
  build, workspace verification, private-handoff verification, and diff check.
- GitHub Verify run `34340141490` for commit `db93c8d` completed successfully.
  Vercel Preview deployment `dpl_9mCDQZpr7ZGzztkt1HjRcj69gRLU` for the same
  commit is Ready under the explicit Next.js preset. This is preview evidence,
  not a public production release.

## Limits

This resolves the detected index gap, not database capacity certification.
Representative tournament load, query plans, backup/restore, and independent
multi-user operation remain release gates.
