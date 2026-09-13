$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = Join-Path $root 'imports/acc-handoff-2026-09-05'
$manifest = Get-Content -LiteralPath (Join-Path $source 'FILE_SHA256_MANIFEST.txt')
$records = @()
foreach ($line in $manifest) {
  if ($line -notmatch '^([a-f0-9]{64}) \| (\d+) \| (.+)$') { continue }
  $hash = $Matches[1]; $bytes = [long]$Matches[2]; $name = $Matches[3]
  $file = Join-Path $source $name
  if ((Get-Item -LiteralPath $file).Length -ne $bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower() -ne $hash) { throw "Integrity mismatch: $name" }
  $ext = [IO.Path]::GetExtension($name)
  $category = switch ($ext) {
    { $_ -in '.png','.jpg','.jpeg' } { 'docs/design/references'; break }
    { $_ -in '.docx','.pdf' } { 'docs/product/source-documents'; break }
    '.html' { if ($name -match 'v1.3') { 'prototypes/pilot-v1.3' } else { 'archive/prototypes/director-v1.2' }; break }
    '.zip' { 'archive/prototypes/packages'; break }
    default { if ($name -like '*EXTRACTED_TEXT*') { 'docs/product/source-documents' } else { 'docs/private/handoff-context' } }
  }
  $existing = $records | Where-Object { $_.sha256 -eq $hash } | Select-Object -First 1
  if ($existing) { $relative = $existing.organizedPath } else {
    $relative = "$category/$name"
    $destination = Join-Path $root $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    if (Test-Path -LiteralPath $destination) {
      if ((Get-FileHash -LiteralPath $destination).Hash.ToLower() -ne $hash) { throw "Refusing to overwrite changed file: $relative" }
    } else { Copy-Item -LiteralPath $file -Destination $destination }
  }
  $records += [pscustomobject]@{name=$name;bytes=$bytes;sha256=$hash;organizedPath=$relative;duplicateOf=if($existing){$existing.name}else{$null}}
}
if ($records.Count -ne 32) { throw "Expected 32 manifest entries, got $($records.Count)" }
# Structured inventory is generated output, not hand-authored content.
New-Item -ItemType Directory -Force -Path (Join-Path $root 'docs/recovery') | Out-Null
$records | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'docs/recovery/inventory.json') -Encoding utf8
Write-Output "Verified and organized $($records.Count) artifacts. $(@($records | Where-Object duplicateOf).Count) exact duplicates share a working copy. Originals preserved."
