# TEST billing repair 0005 allowlist

The single-migration runner requires an audited hash allowlist file outside the repository. The file contains the verified TEST journal hashes for migrations 0002 and 0003. Do not put those values in command arguments, `.env`, or a repository file.

In PowerShell, create the file under the current user's local application data directory. Replace both placeholders with the exact lowercase hashes from the verified TEST journal report before saving:

```powershell
$allowlistDirectory = Join-Path $env:LOCALAPPDATA 'RentFlow'
New-Item -ItemType Directory -Force -Path $allowlistDirectory | Out-Null
$allowlistPath = Join-Path $allowlistDirectory 'billing-repair-0005-journal-hashes.json'
$allowlistJson = @'
{
  "version": 1,
  "migrationHashes": {
    "0002_account_level_billing": "<paste-the-verified-64-character-lowercase-TEST-hash>",
    "0003_saas_entitlements_usage": "<paste-the-verified-64-character-lowercase-TEST-hash>"
  }
}
'@
[System.IO.File]::WriteAllText($allowlistPath, $allowlistJson, [System.Text.UTF8Encoding]::new($false))
$currentAccount = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $allowlistDirectory /inheritance:r /grant:r "${currentAccount}:(OI)(CI)F" | Out-Null
icacls $allowlistPath /inheritance:r /grant:r "${currentAccount}:F" | Out-Null
```

The runner rejects placeholders, uppercase or malformed hashes, duplicate JSON keys, missing or extra properties, relative paths, and paths that resolve inside the repository. It reads the allowlist without displaying its contents.

The invocation supplies only the file path, not the hashes:

```powershell
bun src/db/run-supabase-testing-billing-repair.ts --allowlist-file $allowlistPath
```

The runner remains an explicitly controlled TEST operation. Do not invoke it until execution is approved and the external file has been reviewed.
