# Local database environment setup — administrator step pending

The owner approved WSL2, Docker Desktop and pinned Supabase CLI setup for an
unlinked disposable local test project. No restart is authorized without asking
at that point. No shared database, production data, real emails or payments.

This historical checkpoint is superseded by the completed execution report:
[Local database execution](2026-10-23-local-database-execution.md).

## Compatibility and official sources

- CIM confirms Microsoft a compatible64-bit Windows11 installation. The old registry ProductName Windows10 is stale.
  Microsoft's release information lists26300.9711 as general availability.
- Windows host with sufficient RAM, HypervisorPresent=true.
  Firmware virtualization/SLAT CIM booleans report false while a hypervisor is
  active, so they are not treated as proof that virtualization is disabled.
- LanmanServer is running with automatic startup. Current process is not an
  elevated Windows administrator, even when sandbox network access is approved.
- Docker's documented personal-use terms remain free. No paid license or
  materially different terms were encountered. Docker was not installed or run.

Sources checked read-only:
https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information
https://docs.docker.com/desktop/setup/install/windows-install/
https://learn.microsoft.com/en-us/windows/wsl/install
https://supabase.com/docs/guides/local-development/cli/getting-started

## Installed and executed

Task-local official Supabase CLI stable2.121.0 (release is not a prerelease):
`../local-db-tools/supabase-2.121.0/supabase.exe` relative to the checkout.
No global PATH or application dependency changes. Official release ZIP checksum:
`2606459BE86E12E03FB6F6B9AA12A02AA00CFE21374857EC837A09C70B837ECA`.
Compared with official release checksums before extraction/execution.
`--version` returned2.121.0; `--help` succeeded. ZIP and checksum file retained
under the task's `local-db-tools` folder. No project initialized or linked.
For sandboxed runs set process-local `SUPABASE_HOME` to
`../local-db-tools/supabase-state`; this was verified with `--version`.
Without that setting a restricted run failed trying to write the CLI telemetry
file under the user profile. The task-local home avoids broadening filesystem
permissions. No persistent environment variable was changed.

## Exact blocked action and outcome

`wsl --install --no-distribution --no-launch` exited1, still reporting WSL not
installed. The supported Microsoft package route was then discovered through
WinGet metadata (official Microsoft GitHub asset, MIT license, version2.7.13).

`winget install --id Microsoft.WSL --exact --version 2.7.13 --source winget --silent --accept-package-agreements --disable-interactivity`

The installer hash verified. Installation failed with Windows error0x80073d28:
administrator privileges required. This is an OS privilege block, not an
automatic approval-review rejection. No retry after that block. The reboot
permission flag was omitted; no restart occurred.

Docker4.96.3 official installer metadata was inspected only. Docker remains
uninstalled. No database stack, migration fixture or actual concurrent RPC test
was executed. Earlier771 application tests/16 browser cases remain separate
evidence and do not prove database execution.

## Smallest next user step

Open Windows Terminal/PowerShell **as administrator**, accept the Windows UAC
prompt, and run the exact pinned WinGet WSL command above. After that succeeds,
in the same elevated terminal run:

`wsl --install --no-distribution --no-launch`

Report the result; do not restart yet. If Windows reports a restart is required,
ask the user to choose/approve the restart before proceeding. Then continue
Docker's supported per-user WSL2 installation, respecting the already authorized
license acceptance, and create only a fresh unlinked synthetic test stack.
Never use a shared/production backend as a substitute.

Cleanup so far is limited to the task-local CLI directory/archive/checksum.
No distribution, database, Docker volume or persistent external credential was
created by this setup attempt. Windows may retain its downloaded package cache.
