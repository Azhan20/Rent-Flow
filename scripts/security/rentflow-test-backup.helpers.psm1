Set-StrictMode -Version 2

$script:ExpectedSupabaseTestBackupTarget = @{
  Host = 'aws-1-ap-northeast-1.pooler.supabase.com'
  Port = '5432'
  Database = 'postgres'
  User = 'postgres.dgasadodjzpjofkvjkbw'
  DatabaseRole = 'postgres'
  SslMode = 'verify-full'
  ApplicationName = 'rentflow_test_logical_backup'
}

function Get-ExpectedSupabaseTestBackupTarget {
  return $script:ExpectedSupabaseTestBackupTarget.Clone()
}

function Test-PathAtOrBelow {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$Root)
  $p = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $r = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  return $p.Equals($r,[StringComparison]::OrdinalIgnoreCase) -or
    $p.StartsWith(($r + '\'),[StringComparison]::OrdinalIgnoreCase)
}

function Assert-OutsideRepository {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$RepositoryRoot)
  if (Test-PathAtOrBelow -Path $Path -Root $RepositoryRoot) {
    throw 'Protected backup configuration and output paths must be outside the repository.'
  }
}

function Assert-NotReparseAttributes {
  param([Parameter(Mandatory=$true)][System.IO.FileAttributes]$Attributes,[string]$Label = 'Path')
  if (($Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label contains a reparse point." }
}

function Assert-LocalDriveType {
  param([Parameter(Mandatory=$true)][string]$DriveType,[string]$Label = 'Path')
  if ($DriveType -notin @('Fixed','Removable')) { throw "$Label must be on a local fixed or removable drive, not a network or virtual drive." }
}

function Convert-LibpqServiceValue {
  param([Parameter(Mandatory=$true)][string]$Raw)
  $value = $Raw.Trim()
  if ($value.Length -eq 0) { throw 'Empty service-file value.' }
  if (-not $value.StartsWith("'")) {
    if ($value -notmatch '^[A-Za-z0-9._:/+-]+$') {
      throw 'Unsupported unquoted service value. Quote values containing spaces, quotes, or backslashes using libpq conninfo syntax.'
    }
    return $value
  }

  $builder = New-Object System.Text.StringBuilder
  $index = 1
  $closed = $false
  while ($index -lt $value.Length) {
    $character = $value[$index]
    if ($character -eq '\') {
      $index++
      if ($index -ge $value.Length -or ($value[$index] -ne '\' -and $value[$index] -ne "'")) {
        throw 'Unsupported libpq service-value escape. Only escaped backslash and escaped single quote are accepted.'
      }
      [void]$builder.Append($value[$index])
    } elseif ($character -eq "'") {
      $closed = $true
      $index++
      break
    } else {
      [void]$builder.Append($character)
    }
    $index++
  }
  if (-not $closed -or $value.Substring($index).Trim().Length -ne 0) {
    throw 'Malformed quoted service-file value.'
  }
  return $builder.ToString()
}

function ConvertFrom-StrictServiceText {
  param(
    [Parameter(Mandatory=$true)][string]$Text,
    [string]$ExpectedCaPath,
    [Parameter(Mandatory=$true)][hashtable]$ExpectedTarget
  )
  $sectionCount = 0
  $inside = $false
  $values = @{}
  $allowed = @('host','port','dbname','user','sslmode','sslrootcert','application_name')
  foreach ($line in ($Text -split '\r?\n')) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) { continue }
    if ($trimmed.StartsWith(';')) { throw 'Semicolon comments are unsupported; use full-line # comments.' }
    if ($trimmed.StartsWith('[')) {
      if ($trimmed -notmatch '^\[([A-Za-z0-9_.-]+)\]$') { throw 'Malformed service section.' }
      $sectionCount++
      if ($sectionCount -ne 1 -or $Matches[1] -cne 'rentflow_test_logical_backup') {
        throw 'Unexpected or duplicate service section.'
      }
      $inside = $true
      continue
    }
    if (-not $inside -or $trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      throw 'Malformed service-file option.'
    }
    $key = $Matches[1]
    if ($key -ieq 'password' -or $key -cnotin $allowed) { throw 'Password or unknown service-file option rejected.' }
    if ($values.ContainsKey($key)) { throw 'Duplicate service-file option rejected.' }
    $values[$key] = Convert-LibpqServiceValue -Raw $Matches[2]
  }
  if ($sectionCount -ne 1) { throw 'Exactly one expected service section is required.' }
  foreach ($key in $allowed) {
    if (-not $values.ContainsKey($key)) { throw 'A required service-file option is missing.' }
  }
  $expectedMap = @{
    host = $ExpectedTarget.Host; port = $ExpectedTarget.Port; dbname = $ExpectedTarget.Database
    user = $ExpectedTarget.User; sslmode = $ExpectedTarget.SslMode
    application_name = $ExpectedTarget.ApplicationName
  }
  foreach ($key in $expectedMap.Keys) {
    if ($values[$key] -cne $expectedMap[$key]) { throw 'Service file does not match the pinned Supabase TEST target.' }
  }
  $actualCa = $values.sslrootcert.Replace('/','\')
  if (-not [IO.Path]::IsPathRooted($actualCa) -or $actualCa.StartsWith('\\')) {
    throw 'Service-file CA path must be an absolute local path.'
  }
  $values.sslrootcert = [IO.Path]::GetFullPath($actualCa)
  if ($ExpectedCaPath) {
    $expectedCa = [IO.Path]::GetFullPath($ExpectedCaPath)
    if (-not [string]::Equals($values.sslrootcert,$expectedCa,[StringComparison]::OrdinalIgnoreCase)) {
      throw 'Service-file CA path does not match the validated TEST CA path.'
    }
  }
  return $values
}

function Read-StrictServiceFile {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [string]$ExpectedCaPath,
    [Parameter(Mandatory=$true)][hashtable]$ExpectedTarget
  )
  return ConvertFrom-StrictServiceText -Text ([IO.File]::ReadAllText($Path)) -ExpectedCaPath $ExpectedCaPath -ExpectedTarget $ExpectedTarget
}

function Convert-PassfileLine {
  param([Parameter(Mandatory=$true)][string]$Line)
  $fields = New-Object System.Collections.ArrayList
  $builder = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $Line.Length; $i++) {
    $character = $Line[$i]
    if ($character -eq '\') {
      $i++
      if ($i -ge $Line.Length -or ($Line[$i] -ne '\' -and $Line[$i] -ne ':')) { throw 'Invalid passfile escape.' }
      [void]$builder.Append($Line[$i])
    } elseif ($character -eq ':') {
      [void]$fields.Add($builder.ToString())
      [void]$builder.Clear()
    } else { [void]$builder.Append($character) }
  }
  [void]$fields.Add($builder.ToString())
  if ($fields.Count -ne 5) { throw 'Passfile entry must have five fields.' }
  return ,$fields.ToArray()
}

function Assert-PassfileText {
  param([Parameter(Mandatory=$true)][string]$Text,[Parameter(Mandatory=$true)][hashtable]$ExpectedTarget)
  $matches = 0
  $entries = 0
  foreach ($line in ($Text -split '\r?\n')) {
    if ($line.Trim().Length -eq 0 -or $line.TrimStart().StartsWith('#')) { continue }
    $entries++
    $fields = Convert-PassfileLine -Line $line
    if ($fields[0] -eq '*' -or $fields[1] -eq '*' -or $fields[2] -eq '*' -or $fields[3] -eq '*') {
      throw 'Wildcard passfile fields are rejected.'
    }
    if ($fields[0] -ceq $ExpectedTarget.Host -and $fields[1] -ceq $ExpectedTarget.Port -and
        $fields[2] -ceq $ExpectedTarget.Database -and $fields[3] -ceq $ExpectedTarget.User -and
        $fields[4].Length -gt 0) { $matches++ }
  }
  if ($entries -ne 1 -or $matches -ne 1) { throw 'Passfile must contain exactly one matching TEST entry and no other entries.' }
}

function Assert-StrictPassfile {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][hashtable]$ExpectedTarget)
  Assert-PassfileText -Text ([IO.File]::ReadAllText($Path)) -ExpectedTarget $ExpectedTarget
}

function Test-PrivateAclRules {
  param(
    [Parameter(Mandatory=$true)][object[]]$Rules,
    [Parameter(Mandatory=$true)][string]$UserSid,
    [string]$SystemSid = 'S-1-5-18',
    [Parameter(Mandatory=$true)][bool]$IsDirectory,
    [Parameter(Mandatory=$true)][bool]$InheritanceProtected
  )
  if (-not $InheritanceProtected -or $Rules.Count -ne 2) { return $false }
  $seen = @{}
  foreach ($rule in $Rules) {
    if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or
        $rule.IsInherited -or $rule.FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl) { return $false }
    $sid = $rule.IdentityReference.Value
    if ($sid -ne $UserSid -and $sid -ne $SystemSid) { return $false }
    if ($seen.ContainsKey($sid)) { return $false }
    $seen[$sid] = $true
    if ($IsDirectory) {
      $expectedInheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
      if ($rule.InheritanceFlags -ne $expectedInheritance -or
          $rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) { return $false }
    } elseif ($rule.InheritanceFlags -ne [System.Security.AccessControl.InheritanceFlags]::None -or
              $rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) { return $false }
  }
  return $seen.ContainsKey($UserSid) -and $seen.ContainsKey($SystemSid)
}

function Test-ProtectedPathSnapshot {
  param(
    [Parameter(Mandatory=$true)][string]$OwnerSid,
    [Parameter(Mandatory=$true)][object[]]$Rules,
    [Parameter(Mandatory=$true)][string]$UserSid,
    [Parameter(Mandatory=$true)][bool]$IsDirectory,
    [Parameter(Mandatory=$true)][bool]$InheritanceProtected
  )
  if ($OwnerSid -ne $UserSid -and $OwnerSid -ne 'S-1-5-18' -and $OwnerSid -ne 'S-1-5-32-544') { return $false }
  return Test-PrivateAclRules -Rules $Rules -UserSid $UserSid -IsDirectory $IsDirectory -InheritanceProtected $InheritanceProtected
}

function Assert-PrivatePathAcl {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][bool]$IsDirectory)
  $acl = Get-Acl -LiteralPath $Path -ErrorAction Stop
  $sidType = [System.Security.Principal.SecurityIdentifier]
  $rules = @($acl.GetAccessRules($true,$true,$sidType))
  $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $ownerSid = (New-Object System.Security.Principal.NTAccount($acl.Owner)).Translate($sidType).Value
  if (-not (Test-ProtectedPathSnapshot -OwnerSid $ownerSid -Rules $rules -UserSid $userSid -IsDirectory $IsDirectory -InheritanceProtected $acl.AreAccessRulesProtected)) {
    throw 'Protected path ACL is not exactly current-user and SYSTEM full control.'
  }
}

function Test-ParentAclSnapshot {
  param([Parameter(Mandatory=$true)][string]$OwnerSid,[Parameter(Mandatory=$true)][AllowEmptyCollection()][object[]]$Rules,[Parameter(Mandatory=$true)][string]$UserSid)
  $trusted = @($UserSid,'S-1-5-18','S-1-5-32-544')
  if ($trusted -notcontains $OwnerSid) { return $false }
  $danger = [System.Security.AccessControl.FileSystemRights]::Write -bor
    [System.Security.AccessControl.FileSystemRights]::Delete -bor
    [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [System.Security.AccessControl.FileSystemRights]::ChangePermissions -bor
    [System.Security.AccessControl.FileSystemRights]::TakeOwnership -bor
    [System.Security.AccessControl.FileSystemRights]::CreateDirectories -bor
    [System.Security.AccessControl.FileSystemRights]::CreateFiles
  foreach ($rule in $Rules) {
    if ($rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
        $trusted -notcontains $rule.IdentityReference.Value -and
        (($rule.FileSystemRights -band $danger) -ne 0)) { return $false }
  }
  return $true
}

function Assert-ParentDirectoryChain {
  param([Parameter(Mandatory=$true)][string]$Path)
  $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $parent = [IO.Directory]::GetParent([IO.Path]::GetFullPath($Path))
  while ($null -ne $parent) {
    $acl = Get-Acl -LiteralPath $parent.FullName -ErrorAction Stop
    $owner = (New-Object System.Security.Principal.NTAccount($acl.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value
    $rules = @($acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
    if (-not (Test-ParentAclSnapshot -OwnerSid $owner -Rules $rules -UserSid $userSid)) {
      throw 'A parent directory could permit replacement, rename, redirection, or ACL changes by another principal.'
    }
    $parent = $parent.Parent
  }
}

function Assert-SafeLocalExistingPath {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$Label,[Parameter(Mandatory=$true)][string]$RepositoryRoot)
  if (-not [IO.Path]::IsPathRooted($Path) -or $Path.StartsWith('\\')) { throw "$Label must be an absolute local path." }
  if ($Path -match '(^|[\\/])\.\.([\\/]|$)') { throw "$Label must not contain parent traversal." }
  $full = [IO.Path]::GetFullPath($Path)
  if ($full -notmatch '^[A-Za-z]:\\') { throw "$Label must be on a local drive letter volume." }
  if ($full.TrimEnd('\\').Equals([IO.Path]::GetPathRoot($full).TrimEnd('\\'),[StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label must be a dedicated directory below the drive root."
  }
  Assert-OutsideRepository -Path $full -RepositoryRoot $RepositoryRoot
  if (-not (Test-Path -LiteralPath $full)) { throw "$Label must already exist." }
  $root = [IO.Path]::GetPathRoot($full)
  $drive = @([IO.DriveInfo]::GetDrives() | Where-Object { [string]::Equals($_.RootDirectory.FullName,$root,[StringComparison]::OrdinalIgnoreCase) } | Select-Object -First 1)
  if ($drive.Count -ne 1 -or -not $drive[0].IsReady) { throw "$Label volume readiness cannot be verified." }
  Assert-LocalDriveType -DriveType ([string]$drive[0].DriveType) -Label $Label
  $current = $full
  while ($current) {
    $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
    Assert-NotReparseAttributes -Attributes $item.Attributes -Label $Label
    $parent = [IO.Directory]::GetParent($current)
    if ($null -eq $parent) { break }
    $current = $parent.FullName
  }
  return $full
}

function Assert-FullyProtectedBitLockerVolume {
  param([Parameter(Mandatory=$true)][string]$Path)
  $command = Get-Command Get-BitLockerVolume -ErrorAction SilentlyContinue
  if ($null -eq $command) { throw 'BitLocker status is unavailable; refusing to continue.' }
  $mount = [IO.Path]::GetPathRoot($Path).TrimEnd('\')
  $volume = Get-BitLockerVolume -MountPoint $mount -ErrorAction Stop
  if ($null -eq $volume -or $volume.MountPoint.TrimEnd('\') -ine $mount -or
      $volume.VolumeStatus -ne 'FullyEncrypted' -or $volume.ProtectionStatus -ne 'On' -or
      $volume.EncryptionMethod -eq 'None') { throw 'Every configuration and backup volume must be fully encrypted with protection on.' }
}

function Assert-NoInheritedPgOverrides {
  param([string[]]$Names = @((Get-ChildItem Env: | Where-Object { $_.Name -match '^PG[A-Z0-9_]*$' } | ForEach-Object { $_.Name })))
  if ($Names.Count -gt 0) { throw 'Inherited PG* environment overrides are present; clear them before running.' }
}

function Get-FailureMarkerText {
  param([Parameter(Mandatory=$true)][string]$Stage)
  return "RentFlow TEST backup failed during stage: $Stage`r`nArtifacts are incomplete and must not be treated as a valid backup.`r`n"
}

function Write-FailureMarker {
  param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$Stage)
  $path = Join-Path $Directory 'FAILURE.txt'
  return Write-FailureMarkerFile -Path $path -Stage $Stage
}

function Write-FailureMarkerFile {
  param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$Stage)
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes((Get-FailureMarkerText -Stage $Stage))
  $stream = New-Object System.IO.FileStream($Path,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $stream.Write($bytes,0,$bytes.Length) } finally { $stream.Dispose() }
  return $Path
}

function Invoke-ProcessStdoutToNewFile {
  param(
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$Arguments,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][string]$FailureLabel
  )
  $output = New-ExclusiveArtifactStream -Path $OutputPath
  $process = New-Object System.Diagnostics.Process
  $started = $false
  try {
    $process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $Executable
    $process.StartInfo.Arguments = $Arguments
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    if (-not $process.Start()) { throw "$FailureLabel did not start." }
    $started = $true
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.StandardOutput.BaseStream.CopyTo($output)
    $output.Flush()
    $process.WaitForExit()
    $stderrText = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0 -or $stderrText.Length -gt 0) {
      throw "$FailureLabel failed or emitted diagnostics; details were suppressed."
    }
  } catch {
    if ($started) {
      try {
        if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
      } catch { }
    }
    throw "$FailureLabel failed; raw process diagnostics are suppressed."
  } finally {
    $output.Dispose()
    $process.Dispose()
  }
}

function New-ExclusiveArtifactStream {
  param([Parameter(Mandatory=$true)][string]$Path)
  return New-Object System.IO.FileStream($Path,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
}

Export-ModuleMember -Function Get-ExpectedSupabaseTestBackupTarget,Test-PathAtOrBelow,Assert-OutsideRepository,Assert-NotReparseAttributes,Assert-LocalDriveType,Convert-LibpqServiceValue,ConvertFrom-StrictServiceText,Read-StrictServiceFile,Convert-PassfileLine,Assert-PassfileText,Assert-StrictPassfile,Test-PrivateAclRules,Test-ProtectedPathSnapshot,Assert-PrivatePathAcl,Test-ParentAclSnapshot,Assert-ParentDirectoryChain,Assert-SafeLocalExistingPath,Assert-FullyProtectedBitLockerVolume,Assert-NoInheritedPgOverrides,Get-FailureMarkerText,Write-FailureMarker,Write-FailureMarkerFile,Invoke-ProcessStdoutToNewFile,New-ExclusiveArtifactStream
