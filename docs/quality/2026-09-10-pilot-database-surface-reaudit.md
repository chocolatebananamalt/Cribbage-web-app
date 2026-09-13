# Pilot database surface re-audit — 2026-09-10

## Acceptance criterion

Prove that the current pilot's private application tables and privileged
functions cannot be invoked or read directly by an anonymous browser caller,
and distinguish intentional, role-checked browser RPCs from an anonymous
privilege-escalation defect.

## Live pilot examined

- Supabase project: `fnjkwymxpnsqvxtpronk`
- Migration history: through `foreign_key_coverage` (`0089` local migration)

## Live catalog evidence

Read-only catalog queries produced the following exact results:

| Check | Result |
| --- | --- |
| `app` tables | 43 |
| `app` tables with RLS enabled | 43 / 43 |
| `app` tables accessible to `anon` | 0 |
| `app` tables accessible to `authenticated` directly | 0 |
| `app` `SECURITY DEFINER` functions | 30 |
| `app` definer functions executable by `anon` | 0 |
| `app` definer functions executable through `PUBLIC` | 0 |
| `app` definer functions executable by `authenticated` | 0 |
| `app` definer functions missing explicit `search_path` | 0 |

The public-schema advisor warning corresponds to 29 intentional,
authenticated-only, `SECURITY DEFINER` RPCs. For every one, the catalog shows
`anon_execute = false`, `public_execute = false`, and an empty explicit search
path. These are the narrowly exposed operations/readers that must validate the
caller and tournament role inside their own function body. They are not direct
table access and are not anonymous endpoints.

The security advisor still reports:

1. `rls_enabled_no_policy` as informational for private `app` tables. The
   catalog proves those tables have neither anonymous nor authenticated table
   grants; RLS remains defense in depth.
2. `authenticated_security_definer_function_executable` for the 29 deliberate
   authenticated RPCs described above. The warning cannot be dismissed as a
   platform false positive; independent signed-in authorization tests remain a
   release gate for each workflow.
3. `auth_leaked_password_protection`. The user declined a paid Supabase plan
   upgrade solely for that control, and the intended app flow is passwordless
   magic-link authentication. Hosted provider configuration remains a release
   gate: the password provider must be disabled, or equivalent approved
   protection must be enabled before public release.

## Conclusion

No new P0/P1 database-surface exposure was found in this re-audit. The pilot
remains **not production-ready**: browser-session authorization, hosted auth
provider configuration, and all incomplete product workflows are separately
required evidence.

## Verification performed

- Retrieved Supabase's current security guidance for `SECURITY DEFINER`,
  explicit function grants, and RLS.
- Re-ran pilot security and performance advisors.
- Queried the live catalog for per-role table privileges, per-role function
  execute privileges, schema, and explicit function search paths.
- Confirmed migration history includes the latest applied local migration.

No data, grants, migration history, or production configuration was changed by
this audit.
