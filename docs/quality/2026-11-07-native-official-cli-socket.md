> Later update: the exact candidate now passed local official-CLI populated-schema acceptance; see 2026-11-07-native-official-full51.md. Historical attempt notes below are retained, and staging remains held.

# Official CLI atomicity — isolated Unix-socket probe passed

## Supported path and scope

Run the official Linux Supabase CLI inside the same disposable PostgreSQL container and connect through its Unix socket. The test container has network `none`, zero published ports, no host bind mounts and no credentials. A tmpfs replaces the image's declared data volume; PostgreSQL uses disposable `/tmp/cli-pg`. No firewall, daemon setting, access denial, staging project or hosted database was changed. No browser or audit denial was retried.

The official GitHub release v2.121.0 provides `supabase_2.121.0_linux_amd64.tar.gz`. Download SHA256 `4b481189efbdc57cf2d37bdee5f1a0d29574314398564b32a6dfb76c0fcf275f` matches its published `checksums.txt`. The CLI reports2.121.0. It runs on the official Debian image `postgres@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994`. No external package install or runtime network is needed. CLI telemetry is disabled in disposable `/tmp/cli-home`.

Connection: `postgresql://postgres@localhost/fixture_cli_probe?host=%2Ftmp&sslmode=disable`. The host query selects the Unix socket. PostgreSQL listens on no TCP address, and the container has no network, so this cannot reach staging. CLI output says “Connecting to remote database” for explicit `--db-url`; that generic message does not describe the actual local Unix-socket target. The role is a disposable local superuser, not a managed Supabase permission model.

## Executed acceptance

`tests/native-official-cli-socket-local.mjs` completed with exit0:

1. Create a table, then divide by zero. CLI fails; table absent, migration history empty.
2. Correct the known-rolled-back migration; succeeds and records exactly one history row.
3. Add a second migration and a test-only BEFORE INSERT history trigger that raises `intentional_local_history_failure`. CLI fails; second table absent and history remains at one row. This proves DDL and history insert share rollback for this CLI path.
4. Remove only the test failure trigger; retry the identical second migration. Success. Repeat the CLI command; history remains exactly two rows, with no duplicate application.

Evidence: `test-results/native-official-linux-cli-debian-20261107/socket-report.json` and failure/success/history-failure/history-retry/repeat logs. The tiny probe uses fictional schema only; the full51-source candidate was **not** applied.

## Failed attempts and cleanup

The initial internal Docker network could not publish a HostPort. A network-none Alpine trial could not execute the Linux CLI. The first Debian fixture unexpectedly inherited the image's anonymous data volume; its safety check stopped before CLI. That exact volume `8945e7661c32f43d46d7da3549066bbe387a4fc02aef114e214552a0af9cae8a` was identified by mount events bound to the owned container, removed, and independently confirmed absent. Subsequent fixture iterations corrected the tmpfs argument/inspection and URI authority format. These were harness/environment failures, not passes or automatic-review denials, and are retained as separate JSON reports.

Final fixture `1753fb4623a07d339eb37087d34d8f3e6811f300e1a48be8b820efd85d6781ca` was removed. A separate metadata check confirms all five Linux-probe containers and the initial anonymous volume absent (`cleanup-independent.json`). Final report has cleanupVerified true. Downloaded public CLI/image caches remain; they contain no database credential or persistent access.

## Remaining gates

The local transport blocker is resolved. The manifest now records `OFFICIAL_CLI_PROTOCOL_PASSED_FULL_INSTALL_UNVERIFIED`; candidate hash remains `22f9145694802d79d13d50ab36d52e8dc030b1f86649b9cb8a5f2fe733187f58`. Five integrity checks and three SQL lexer checks pass again. Independent review is required before closing this checkpoint.

Next smallest action: run the exact candidate using this proven official runner against the populated fictional0292 baseline, with faithful migration history, ACL/owner and legacy preservation comparisons. The plain Debian probe lacks Supabase extensions and cannot replace that compatibility test. Managed non-superuser privileges, fresh restored staging backup/catalog/data checks, separate hosted approval, scoped event/cohort/access and signed-provider/browser acceptance remain. No human rehearsal, Finance, hosted install or post-commit rollback readiness is claimed.

Official references: [Supabase CLI release](https://github.com/supabase/cli/releases/tag/v2.121.0), [PostgreSQL connection URIs](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING-URIS), [Docker run network modes](https://docs.docker.com/engine/containers/run/#network-settings). This is a protocol probe, not a new payout or scoring policy.
