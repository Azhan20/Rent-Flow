[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ConfigRoot,
  [Parameter(Mandatory=$true)][string]$BackupRoot
)

Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$modulePath = Join-Path $PSScriptRoot 'rentflow-test-backup.helpers.psm1'
Import-Module -Name $modulePath -Force -ErrorAction Stop

$stage = 'preflight'
$stageDirectory = $null
$finalDirectory = $null
$reservationPath = $null
$reservationOwned = $false
$stageOwned = $false
$pgEnvironmentConfigured = $false
$validatorCaEnvironmentConfigured = $false
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$pgDump = Join-Path $pgBin 'pg_dump.exe'
$pgRestore = Join-Path $pgBin 'pg_restore.exe'
$psql = Join-Path $pgBin 'psql.exe'
$serviceName = 'rentflow_test_logical_backup'

try {
  Assert-NoInheritedPgOverrides
  $configPath = Assert-SafeLocalExistingPath -Path $ConfigRoot -Label 'ConfigRoot' -RepositoryRoot $repoRoot
  $backupPath = Assert-SafeLocalExistingPath -Path $BackupRoot -Label 'BackupRoot' -RepositoryRoot $repoRoot
  if (-not (Get-Item -LiteralPath $configPath -Force).PSIsContainer -or
      -not (Get-Item -LiteralPath $backupPath -Force).PSIsContainer) { throw 'ConfigRoot and BackupRoot must be existing directories.' }
  if ((Test-PathAtOrBelow -Path $configPath -Root $backupPath) -or
      (Test-PathAtOrBelow -Path $backupPath -Root $configPath)) { throw 'ConfigRoot and BackupRoot must be separate, non-nested directories.' }

  $serviceFile = Join-Path $configPath 'pg_service.conf'
  $passFile = Join-Path $configPath 'pgpass.conf'
  foreach ($path in @($serviceFile,$passFile)) {
    [void](Assert-SafeLocalExistingPath -Path $path -Label 'ProtectedConfigFile' -RepositoryRoot $repoRoot)
    if ((Get-Item -LiteralPath $path -Force).PSIsContainer) { throw 'Service and pass files must be regular files.' }
  }

  $expected = Get-ExpectedSupabaseTestBackupTarget
  $serviceTarget = Read-StrictServiceFile -Path $serviceFile -ExpectedTarget $expected
  $caFile = Assert-SafeLocalExistingPath -Path $serviceTarget.sslrootcert -Label 'ValidatedCAFile' -RepositoryRoot $repoRoot
  if ((Get-Item -LiteralPath $caFile -Force).PSIsContainer) { throw 'Validated CA path must be a file.' }

  Assert-PrivatePathAcl -Path $configPath -IsDirectory $true
  Assert-PrivatePathAcl -Path $backupPath -IsDirectory $true
  Assert-PrivatePathAcl -Path $serviceFile -IsDirectory $false
  Assert-PrivatePathAcl -Path $passFile -IsDirectory $false
  Assert-PrivatePathAcl -Path $caFile -IsDirectory $false
  Assert-ParentDirectoryChain -Path $configPath
  Assert-ParentDirectoryChain -Path $backupPath
  Assert-ParentDirectoryChain -Path $caFile
  Assert-FullyProtectedBitLockerVolume -Path $configPath
  Assert-FullyProtectedBitLockerVolume -Path $serviceFile
  Assert-FullyProtectedBitLockerVolume -Path $passFile
  Assert-FullyProtectedBitLockerVolume -Path $caFile
  Assert-FullyProtectedBitLockerVolume -Path $backupPath
  Assert-StrictPassfile -Path $passFile -ExpectedTarget $expected

  # The bridge reads the existing .env validator input, but returns only safe target metadata.
  if (Test-Path Env:RENTFLOW_TEST_BACKUP_CA_PATH) { throw 'Unexpected inherited internal CA-path variable.' }
  $resolver = Join-Path $PSScriptRoot 'resolve-supabase-test-backup-target.ts'
  Push-Location $repoRoot
  try {
    $env:RENTFLOW_TEST_BACKUP_CA_PATH = $caFile
    $validatorCaEnvironmentConfigured = $true
    $resolverOutput = & bun $resolver 2>$null
    $resolverExit = $LASTEXITCODE
  } finally {
    Pop-Location
    if ($validatorCaEnvironmentConfigured) {
      Remove-Item Env:RENTFLOW_TEST_BACKUP_CA_PATH -ErrorAction SilentlyContinue
      $validatorCaEnvironmentConfigured = $false
    }
  }
  if ($resolverExit -ne 0 -or @($resolverOutput).Count -ne 1) { throw 'Repository TEST target validation failed.' }
  $validatedTarget = ($resolverOutput -join '').Trim() | ConvertFrom-Json
  if ($validatedTarget.host -cne $expected.Host -or [string]$validatedTarget.port -cne $expected.Port -or
      $validatedTarget.database -cne $expected.Database -or $validatedTarget.user -cne $expected.User -or
      $validatedTarget.sslmode -cne $expected.SslMode -or $validatedTarget.rejectUnauthorized -ne $true -or
      $validatedTarget.servername -cne $expected.Host) { throw 'Repository validator returned an unexpected TEST target.' }

  foreach ($exe in @($pgDump,$pgRestore,$psql)) {
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'PostgreSQL 17.12 client utility is missing.' }
    $version = (& $exe --version 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '\(PostgreSQL\) 17\.12$') { throw 'PostgreSQL client utility version must be exactly 17.12.' }
  }

  $env:PGSERVICEFILE = $serviceFile
  $env:PGPASSFILE = $passFile
  $pgEnvironmentConfigured = $true
  $stage = 'identity_check'
  $identitySql = 'SELECT current_database() || chr(9) || current_user || chr(9) || session_user;'
  $identityOutput = & $psql '--no-password' '--no-psqlrc' '--set=ON_ERROR_STOP=1' '--tuples-only' '--no-align' '--command' $identitySql '--dbname' ("service=$serviceName") 2>$null
  $identityExit = $LASTEXITCODE
  $identityFields = ([string]($identityOutput -join '')).Trim() -split "`t"
  if ($identityExit -ne 0 -or $identityFields.Count -ne 3 -or
      $identityFields[0] -cne $expected.Database -or $identityFields[1] -cne $expected.DatabaseRole -or
      $identityFields[2] -cne $expected.DatabaseRole) { throw 'Read-only database identity check did not match the pinned TEST database and database principal.' }

  $runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N')
  $stageDirectory = Join-Path $backupPath ($runId + '.incomplete')
  $finalDirectory = Join-Path $backupPath ($runId + '.complete')
  $reservationPath = Join-Path $backupPath ('.' + $runId + '.reserve')
  if ((Test-Path -LiteralPath $stageDirectory) -or (Test-Path -LiteralPath $finalDirectory)) { throw 'Backup artifact path collision; no artifacts were overwritten.' }
  $reservation = New-Object System.IO.FileStream($reservationPath,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  $reservationOwned = $true
  $reservation.Dispose()
  $null = New-Item -ItemType Directory -Path $stageDirectory -ErrorAction Stop
  $stageOwned = $true
  $runStateText = 'INCOMPLETE: do not treat this directory as a backup unless it is renamed .complete and contains COMPLETE.txt.' + "`r`n"
  $runStateBytes = [Text.UTF8Encoding]::new($false).GetBytes($runStateText)
  $runStateStream = New-Object System.IO.FileStream((Join-Path $stageDirectory 'RUN-STATE.txt'),[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $runStateStream.Write($runStateBytes,0,$runStateBytes.Length) } finally { $runStateStream.Dispose() }
  [IO.File]::Move($reservationPath,(Join-Path $stageDirectory 'RUN-RESERVATION'))
  $stageItems = @(Get-ChildItem -LiteralPath $stageDirectory -Force)
  if ($stageItems.Count -ne 2 -or
      @($stageItems | Where-Object { $_.Name -notin @('RUN-RESERVATION','RUN-STATE.txt') }).Count -ne 0) {
    throw 'New incomplete artifact directory was not empty; no existing artifact will be overwritten.'
  }

  $archive = Join-Path $stageDirectory 'rentflow-test-public-drizzle.dump'
  $toc = Join-Path $stageDirectory 'rentflow-test-public-drizzle.toc.txt'
  $hashFile = Join-Path $stageDirectory 'rentflow-test-public-drizzle.sha256.txt'
  $stage = 'pg_dump'
  $dumpArguments = '--no-password --format=custom --schema=public --schema=drizzle --dbname=service=' + $serviceName
  Invoke-ProcessStdoutToNewFile -Executable $pgDump -Arguments $dumpArguments -OutputPath $archive -FailureLabel 'pg_dump'
  if (-not (Test-Path -LiteralPath $archive -PathType Leaf) -or (Get-Item -LiteralPath $archive).Length -le 0) { throw 'Archive is missing or empty.' }

  $stage = 'toc_readability_check'
  $tocArguments = '--list "' + $archive + '"'
  Invoke-ProcessStdoutToNewFile -Executable $pgRestore -Arguments $tocArguments -OutputPath $toc -FailureLabel 'pg_restore --list'
  if (-not (Test-Path -LiteralPath $toc -PathType Leaf) -or (Get-Item -LiteralPath $toc).Length -le 0) {
    throw 'pg_restore --list TOC/readability validation failed.'
  }
  $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  $hashBody = [Text.UTF8Encoding]::new($false).GetBytes(($hash + '  rentflow-test-public-drizzle.dump' + "`r`n"))
  $hashStream = New-Object System.IO.FileStream($hashFile,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $hashStream.Write($hashBody,0,$hashBody.Length) } finally { $hashStream.Dispose() }
  $completeNote = "Archive SHA-256: $hash`r`nTOC listing confirms archive header and table-of-contents readability only; it does not prove all data blocks can be restored.`r`n"
  $completeBytes = [Text.UTF8Encoding]::new($false).GetBytes($completeNote)
  $completeStream = New-Object System.IO.FileStream((Join-Path $stageDirectory 'COMPLETE.txt'),[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $completeStream.Write($completeBytes,0,$completeBytes.Length) } finally { $completeStream.Dispose() }
  [IO.Directory]::Move($stageDirectory,$finalDirectory)
  $stageDirectory = $null
  Write-Output 'TEST logical backup completed. Inspect the new .complete directory under the supplied BackupRoot.'
  Write-Output ('Archive bytes: ' + (Get-Item -LiteralPath (Join-Path $finalDirectory 'rentflow-test-public-drizzle.dump')).Length)
  Write-Output ('Archive SHA-256: ' + $hash)
  Write-Output 'pg_restore --list passed TOC/readability validation only; full restoreability remains unverified.'
} catch {
  if ($stageOwned -and $stageDirectory -and (Test-Path -LiteralPath $stageDirectory -PathType Container)) {
    try { [void](Write-FailureMarker -Directory $stageDirectory -Stage $stage) } catch { }
  } elseif ($reservationOwned -and $reservationPath -and (Test-Path -LiteralPath $reservationPath -PathType Leaf)) {
    try { [void](Write-FailureMarkerFile -Path ($reservationPath + '.FAILED') -Stage $stage) } catch { }
  }
  [Console]::Error.WriteLine(('TEST logical backup stopped at stage: ' + $stage + '. Existing and partial artifacts were preserved.'))
  exit 1
} finally {
  if ($validatorCaEnvironmentConfigured) {
    Remove-Item Env:RENTFLOW_TEST_BACKUP_CA_PATH -ErrorAction SilentlyContinue
  }
  if ($pgEnvironmentConfigured) {
    Remove-Item Env:PGSERVICEFILE -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSFILE -ErrorAction SilentlyContinue
  }
}
