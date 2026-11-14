@echo off
setlocal
title Cribbage TEST backup - private password
if /I not "%~dp0"=="C:\Users\choco\Documents\Codex\2026-10-22\task\staging-recovery-20261107-eb52816c\" goto wrong_location
set "DOCKER=C:\Users\choco\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
set "PGPASSWORD="
set "SUPABASE_DB_PASSWORD="
if exist "%~dp0private\current.dump" goto existing_output
if not exist "%~dp0private\" goto wrong_location
if not exist "%~dp0supabase-ca.crt" goto missing_ca
certutil -hashfile "%~dp0supabase-ca.crt" SHA256 | findstr /I /X /C:"700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7" >nul
if errorlevel 1 goto bad_ca
"%DOCKER%" --context desktop-linux context inspect desktop-linux --format "{{.Endpoints.docker.Host}}" > "%~dp0context-endpoint.txt"
if errorlevel 1 goto failed_preflight
set /p ENDPOINT=<"%~dp0context-endpoint.txt"
if /I not "%ENDPOINT%"=="npipe:////./pipe/dockerDesktopLinuxEngine" goto failed_preflight
echo awaiting_private_password>"%~dp0stage.txt"
echo TEST database only: cribbage-pr122-staging / nnhcnvksxgxnpvdqjgpg
echo This creates a private local database archive. It installs nothing.
echo Enter the EXISTING test-database password at the Password prompt.
echo Characters do not appear while you type. Press Enter once.
echo Do not put the password in chat. Do not close this window while export runs.
echo.
"%DOCKER%" --context desktop-linux run --rm --pull=never -it --name cribbage-staging-recovery-eb52816c --label codex.recovery=staging-recovery-20261107-eb52816c --network bridge --log-driver none --cap-drop ALL --security-opt no-new-privileges --user postgres --env PGSSLMODE=verify-full --env PGSSLROOTCERT=/tls/root.crt --env PGCONNECT_TIMEOUT=20 --env PGAPPNAME=cribbage-readonly-recovery-eb52816c --mount "type=bind,source=%~dp0private,target=/backup" --mount "type=bind,source=%~dp0supabase-ca.crt,target=/tls/root.crt,readonly" --entrypoint pg_dump sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706 -h aws-0-us-east-2.pooler.supabase.com -p 5432 -U postgres.nnhcnvksxgxnpvdqjgpg -d postgres -W -Fc --lock-wait-timeout=10000 --file=/backup/current.dump
set "EXPORT_RC=%ERRORLEVEL%"
>"%~dp0private\export-exit-code.txt" echo %EXPORT_RC%
if not "%EXPORT_RC%"=="0" goto export_failed
echo export_finished_unverified>"%~dp0stage.txt"
echo.
echo Export finished. Restore and integrity verification are still required.
echo Keep the archive. It has not been uploaded and nothing has been installed.
pause
exit /b 0
:export_failed
echo export_failed>"%~dp0stage.txt"
echo.
echo Export returned an error. The archive is not a verified recovery point.
echo Leave any partial file in place for safe status checking.
pause
exit /b %EXPORT_RC%
:existing_output
echo Refusing to overwrite an existing archive.
pause
exit /b 8
:missing_ca
echo Verified certificate file is missing. Nothing exported.
pause
exit /b 9
:bad_ca
echo Certificate checksum changed or could not be verified. Nothing exported.
pause
exit /b 12
:wrong_location
echo This helper must run only from its reviewed protected recovery folder.
pause
exit /b 10
:failed_preflight
echo Local Docker context check failed. Nothing exported.
pause
exit /b 11
