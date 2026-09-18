# Pre-launch release follow-up

## Scope

This follow-up records the integration and hosted-database proof for pull
request #97. It also provides a connected production-author commit because
Vercel correctly blocked the squash commit attributed to a GitHub collaborator
who is not a member of the Vercel team. The blocked deployment did not run a
build and did not replace the prior Production deployment.

## Additional defects caught before release

1. The new migration scanner converted a file URL by reading `URL.pathname`
   directly. That left percent-encoded spaces on Windows and removed the
   leading slash on Linux, so both GitHub Verify jobs failed before completing
   the suite. It now uses Node's `fileURLToPath` and passes in both checkout
   shapes.
2. Migration 0215 restored the role check inside the team Side Pool election
   function but did not revoke direct browser execution. The migration now
   explicitly revokes `public`, `anon`, and `authenticated`, while preserving
   `service_role` execution for the protected application route.

## Executed evidence

- Local `pnpm verify`: passed, including 590 application tests, lint, provider
  checks, the optimized Next.js build, and workspace verification.
- GitHub Verify for PR #97: both jobs passed after the path repair.
- Vercel preview for PR #97: passed.
- Disposable Supabase project: migrations 0215 and 0216 applied; the repaired
  trigger binding, target-scoped desk lock, and role denial were queried
  directly.
- Rehearsal Supabase project: migrations 0215 and 0216 applied successfully.
  The project retained exactly three tournaments and seven events.
- Hosted permission proof: `anon` and `authenticated` cannot execute the team
  Side Pool election RPC; `service_role` can. The desk check-in RPC is also
  unavailable to the authenticated browser role.
- Supabase security advisor reported only the established informational
  no-policy findings for private, forced-RLS `app` tables. No new exposed-table
  or function warning was introduced by these migrations.

## Remaining evidence

The Production deployment and post-deployment runtime scan must complete from
this connected-author commit. Physical independent-device rehearsal evidence
remains required; this record does not claim that the rehearsal has passed.
