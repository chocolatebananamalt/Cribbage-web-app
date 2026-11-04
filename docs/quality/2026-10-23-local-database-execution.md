# Isolated local database execution

Supersedes the earlier unavailable-database and administrator-step reports.
The owner approved WSL2, Docker Desktop licensing/setup and isolated synthetic
testing. No Windows restart occurred. No production/shared backend, deployment,
real message/payment or external credential was used.

## Environment

- Windows11 Home26H2,26300.9711,31.4GB RAM; VirtualMachinePlatform enabled.
  WSL2.7.13 was installed by the user after Windows required administrator rights.
  Read-only readiness checks found no WSL2 error or component/update reboot flag.
  WSL1 remains disabled; it is not needed.
- Official Docker Desktop4.96.3 installed per-user with the authorized license
  acceptance, WSL2 backend, no Windows containers. Installer SHA256 and valid
  Docker Inc Authenticode signature checked before execution. Engine29.9.2.
- Official pinned Supabase CLI2.121.0, checksum verified, task-local home/state;
  no application dependency or global Supabase PATH change.
- Fresh unlinked project/network `cribbage-isolated-db-20261023`, PostgreSQL17.11
  image `public.ecr.aws/supabase/postgres:17.11.0.004`. Actual `auth.users` and
  `storage.buckets` existed before repository migrations; application schema was
  absent. No production environment file or connection URL was copied.

## Local binding repair

The documented custom-network localhost option did not constrain the observed
published ports: initial empty containers showed0.0.0.0/[::]. Startup was
interrupted; detached startup continued, so all exact-project containers were
stopped before any repository migration or test data.

An independently reviewed one-off helper in the task-local project recreated
only published container bindings as127.0.0.1, retaining stopped originals and
named volumes. It pins the local desktop-linux named pipe, validates exact
project/name/image identity, reconciles uncertain create outcomes, and verifies
configuration, mounts and aliases. Docker normalizes OomKillDisable null to
false; only that default-equivalent difference is normalized. No daemon,
firewall, host-security or vendor-source change was made.

Kong's CLI-generated writable-layer config/TLS files were restored bytewise from
its stopped original, preserving metadata and without printing file contents.
Database/API/mailbox runtime bindings were then verified at127.0.0.1 ports54322,
54321 and54324. Database/Auth/Storage/Kong/Mailpit became healthy; REST runs
without a Docker healthcheck. Generated metadata and local keys remain outside
the checkout and must not be uploaded.

## Executed SQL evidence

- All236 repository migrations,0001–0236, applied in order with ON_ERROR_STOP and
  a transaction per file: exit0. Raw logs in the task-local isolated project:
  `migration-progress.log`, `migration-execution.log`.
- Reviewed0236 rollback integration fixture: exit0, ending ROLLBACK. Attendance
  gates, accepted exact replay, revoked-role rejection, post-start enrollment
  rejection and no duplicate receipt/start assertions executed in PostgreSQL.
  `test-results/dependency-security/guard-runtime-final.log`.
- Actual privilege reads: anon/authenticated start=false; service-role public
  start=true; service-role legacy start=false; obsolete QR RPC=false.
  `test-results/dependency-security/database-grants-runtime.log`.
- Empty post0236 baseline: auth.users0, app.tournaments0; pg_dump custom-format
  backup3486538bytes, SHA256
  `e0590cbc594af424f3bfd0066ca046ad2a6b0c972d8ce92bb170d9c8e3c92cdc`.

## Fixture corrections and recovery

Actual execution caught fixture defects that static checks did not:

1. Roster rows must be inserted while registration is open. Both fixtures now
   close registration only after roster/check-in setup; no freeze guard bypass.
2. The committed race seed needs one revision-scoped director official row to
   satisfy the deferred official-count constraint. Failed seed transaction was
   confirmed completely rolled back before retry: users0/tournaments0.
3. The final repeated-start assertion used an unquoted psql t/f substitution.
   It now casts a quoted variable to boolean. Intentional psql `\if :bool`
   remains. The race runner records sanitized markers incrementally.

Each correction received independent Sol review. No expected RPC result or
application/database guard was relaxed. A partial committed race run requires
restoring/discarding the whole disposable database, never selectively deleting
immutable receipt/audit rows. The pre-seed dump and failed-state dump stay local.

Actual race rerun and final verification results are recorded below when complete.

## Final runtime result

All five real concurrent PostgreSQL RPC scenarios passed (exit0): QR versus
attendance close, start versus attendance reopen, desk check-in versus start,
start versus enrollment, and repeated start with distinct keys plus exact replay.
Each used independent psql sessions, a lock-held marker, measured waiting, and
persisted-result/cardinality assertions. Evidence:
`test-results/dependency-security/races-final.log` and
`0236-event-start-attendance-race-evidence.log` in the same directory.
The rollback fixture passed again afterward (exit0, ROLLBACK).

The first database recovery attempt failed: `postgres` is not the cluster
superuser, and pg_net/pg_cron workers prevented its DROP DATABASE. Because
pg_restore continued after errors, that disposable database was treated as
uncertain. It was not reused for proof. Independently reviewed recovery connected
to template1 as the built-in local supabase_admin, force-dropped the entire
synthetic postgres database, and restored the checksum-pinned baseline with
--exit-on-error, preserving archive ownership and grants. Verified users0,
tournaments0, guard present, forbidden grants false, database owner postgres and
connections allowed before the successful rerun. No role or security settings
were changed. Local logs: recovery-reviewed.log and recovery-validation.log.
The earlier restore-empty-baseline.mjs helper is failed diagnostic history and
must not be reused.

All nine exact-project containers, including stopped binding backups, are now
stopped. Docker Desktop/WSL/CLI remain installed; no restart is required by the
executed checks. Local images, named volumes and dumps are retained as evidence
outside the checkout. Discard this one-shot project before another run; do not
rerun its committed seed or selectively delete audit rows. No shared/production
database was contacted. No real emails or payments were sent.

This closes the isolated SQL execution gap. Direct database sessions do not prove
staging HTTP authorization, live SMTP delivery, multiple physical devices,
offline synchronization, payout policy or complete final-results behavior.

Final aggregate after SQL fixture corrections: `pnpm verify` exit0,
772/772 application tests; production audit0; lint0errors/2existingwarnings;
provider fallbacks pass; Next16.4.2 build and TypeScript pass; workspace7pass and
1 expected private-handoff skip. Log: verify-database-final.log. Initial sandbox
attempt failed a registry fetch; the authorized network-capable rerun passed.
Full audit remains1 development-only high advisory, as documented in the
security report; production audit was13 and is now0. Prior synthetic browser
16/16 results remain applicable because subsequent edits were SQL fixtures,
test harnesses and evidence documentation only.

Final teardown: all nine exact-project containers, both exact named volumes
(supabase_db_cribbage-isolated-db-20261023 and
supabase_storage_cribbage-isolated-db-20261023), and the dedicated test network
were removed successfully (exit0). This supersedes the intermediate stopped-only
state above. Sanitized logs, local dumps and installed tools/images remain;
no global prune or unrelated-container cleanup was performed. Independent Sol
runtime review passed: no introduced SQL/concurrency blocker.
