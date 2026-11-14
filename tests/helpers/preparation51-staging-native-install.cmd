@echo off
setlocal
title Cribbage TEST preparation update - private password
if /I not "%~dp0"=="C:\Users\choco\Documents\Codex\2026-10-22\task\staging-recovery-20261107-eb52816c\" goto invalid
set "DOCKER=C:\Users\choco\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
set "PGPASSWORD="
set "SUPABASE_DB_PASSWORD="
set "SUPABASE_ACCESS_TOKEN="
if exist "%~dp0preparation51-install-started.txt" goto exists
if not exist "%~dp0private\preparation51-release-inputs\project\supabase\migrations\20261107090229_native_preparation51_closed_install.sql" goto invalid
"%DOCKER%" --context desktop-linux context inspect desktop-linux --format "{{.Endpoints.docker.Host}}" > "%~dp0preparation51-context.txt"
if errorlevel 1 goto invalid
set /p ENDPOINT=<"%~dp0preparation51-context.txt"
if /I not "%ENDPOINT%"=="npipe:////./pipe/dockerDesktopLinuxEngine" goto invalid
"C:\Users\choco\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -E -c "import sys,json,hashlib;from pathlib import Path;r=Path(sys.argv[1]);m=r/'preparation51-input-manifest.json';assert hashlib.sha256(m.read_bytes()).hexdigest()=='da36d33cf6aeda9416c240db6b4435cea7ca46ea49bd5cf35f90ed455ce2561b';a=json.loads(m.read_text());p=r/'private/preparation51-release-inputs';assert len(a)==295;assert len({x['path'].casefold() for x in a})==295;assert {str(f.relative_to(p)) for f in p.rglob('*') if f.is_file()}=={x['path'] for x in a};assert all(not f.is_symlink() and not(getattr(f.lstat(),'st_file_attributes',0) & 1024) for f in p.rglob('*'));assert all((p/x['path']).resolve().is_relative_to(p.resolve()) and (p/x['path']).stat().st_size==x['bytes'] and hashlib.sha256((p/x['path']).read_bytes()).hexdigest()==x['sha256'] for x in a)" "%~dp0."
if errorlevel 1 goto invalid
echo started>"%~dp0preparation51-install-started.txt"
if errorlevel 1 goto invalid
findstr /X /C:"started" "%~dp0preparation51-install-started.txt" >nul
if errorlevel 1 goto invalid
echo TEST database only: cribbage-pr122-staging / nnhcnvksxgxnpvdqjgpg
echo This installs the reviewed preparation-only update. Cohort access stays CLOSED.
echo If asked, enter the EXISTING test database password privately. Never send it in chat.
echo Do not close the window while the migration runs. No debug or password log is enabled.
"%DOCKER%" --context desktop-linux run --rm --pull=never -it --name cribbage-preparation51-staging-install --label codex.release=preparation51-20261107 --network bridge --log-driver none --cap-drop ALL --security-opt no-new-privileges --user postgres --mount "type=bind,source=%~dp0private\preparation51-release-inputs,target=/work,readonly" --entrypoint /bin/sh postgres@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994 -c "tar -xzf /work/supabase_2.121.0_linux_amd64.tar.gz -C /tmp && cp -R /work/project /tmp/preparation51-project && SUPABASE_HOME=/tmp/preparation51-home /tmp/supabase telemetry disable && SUPABASE_HOME=/tmp/preparation51-home /tmp/supabase migration up --db-url 'postgresql://postgres.nnhcnvksxgxnpvdqjgpg@aws-0-us-east-2.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=/work/supabase-ca.crt' --workdir /tmp/preparation51-project --yes --agent no"
set "INSTALL_RC=%ERRORLEVEL%"
>"%~dp0preparation51-install-exit-code.txt" echo %INSTALL_RC%
if not "%INSTALL_RC%"=="0" goto failed
echo finished_unverified>"%~dp0preparation51-install-stage.txt"
echo Command finished. Independent database verification is still required.
pause
exit /b 0
:failed
echo failed_or_uncertain>"%~dp0preparation51-install-stage.txt"
echo STOPPED. Do not retry. The assistant must check the database outcome first.
pause
exit /b %INSTALL_RC%
:exists
echo An earlier attempt exists. Do not retry; check its outcome first.
pause
exit /b 3
:invalid
echo Preflight failed; no migration command was issued.
pause
exit /b 4
