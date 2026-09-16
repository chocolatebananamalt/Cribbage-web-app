# Four co-director roles — 2026-09-15

Acceptance: one primary director plus at most four active/pending co-directors;
exact-email explicit acceptance; immediate revocation; audited, server-only
role lifecycle; five-official setup snapshots; existing rehearsal observer is
not duplicated.

Executed locally: `pnpm exec tsc --noEmit`,
`node --test tests/four-co-director-roles.test.mjs`, and `git diff --check`.
The focused regression test passed. The production migration was applied to
`fnjkwymxpnsqvxtpronk`; security inspection confirmed each new SECURITY DEFINER
function is executable by `service_role` only, not `anon` or `authenticated`.
The rehearsal contains one primary director and one existing co-director.

Limitation: this repository run did not substitute for the next physical,
independent-account invitation acceptance and revocation exercise. The
repository-wide `pnpm verify` was started, but the desktop runner yielded after
lint output before it returned an aggregate result; it must be rerun to
completion in CI before release promotion.
