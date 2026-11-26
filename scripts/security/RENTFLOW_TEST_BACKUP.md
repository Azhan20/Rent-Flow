# RentFlow Supabase TEST logical backup

This procedure is TEST-only. It uses the repository's `validateSupabaseTestingDatabaseTarget` validator and refuses any target other than the audited TEST project (`dgasadodjzpjofkvjkbw`), database `postgres`, and project-qualified pooler username `postgres.dgasadodjzpjofkvjkbw` on the fixed pooler endpoint. The SQL identity check separately requires `current_user` and `session_user` to be `postgres`, matching the previously verified TEST connection identity. It requires `sslmode=verify-full` and the validator's currently valid CA certificate. It does not use the runtime login or legacy database targets.

The dump contains only `public` and `drizzle` schemas in PostgreSQL custom format. It is an **application-schema logical backup**, not a full logical project backup and not a Supabase managed physical backup. It does not capture Supabase-managed schemas, platform configuration, project settings, or provider backups. A later restore rehearsal must use a newly created isolated TEST target; never restore over the audited TEST database.

## External configuration

Use two new local-drive locations outside the repository, for example a per-user config directory and an existing BitLocker-protected backup volume. The examples below are placeholders, not paths to use literally. The backup tool requires the config root, backup root, service file, passfile, and CA file to exist before it starts. It rejects UNC paths, mapped/network and virtual drives, drive-root output paths, reparse points, repository paths, nested config/output roots, broad ACLs, unsafe parent ACLs, and any volume that is not fully encrypted with BitLocker protection on.

The service file is a dedicated UTF-8 text file named `pg_service.conf`; it contains no password:

```ini
[rentflow_test_logical_backup]
host=aws-1-ap-northeast-1.pooler.supabase.com
port=5432
dbname=postgres
user=postgres.dgasadodjzpjofkvjkbw
sslmode=verify-full
sslrootcert='C:\\Users\\<user>\\AppData\\Local\\RentFlow\\BackupConfig\\supabase-test-ca.crt'
application_name=rentflow_test_logical_backup
```

The CA path must be the same absolute path configured by `SUPABASE_TEST_CA_CERT` for the repository validator. Keep the CA outside the repository and protect it with the same file ACL as the service/pass files. The single-quoted value follows libpq conninfo quoting: each literal backslash inside a quoted value is written as `\\`; only `\\` and `\'` escapes are accepted. Use `#` only for full-line comments. Duplicate keys, extra sections, unknown options, unsupported value syntax, and any password option are rejected.

Create `pgpass.conf` with exactly one non-comment entry, using this structure:

```text
aws-1-ap-northeast-1.pooler.supabase.com:5432:postgres:postgres.dgasadodjzpjofkvjkbw:<password-with-libpq-escaping>
```

Provision the password from the approved TEST migration credential source. Do not type it in a command, put it in an environment variable, shell history, script, or service file. Enter it through an approved secure password manager/editor or a `Read-Host -AsSecureString` prompt that writes directly to the protected passfile. In a libpq passfile, escape each literal backslash as `\\` and each colon as `\:`. The script reads the entry only in memory and never prints it. It rejects wildcard fields, extra entries, duplicate entries, and a mismatch with the pinned host/user/database.

For a direct secure prompt workflow, first create the config directory under a parent you have verified is private, create/write the password file only after the directory is protected, and then apply the exact ACL below. The password is transiently represented in process memory because libpq requires a plaintext passfile; it is never placed in a command argument or environment variable. Do not capture PowerShell transcripts while provisioning it.

```powershell
$configRoot = '<absolute-local-config-directory>'
$servicePath = Join-Path $configRoot 'pg_service.conf'
$passPath = Join-Path $configRoot 'pgpass.conf'
$caPath = '<absolute-CA-path-already-set-in-local-SUPABASE_TEST_CA_CERT>'
if ((Test-Path -LiteralPath $servicePath) -or (Test-Path -LiteralPath $passPath)) { throw 'Choose a new config directory; existing files will not be overwritten.' }

function Set-RentFlowPrivateAcl([string]$Path,[bool]$IsDirectory) {
  if ($IsDirectory) { $acl = New-Object System.Security.AccessControl.DirectorySecurity }
  else { $acl = New-Object System.Security.AccessControl.FileSecurity }
  $acl.SetAccessRuleProtection($true,$false)
  $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $system = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
  $rights = [System.Security.AccessControl.FileSystemRights]::FullControl
  $inherit = [System.Security.AccessControl.InheritanceFlags]::None
  if ($IsDirectory) {
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  }
  $propagation = [System.Security.AccessControl.PropagationFlags]::None
  $allow = [System.Security.AccessControl.AccessControlType]::Allow
  foreach ($sid in @($user,$system)) {
    $ruleArgs = @($sid,$rights,$inherit,$propagation,$allow)
    $rule = New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList $ruleArgs
    [void]$acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
}

# Create the config directory before adding its files; use a new private location.
[void][IO.Directory]::CreateDirectory($configRoot)
Set-RentFlowPrivateAcl $configRoot $true

# Write the password-free service file with the exact section and settings above.
# Its sslrootcert value must use libpq single quotes and doubled backslashes.
notepad.exe $servicePath
Set-RentFlowPrivateAcl $servicePath $false

# Apply the private ACL before writing the passfile. The secure prompt does not echo the password.
$securePassword = Read-Host 'TEST migration password' -AsSecureString
$passwordBstr = [IntPtr]::Zero
$bytes = $null
try {
  $passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
  $escapedPassword = $plainPassword.Replace('\','\\').Replace(':','\:')
  $entry = 'aws-1-ap-northeast-1.pooler.supabase.com:5432:postgres:postgres.dgasadodjzpjofkvjkbw:' + $escapedPassword
  $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($entry)
  $passStream = New-Object System.IO.FileStream($passPath,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
  try { $passStream.Write($bytes,0,$bytes.Length) } finally { $passStream.Dispose() }
  Set-RentFlowPrivateAcl $passPath $false
} finally {
  if ($bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
  $entry = $null; $escapedPassword = $null; $plainPassword = $null
  if ($passwordBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr) }
  $securePassword.Dispose()
}

# Protect the existing CA file and backup root without changing their contents.
Set-RentFlowPrivateAcl $caPath $false
Set-RentFlowPrivateAcl '<absolute-existing-encrypted-backup-directory>' $true
```

The commands above are operator instructions only; they have not been run. Create the CA file at the path already configured for the existing validator. Do not overwrite an existing config or backup directory to make this example fit; choose new paths and verify each parent first. The final backup script repeats the ACL, ancestry, path, and encryption checks before any network activity.

Protect the config files/directories, CA file, and existing backup root with ACLs that have inheritance disabled and exactly two FullControl allow rules: the current Windows user's SID and `SYSTEM`. On directories, those rules must inherit to child files and directories. No other ACE is accepted on these protected paths. Every ancestor up through the drive root must be owned by the current user, SYSTEM, or local Administrators, and must not grant an untrusted principal rights that permit write/create/delete/rename/ACL changes. The script fails closed if ACL inspection or owner translation fails. A local administrator or SYSTEM can always take control of a Windows machine; this check is designed to block ordinary other local users, not a compromised administrator.

Before choosing the volume, inspect it locally (this is an operator check, not performed by the script author):

```powershell
Get-BitLockerVolume -MountPoint 'E:' | Select-Object MountPoint,VolumeStatus,ProtectionStatus,EncryptionMethod
```

Use the actual drive letter. The script independently repeats the encryption/protection check for all protected paths. It will stop if `Get-BitLockerVolume` is unavailable or cannot confirm the required state.

## Run after review and approval

First verify the installed client version without connecting:

```powershell
$bin = 'C:\Program Files\PostgreSQL\17\bin'
& "$bin\pg_dump.exe" --version
& "$bin\pg_restore.exe" --version
& "$bin\psql.exe" --version
```

Run the backup from the repository root, passing only the two non-secret directories:

```powershell
& '.\scripts\security\rentflow-test-logical-backup.ps1' `
  -ConfigRoot '<absolute-local-config-directory>' `
  -BackupRoot '<absolute-existing-encrypted-backup-directory>'
```

The script first invokes the existing Supabase TEST validator through Bun, compares the external service settings to its validated non-secret target metadata, and performs a read-only identity query. The CA path is passed to the validator bridge through a temporary process environment field and is not returned or printed. Only after identity matches does it reserve a unique `.incomplete` artifact directory and run `pg_dump` with custom format and the `public`/`drizzle` schema filters. PostgreSQL stdout is copied as binary through an exclusive-create file handle, so a pre-existing archive or TOC file cannot be truncated. Any stderr output from either native tool causes a safe failure; raw diagnostics are suppressed. The tools use absolute PostgreSQL 17.12 executable paths and never use `--clean`, `--create`, or any option intended to modify the source database.

The report and `COMPLETE.txt` call `pg_restore --list` a **TOC/readability check only**. That command does not validate all archived table-data blocks or prove a complete restore will succeed. SHA-256 is recorded for integrity comparison. A handled failure leaves partial artifacts and a `FAILURE.txt` marker; abrupt termination leaves the uniquely named `.incomplete` directory and its `RUN-STATE.txt`, with no `COMPLETE.txt`. The script does not remove or overwrite an existing artifact. A successful archive is not a restore rehearsal. Plan that separately against a newly created isolated TEST target with the required Supabase prerequisites and compatible roles/extensions.
