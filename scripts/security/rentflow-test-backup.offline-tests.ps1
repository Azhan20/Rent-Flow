$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$module = Join-Path $PSScriptRoot 'rentflow-test-backup.helpers.psm1'
Import-Module -Name $module -Force

$script:Passed = 0
function Assert-True([bool]$Condition,[string]$Name) {
  if (-not $Condition) { throw "FAILED: $Name" }
  $script:Passed++
}
function Assert-Throws([scriptblock]$Action,[string]$Name) {
  $threw = $false
  try { & $Action } catch { $threw = $true }
  if (-not $threw) { throw "FAILED (expected rejection): $Name" }
  $script:Passed++
}

$target = Get-ExpectedSupabaseTestBackupTarget
Assert-True ($target.Host -ceq 'aws-1-ap-northeast-1.pooler.supabase.com' -and $target.Port -ceq '5432' -and $target.Database -ceq 'postgres' -and $target.User -ceq 'postgres.dgasadodjzpjofkvjkbw' -and $target.DatabaseRole -ceq 'postgres') 'pinned TEST pooler target and backend identity are explicit'
$ca = 'C:\Offline Backup Config\test-ca.crt'
$serviceTemplate = @'
[rentflow_test_logical_backup]
host=aws-1-ap-northeast-1.pooler.supabase.com
port=5432
dbname=postgres
user=postgres.dgasadodjzpjofkvjkbw
sslmode=verify-full
sslrootcert={0}
application_name=rentflow_test_logical_backup
'@
$quotedCa = "'C:\\Offline Backup Config\\test-ca.crt'"
$validService = $serviceTemplate -f $quotedCa
$parsedService = ConvertFrom-StrictServiceText -Text $validService -ExpectedCaPath $ca -ExpectedTarget $target
Assert-True ($parsedService.sslmode -ceq 'verify-full') 'quoted Windows CA path and target accepted'
Assert-True ((Convert-LibpqServiceValue -Raw "'one\'two\\three'") -ceq "one'two\three") 'libpq quote and backslash escapes decoded'
Assert-Throws { Convert-LibpqServiceValue -Raw "'bad\q'" } 'unsupported libpq escape rejected'
Assert-Throws { Convert-LibpqServiceValue -Raw 'unquoted value' } 'unsupported unquoted whitespace rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService + "`r`nhost=duplicate") -ExpectedCaPath $ca -ExpectedTarget $target } 'duplicate service key rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService + "`r`n[extra]`r`nhost=x") -ExpectedCaPath $ca -ExpectedTarget $target } 'unexpected service section rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService + "`r`npassword=forbidden") -ExpectedCaPath $ca -ExpectedTarget $target } 'password option rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService + "`r`nunknown_option=x") -ExpectedCaPath $ca -ExpectedTarget $target } 'unknown service option rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService.Replace('host=','HOST=')) -ExpectedCaPath $ca -ExpectedTarget $target } 'noncanonical service option spelling rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService.Replace('sslmode=verify-full','sslmode=require')) -ExpectedCaPath $ca -ExpectedTarget $target } 'wrong TLS mode rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService.Replace($target.Host,'wrong.example')) -ExpectedCaPath $ca -ExpectedTarget $target } 'wrong project host rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService.Replace('port=5432','port=6543')) -ExpectedCaPath $ca -ExpectedTarget $target } 'wrong service port rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService.Replace('dbname=postgres','dbname=other')) -ExpectedCaPath $ca -ExpectedTarget $target } 'wrong service database rejected'
Assert-Throws { ConvertFrom-StrictServiceText -Text ($validService.Replace($target.User,'postgres')) -ExpectedCaPath $ca -ExpectedTarget $target } 'wrong service principal rejected'
$wrongCaService = $validService.Replace($quotedCa,"'C:\\Other\\ca.crt'")
Assert-Throws { ConvertFrom-StrictServiceText -Text $wrongCaService -ExpectedCaPath $ca -ExpectedTarget $target } 'CA mismatch rejected'
Assert-True ((ConvertFrom-StrictServiceText -Text $validService -ExpectedTarget $target).sslrootcert -ceq $ca) 'service CA path is canonicalized before validator comparison'

$goodPass = '{0}:{1}:{2}:{3}:synthetic\:offline-password' -f $target.Host,$target.Port,$target.Database,$target.User
Assert-True ((Assert-PassfileText -Text $goodPass -ExpectedTarget $target) -eq $null) 'exact passfile entry accepted without returning its password'
Assert-Throws { Assert-PassfileText -Text ($goodPass + "`r`n" + $goodPass) -ExpectedTarget $target } 'duplicate passfile entry rejected'
Assert-Throws { Assert-PassfileText -Text ('*:{0}:{1}:{2}:synthetic' -f $target.Port,$target.Database,$target.User) -ExpectedTarget $target } 'wildcard passfile entry rejected'
Assert-Throws { Assert-PassfileText -Text ('wrong-host:{0}:{1}:{2}:synthetic' -f $target.Port,$target.Database,$target.User) -ExpectedTarget $target } 'wrong passfile host rejected'
Assert-Throws { Assert-PassfileText -Text ('{0}:{1}:other:{2}:synthetic' -f $target.Host,$target.Port,$target.User) -ExpectedTarget $target } 'wrong passfile database rejected'
Assert-Throws { Assert-PassfileText -Text ('{0}:{1}:{2}:wrong-user:synthetic' -f $target.Host,$target.Port,$target.Database) -ExpectedTarget $target } 'wrong passfile principal rejected'
Assert-Throws { Convert-PassfileLine -Line 'host:5432:db:user:bad\q' } 'unsupported passfile escape rejected'

$repo = 'D:\RentFlow\Rent-Flow'
Assert-True (Test-PathAtOrBelow -Path $repo -Root $repo) 'repository root containment detected'
Assert-True (Test-PathAtOrBelow -Path ($repo + '\security\backup') -Root $repo) 'repository descendant containment detected'
Assert-True (-not (Test-PathAtOrBelow -Path 'D:\RentFlowBackup' -Root $repo)) 'repository prefix sibling is not misclassified'
Assert-Throws { Assert-OutsideRepository -Path $repo -RepositoryRoot $repo } 'repository root excluded'
Assert-Throws { Assert-OutsideRepository -Path ($repo + '\backup') -RepositoryRoot $repo } 'repository child excluded'
Assert-True ($null -eq (Assert-OutsideRepository -Path 'E:\Encrypted\RentFlow' -RepositoryRoot $repo)) 'external path accepted by containment check'
Assert-Throws { Assert-SafeLocalExistingPath -Path '\\server\share' -Label 'test' -RepositoryRoot $repo } 'network share path rejected before access'
Assert-Throws { Assert-SafeLocalExistingPath -Path 'relative\path' -Label 'test' -RepositoryRoot $repo } 'relative path rejected before access'
Assert-Throws { Assert-NotReparseAttributes -Attributes ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint) } 'reparse point rejected'
Assert-True ((Assert-NotReparseAttributes -Attributes ([IO.FileAttributes]::Directory)) -eq $null) 'ordinary directory attributes accepted'
Assert-True ((Assert-LocalDriveType -DriveType 'Fixed') -eq $null) 'fixed local drive accepted'
Assert-True ((Assert-LocalDriveType -DriveType 'Removable') -eq $null) 'removable local drive accepted'
Assert-Throws { Assert-LocalDriveType -DriveType 'Network' } 'mapped network drive rejected'
Assert-Throws { Assert-LocalDriveType -DriveType 'Ram' } 'virtual drive rejected'

$userSid = 'S-1-5-21-111-222-333-1001'
$systemSid = 'S-1-5-18'
$inherit = [System.Security.AccessControl.InheritanceFlags]::None
$none = [System.Security.AccessControl.PropagationFlags]::None
$full = [System.Security.AccessControl.FileSystemRights]::FullControl
$allow = [System.Security.AccessControl.AccessControlType]::Allow
$userRule = [pscustomobject]@{ IdentityReference=[pscustomobject]@{Value=$userSid}; AccessControlType=$allow; FileSystemRights=$full; IsInherited=$false; InheritanceFlags=$inherit; PropagationFlags=$none }
$systemRule = [pscustomobject]@{ IdentityReference=[pscustomobject]@{Value=$systemSid}; AccessControlType=$allow; FileSystemRights=$full; IsInherited=$false; InheritanceFlags=$inherit; PropagationFlags=$none }
Assert-True (Test-PrivateAclRules -Rules @($userRule,$systemRule) -UserSid $userSid -IsDirectory $false -InheritanceProtected $true) 'exact private file ACL accepted'
Assert-True (Test-ProtectedPathSnapshot -OwnerSid $userSid -Rules @($userRule,$systemRule) -UserSid $userSid -IsDirectory $false -InheritanceProtected $true) 'protected object owned by current user accepted'
Assert-True (-not (Test-ProtectedPathSnapshot -OwnerSid 'S-1-5-32-545' -Rules @($userRule,$systemRule) -UserSid $userSid -IsDirectory $false -InheritanceProtected $true)) 'untrusted protected-object owner rejected'
Assert-True (-not (Test-PrivateAclRules -Rules @($userRule,$systemRule) -UserSid $userSid -IsDirectory $false -InheritanceProtected $false)) 'unprotected ACL rejected'
$broadRule = [pscustomobject]@{ IdentityReference=[pscustomobject]@{Value='S-1-5-32-545'}; AccessControlType=$allow; FileSystemRights=$full; IsInherited=$false; InheritanceFlags=$inherit; PropagationFlags=$none }
Assert-True (-not (Test-PrivateAclRules -Rules @($userRule,$systemRule,$broadRule) -UserSid $userSid -IsDirectory $false -InheritanceProtected $true)) 'broad ACL principal rejected'
$dirInheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
$dirUser = $userRule.PSObject.Copy(); $dirUser.InheritanceFlags=$dirInheritance
$dirSystem = $systemRule.PSObject.Copy(); $dirSystem.InheritanceFlags=$dirInheritance
Assert-True (Test-PrivateAclRules -Rules @($dirUser,$dirSystem) -UserSid $userSid -IsDirectory $true -InheritanceProtected $true) 'directory inheritance accepted'
Assert-True (-not (Test-PrivateAclRules -Rules @($userRule,$systemRule) -UserSid $userSid -IsDirectory $true -InheritanceProtected $true)) 'incorrect directory inheritance rejected'

$readRule = [pscustomobject]@{ IdentityReference=[pscustomobject]@{Value='S-1-5-32-545'}; AccessControlType=$allow; FileSystemRights=[System.Security.AccessControl.FileSystemRights]::ReadAndExecute }
$writeRule = [pscustomobject]@{ IdentityReference=[pscustomobject]@{Value='S-1-5-32-545'}; AccessControlType=$allow; FileSystemRights=[System.Security.AccessControl.FileSystemRights]::Modify }
Assert-True (Test-ParentAclSnapshot -OwnerSid 'S-1-5-32-544' -Rules @($readRule) -UserSid $userSid) 'read-only parent grant accepted'
Assert-True (-not (Test-ParentAclSnapshot -OwnerSid 'S-1-5-32-544' -Rules @($writeRule) -UserSid $userSid)) 'untrusted parent modification rejected'
$deleteChildRule = [pscustomobject]@{ IdentityReference=[pscustomobject]@{Value='S-1-5-32-545'}; AccessControlType=$allow; FileSystemRights=[System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles }
Assert-True (-not (Test-ParentAclSnapshot -OwnerSid 'S-1-5-32-544' -Rules @($deleteChildRule) -UserSid $userSid)) 'untrusted parent delete-child permission rejected'
Assert-True (-not (Test-ParentAclSnapshot -OwnerSid 'S-1-5-32-545' -Rules @() -UserSid $userSid)) 'untrusted parent owner rejected'
Assert-True (Test-ParentAclSnapshot -OwnerSid 'S-1-5-32-544' -Rules @() -UserSid $userSid) 'trusted parent owner with no untrusted grants accepted'

Assert-True ((Assert-NoInheritedPgOverrides -Names @()) -eq $null) 'no PG overrides accepted'
Assert-Throws { Assert-NoInheritedPgOverrides -Names @('PGHOST') } 'PGHOST override rejected'
Assert-Throws { Assert-NoInheritedPgOverrides -Names @('PGSERVICEFILE') } 'connection-service override rejected'

$backupScriptText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'rentflow-test-logical-backup.ps1'))
$resolverText = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'resolve-supabase-test-backup-target.ts'))
Assert-True ($backupScriptText.Contains('--format=custom') -and $backupScriptText.Contains('--schema=public') -and $backupScriptText.Contains('--schema=drizzle')) 'dump is constrained to custom format and the two approved schemas'
Assert-True ($backupScriptText.Contains("'--no-password'") -and $backupScriptText.Contains("'--list")) 'password prompting is disabled and TOC check is present'
Assert-True ($backupScriptText -notmatch '(?i)--clean|--create|--file=') 'restore options and overwrite-prone direct output flags are absent'
Assert-True ((Get-Content $module -Raw).Contains('[System.IO.FileMode]::CreateNew') -and (Get-Content $module -Raw).Contains('StandardOutput.BaseStream.CopyTo')) 'native binary output uses exclusive-create file handles'
Assert-True ($backupScriptText.Contains('current_database()') -and $backupScriptText.Contains('current_user') -and $backupScriptText.Contains('session_user')) 'database identity is checked before dump'
Assert-True ($backupScriptText.Contains('$identityFields[1] -cne $expected.DatabaseRole') -and $backupScriptText.Contains('$identityFields[2] -cne $expected.DatabaseRole')) 'backend role and session role are pinned separately from pooler username'
Assert-True ($backupScriptText.Contains('FAILURE.txt') -or (Get-Content $module -Raw).Contains('FAILURE.txt')) 'failed runs have a failure-marker path'
Assert-True ($resolverText.Contains('validateSupabaseTestingDatabaseTarget') -and $resolverText.Contains('override: true')) 'target bridge uses the existing TEST validator and repository env file'
Assert-True ($resolverText.Contains('RENTFLOW_TEST_BACKUP_CA_PATH') -and $resolverText.Contains('configuredCaPath')) 'target bridge compares service CA with the validator CA without returning the path'
$jsonOutput = $resolverText.Substring($resolverText.IndexOf('JSON.stringify'))
Assert-True ($jsonOutput -notmatch 'target\.password|target\.ssl\.ca|caPath|configuredCaPath') 'target bridge never serializes credentials, CA contents, or local paths'

$temporary = Join-Path ([IO.Path]::GetTempPath()) ('rentflow-backup-offline-' + [Guid]::NewGuid().ToString('N'))
try {
  [void][IO.Directory]::CreateDirectory($temporary)
  $existingArchive = Join-Path $temporary 'existing.dump'
  [IO.File]::WriteAllText($existingArchive,'preserve-me')
  $marker = Write-FailureMarker -Directory $temporary -Stage 'synthetic_test'
  Assert-True ([IO.File]::ReadAllText($marker).Contains('incomplete')) 'failure marker identifies incomplete artifacts'
  Assert-True ([IO.File]::ReadAllText($existingArchive) -ceq 'preserve-me') 'failure path preserves unrelated artifact'
  Assert-Throws { Write-FailureMarker -Directory $temporary -Stage 'second_attempt' } 'failure marker does not overwrite existing marker'
  $exclusivePath = Join-Path $temporary 'exclusive-output.bin'
  $exclusiveStream = New-ExclusiveArtifactStream -Path $exclusivePath
  try { $sample = [Text.Encoding]::ASCII.GetBytes('original'); $exclusiveStream.Write($sample,0,$sample.Length) } finally { $exclusiveStream.Dispose() }
  Assert-Throws { $null = New-ExclusiveArtifactStream -Path $exclusivePath } 'archive output cannot overwrite an existing artifact'
  Assert-True ([Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($exclusivePath)) -ceq 'original') 'exclusive-create rejection preserves existing bytes'
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}

Write-Output ('Offline safety checks passed: ' + $script:Passed)
