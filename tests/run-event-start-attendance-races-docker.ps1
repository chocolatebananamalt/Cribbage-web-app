$ErrorActionPreference = "Stop"

$containerName = "supabase_db_cribbage-isolated-db-20261023"
$projectName = "cribbage-isolated-db-20261023"
$databaseName = "postgres"
$dockerContext = "desktop-linux"
$expectedDockerEndpoint = "npipe:////./pipe/dockerDesktopLinuxEngine"
$expectedProjectLabel = "com.supabase.cli.project"
$docker = Get-Command docker -ErrorAction Stop

if (-not [string]::IsNullOrWhiteSpace($env:DOCKER_HOST)) {
  throw "DOCKER_HOST overrides are refused for this local-only test."
}
if (-not [string]::IsNullOrWhiteSpace($env:DOCKER_CONTEXT) -and $env:DOCKER_CONTEXT -ne $dockerContext) {
  throw "DOCKER_CONTEXT must be empty or desktop-linux for this local-only test."
}
$contextEndpoint = (& $docker.Source --context $dockerContext context inspect $dockerContext --format "{{.Endpoints.docker.Host}}" 2>$null)
if ($LASTEXITCODE -ne 0 -or ($contextEndpoint -join "").Trim() -ne $expectedDockerEndpoint) {
  throw "The desktop-linux context does not target the expected local Docker Desktop named pipe."
}

$running = (& $docker.Source --context $dockerContext inspect --format "{{.State.Running}}" $containerName 2>$null)
if ($LASTEXITCODE -ne 0 -or ($running -join "").Trim() -ne "true") {
  throw "The exact disposable database container is not running: $containerName"
}
$labelsJson = (& $docker.Source --context $dockerContext inspect --format "{{json .Config.Labels}}" $containerName 2>$null)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the disposable database container labels." }
$labels = ($labelsJson -join "") | ConvertFrom-Json
if ($labels.$expectedProjectLabel -ne $projectName) {
  throw "The database container does not carry the exact isolated Supabase project label."
}
$portsJson = (& $docker.Source --context $dockerContext inspect --format "{{json .NetworkSettings.Ports}}" $containerName 2>$null)
if ($LASTEXITCODE -ne 0) { throw "Could not inspect the disposable database container port bindings." }
$ports = ($portsJson -join "") | ConvertFrom-Json
foreach ($port in $ports.PSObject.Properties) {
  foreach ($binding in @($port.Value)) {
    if ($null -ne $binding -and $binding.HostIp -ne "127.0.0.1") {
      throw "Every published database-container binding must use explicit 127.0.0.1."
    }
  }
}

$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$evidenceRoot = Join-Path (Split-Path -Parent $testRoot) "test-results\dependency-security"
$evidenceLog = Join-Path $evidenceRoot "0236-event-start-attendance-race-evidence.log"
[void](New-Item -ItemType Directory -Force -Path $evidenceRoot)
Set-Content -LiteralPath $evidenceLog -Value "0236 isolated RPC race evidence (synthetic IDs only)"
$seedScript = Join-Path $testRoot "event-start-attendance-concurrency-seed.sql"
$sessionAScript = Join-Path $testRoot "event-start-attendance-race-session-a.sql"
$sessionBScript = Join-Path $testRoot "event-start-attendance-race-session-b.sql"

function Write-RaceEvidence {
  param([Parameter(Mandatory = $true)][string]$Message)
  Add-Content -LiteralPath $evidenceLog -Value $Message
  Write-Output $Message
}

function Start-ContainerPsql {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [string]$Scenario = ""
  )
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $docker.Source
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($argument in @("--context", $dockerContext, "exec", "-i", $containerName, "psql", "-X", "-U", "postgres", "-d", $databaseName, "-v", "ON_ERROR_STOP=1")) {
    [void]$startInfo.ArgumentList.Add($argument)
  }
  if (-not [string]::IsNullOrWhiteSpace($Scenario)) {
    [void]$startInfo.ArgumentList.Add("-v")
    [void]$startInfo.ArgumentList.Add("scenario=$Scenario")
  }
  [void]$startInfo.ArgumentList.Add("-f")
  [void]$startInfo.ArgumentList.Add("-")
  $process = [System.Diagnostics.Process]::Start($startInfo)
  $process.StandardInput.Write((Get-Content -LiteralPath $ScriptPath -Raw))
  $process.StandardInput.Close()
  return $process
}

function Complete-ContainerPsql {
  param(
    [Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process,
    [string]$PriorOutput = ""
  )
  $output = $PriorOutput + $Process.StandardOutput.ReadToEnd()
  $errorOutput = $Process.StandardError.ReadToEnd()
  $Process.WaitForExit()
  if ($Process.ExitCode -ne 0) {
    throw "Container psql failed. Discard the isolated project before retrying.`n$output`n$errorOutput"
  }
  return $output
}

$seedProcess = Start-ContainerPsql -ScriptPath $seedScript
$seedOutput = Complete-ContainerPsql -Process $seedProcess
if ($seedOutput -notmatch "EVENT_START_ATTENDANCE_CONCURRENCY_SEED_COMMITTED") {
  Add-Content -LiteralPath $evidenceLog -Value "FAIL: committed synthetic seed marker missing; restore the isolated database."
  throw "The committed synthetic seed marker was missing. Discard the isolated project before retrying."
}
Write-RaceEvidence "EVENT_START_ATTENDANCE_CONCURRENCY_SEED_COMMITTED"

$scenarios = @("qr_close", "start_reopen", "desk_start", "start_enrollment", "repeated_start")
foreach ($scenario in $scenarios) {
  $aProcess = Start-ContainerPsql -ScriptPath $sessionAScript -Scenario $scenario
  $aLines = [System.Collections.Generic.List[string]]::new()
  $marker = "EVENT_START_ATTENDANCE_A_READY_$scenario"
  $markerSeen = $false
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) {
    $remainingMs = [Math]::Max(1, [int]($deadline - [DateTime]::UtcNow).TotalMilliseconds)
    $readTask = $aProcess.StandardOutput.ReadLineAsync()
    if (-not $readTask.Wait($remainingMs)) {
      $aProcess.Kill($true)
      Add-Content -LiteralPath $evidenceLog -Value "FAIL: $scenario timed out before session A's reviewed marker."
      throw "Timed out waiting for session A's post-RPC lock-held marker for $scenario. Discard the isolated project."
    }
    $line = $readTask.Result
    if ($null -eq $line) { break }
    $aLines.Add($line)
    if ($line.Trim() -eq $marker) { $markerSeen = $true; break }
  }
  if (-not $markerSeen) {
    $aError = $aProcess.StandardError.ReadToEnd()
    $aProcess.WaitForExit()
    Add-Content -LiteralPath $evidenceLog -Value "FAIL: $scenario session A exited before its reviewed marker."
    throw "Session A exited before its lock-held marker for $scenario. Discard the isolated project.`n$($aLines -join [Environment]::NewLine)`n$aError"
  }

  try {
    $bProcess = Start-ContainerPsql -ScriptPath $sessionBScript -Scenario $scenario
    $bOutput = Complete-ContainerPsql -Process $bProcess
    $aOutput = Complete-ContainerPsql -Process $aProcess -PriorOutput (($aLines -join [Environment]::NewLine) + [Environment]::NewLine)
  } catch {
    Add-Content -LiteralPath $evidenceLog -Value "FAIL: $scenario did not complete; restore the isolated database before retrying."
    throw
  }
  if ($bOutput -notmatch "EVENT_START_ATTENDANCE_B_COMMITTED_$scenario") {
    Add-Content -LiteralPath $evidenceLog -Value "FAIL: $scenario session B committed marker missing."
    throw "Session B's committed assertion marker was missing for $scenario. Discard the isolated project."
  }
  if ($aOutput -notmatch "EVENT_START_ATTENDANCE_A_COMMITTED_$scenario") {
    Add-Content -LiteralPath $evidenceLog -Value "FAIL: $scenario session A committed marker missing."
    throw "Session A's committed assertion marker was missing for $scenario. Discard the isolated project."
  }
  Write-RaceEvidence "EVENT_START_ATTENDANCE_A_COMMITTED_$scenario"
  Write-RaceEvidence "EVENT_START_ATTENDANCE_B_COMMITTED_$scenario"
  Write-RaceEvidence "PASS: $scenario serialized and persisted the expected RPC outcome."
}

Write-RaceEvidence "PASS: all 0236 RPC races completed against $containerName. Discard the isolated project now."
