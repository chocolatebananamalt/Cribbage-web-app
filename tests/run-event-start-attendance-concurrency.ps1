param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Database
)

$ErrorActionPreference = "Stop"
$allowedHosts = @("localhost", "127.0.0.1", "::1")
if ([string]::IsNullOrWhiteSpace($env:PGHOST) -or $allowedHosts -notcontains $env:PGHOST) {
  throw "Set PGHOST to localhost, 127.0.0.1, or ::1. Remote databases are refused."
}
if (-not [string]::IsNullOrWhiteSpace($env:PGSERVICE)) {
  throw "PGSERVICE is refused because it can override the local database host."
}
if (-not [string]::IsNullOrWhiteSpace($env:PGHOSTADDR) -and $allowedHosts -notcontains $env:PGHOSTADDR) {
  throw "PGHOSTADDR must be empty or loopback. Remote databases are refused."
}
if ($Database -notmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]*$') {
  throw "Database must be a plain local database name, not a URI or conninfo string."
}

$psql = Get-Command psql -ErrorAction Stop
$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sessionA = Join-Path $testRoot "event-start-attendance-lock-session-a.sql"
$sessionB = Join-Path $testRoot "event-start-attendance-lock-session-b.sql"
$eventId = "e2360000-0000-4000-8000-000000000099"
$databaseArgs = @("-d", $Database)
$aArgs = @("-X", "-h", $env:PGHOST, "-v", "ON_ERROR_STOP=1", "-v", "event_id=$eventId", "-f", $sessionA) + $databaseArgs
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $psql.Source
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
foreach ($argument in $aArgs) { [void]$startInfo.ArgumentList.Add($argument) }

$aProcess = [System.Diagnostics.Process]::Start($startInfo)
Start-Sleep -Milliseconds 750
$bOutput = & $psql.Source -X -h $env:PGHOST -v ON_ERROR_STOP=1 -v "event_id=$eventId" -f $sessionB @databaseArgs 2>&1
if ($LASTEXITCODE -ne 0) { throw "Session B failed: $($bOutput -join [Environment]::NewLine)" }
$aOutput = $aProcess.StandardOutput.ReadToEnd()
$aError = $aProcess.StandardError.ReadToEnd()
$aProcess.WaitForExit()
if ($aProcess.ExitCode -ne 0) { throw "Session A failed: $aError" }
if ($aOutput -notmatch "session_a_held_event_lifecycle_lock") { throw "Session A assertion marker was missing." }
if (($bOutput -join "`n") -notmatch "session_b_waited_for_event_lifecycle_lock") { throw "Session B wait assertion marker was missing." }
Write-Output "PASS: independent local sessions serialized on the event attendance lifecycle lock."
