param([ValidateSet('Prepare', 'ResumePreparation', 'Start', 'Test', 'Check', 'Stop',
    'ImportProduction', 'ImportDevelopment', 'ArchivePassword', 'RunDevelopment', 'Harden',
    'AuditProductionJwt', 'BackupProduction')][string]$Action = 'Check', [string]$CertificatePath)

# Cluster/test actions never connect to production or the original babybook DB.
# Import actions store masked input only; RunDevelopment uses the existing local DB.
$ErrorActionPreference = 'Stop'
$stage0Root = 'C:\Users\Arzad\AppData\Local\BabyBookStage0'
$stage0Bin = Join-Path $stage0Root 'tools\PostgreSQL17\pgsql\bin'
$stage0Data = Join-Path $stage0Root 'data17'
$stage0Vault = Join-Path $stage0Root 'secrets\credentials.dpapi'
$stage0Port = 55432
$stage0Repository = Split-Path $PSScriptRoot -Parent

function Protect-Stage0Directory([string]$Path) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    # icacls changes only access rules, avoiding Set-Acl's audit-privilege issue.
    $trusted = @([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
        'S-1-5-18', 'S-1-5-32-544')
    $grants = @($trusted | ForEach-Object { "*${_}:(OI)(CI)F" })
    & icacls.exe $Path /inheritance:r /grant:r @grants | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Private directory permission setup failed' }
    foreach ($rule in @((Get-Acl -LiteralPath $Path).Access)) {
        $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
        if ($rule.AccessControlType -eq 'Allow' -and $sid -notin $trusted) {
            & icacls.exe $Path /remove:g "*$sid" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Extra directory access could not be removed' }
        }
    }
}

function New-Stage0Password {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

function Read-Stage0Credentials {
    Add-Type -AssemblyName System.Security
    $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
        [IO.File]::ReadAllBytes($stage0Vault), $null,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { return [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json }
    finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

function Read-Stage0Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ([string]::IsNullOrWhiteSpace($value)) { throw 'Empty input refused; vault unchanged.' }
        return $value
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secure.Dispose()
    }
}

function Invoke-Stage0JwtAudit([string]$Certificate) {
    if (-not $Certificate -or -not (Test-Path -LiteralPath $Certificate -PathType Leaf)) {
        throw 'Supply the downloaded Supabase CA certificate with -CertificatePath. No audit started.'
    }
    $certificateFile = (Resolve-Path -LiteralPath $Certificate).ProviderPath
    $previousCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
    $previousEncoding = $OutputEncoding
    $candidate = $null
    $payload = $null
    try {
        $env:NODE_EXTRA_CA_CERTS = $certificateFile
        $OutputEncoding = New-Object Text.UTF8Encoding($false)
        $candidate = Read-Stage0Secret 'Paste the EXISTING Render JWT_SECRET (hidden; read-only check, do not change Render)'
        $payload = @{ candidateKey = $candidate } | ConvertTo-Json -Compress
        # Private pipe only: no secret in argv, files, environment variables or vault.
        $payload | & node (Join-Path $stage0Repository 'Documents\Stage-0-Backup.cjs') audit-production-jwt
        if ($LASTEXITCODE -ne 0) { throw 'Read-only candidate audit failed. Share only the sanitized report; do not rotate keys.' }
    } finally {
        $candidate = $null
        $payload = $null
        $OutputEncoding = $previousEncoding
        [Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS', $previousCa, 'Process')
    }
}

function Invoke-Stage0ProductionBackup([string]$Certificate) {
    if (-not $Certificate -or -not (Test-Path -LiteralPath $Certificate -PathType Leaf)) {
        throw 'Supply the downloaded Supabase CA certificate with -CertificatePath. No backup started.'
    }
    $certificateFile = (Resolve-Path -LiteralPath $Certificate).ProviderPath
    $names = @('NODE_EXTRA_CA_CERTS', 'PGSSLROOTCERT')
    $prior = @{}
    foreach ($name in $names) { $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    try {
        $env:NODE_EXTRA_CA_CERTS = $certificateFile
        $env:PGSSLROOTCERT = $certificateFile
        & node (Join-Path $stage0Repository 'Documents\Stage-0-Backup.cjs') production-preservation
        if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed. Preserve any archive/restore and share only the sanitized report; do not rerun or reset.' }
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
    }
}

function Write-Stage0Credentials($Credentials) {
    Protect-Stage0Directory (Split-Path $stage0Vault -Parent)
    Add-Type -AssemblyName System.Security
    $clear = [Text.Encoding]::UTF8.GetBytes(($Credentials | ConvertTo-Json -Compress))
    $temporary = $stage0Vault + '.new'
    try {
        $protected = [System.Security.Cryptography.ProtectedData]::Protect($clear, $null,
            [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllBytes($temporary, $protected)
        # Windows PowerShell coerces $null to an empty string for .NET string
        # parameters. File.Replace needs a real null backup path, not "".
        [IO.File]::Replace($temporary, $stage0Vault, [NullString]::Value)
    } finally {
        [Array]::Clear($clear, 0, $clear.Length)
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
    }
}

if ($Action -eq 'Harden') {
    Protect-Stage0Directory $stage0Root
    Protect-Stage0Directory (Join-Path $stage0Root 'secrets')
    Protect-Stage0Directory 'C:\Users\Arzad\BabyBook+ Backups'
    Write-Output 'Stage 0 directory permissions restricted to the current Windows account, SYSTEM and administrators.'
    exit
}

if ($Action -eq 'ImportProduction') {
    $credentials = Read-Stage0Credentials
    $connection = Read-Stage0Secret 'Paste the CURRENT production Session pooler URI (hidden; do not reset its password yet)'
    try { $target = [Uri]$connection } catch { throw 'Invalid URI; vault unchanged.' }
    if ($target.Scheme -notin @('postgres', 'postgresql') -or $target.Port -ne 5432 -or
        $target.AbsolutePath -ne '/postgres' -or $target.Host -notmatch '^aws-[0-9]+-ap-southeast-1\.pooler\.supabase\.com$' -or
        $target.UserInfo -notmatch '^postgres\.icssxprtxspcgmkompdj:.+' -or $target.Query -or $target.Fragment) {
        throw 'Expected BabyBook+ production Session pooler, Singapore, port 5432; vault unchanged.'
    }
    $key = Read-Stage0Secret 'Paste the EXISTING Render DATA_ENCRYPTION_KEY (hidden; never generate a replacement)'
    $credentials | Add-Member NoteProperty productionDatabaseUrl $connection -Force
    $credentials | Add-Member NoteProperty productionEncryptionKey $key -Force
    Write-Stage0Credentials $credentials
    Write-Output 'Production inputs stored with Windows-account encryption. No environment key, record, password or service was changed.'
    exit
}

if ($Action -eq 'ImportDevelopment') {
    $credentials = Read-Stage0Credentials
    $key = Read-Stage0Secret 'Paste the server-only service_role key for BabyBook+ Development (NOT production and NOT an anon key)'
    $credentials | Add-Member NoteProperty developmentStorageKey $key -Force
    Write-Stage0Credentials $credentials
    & node (Join-Path $PSScriptRoot 'Stage-0-Backup.cjs') verify-development
    if ($LASTEXITCODE -ne 0) { throw 'Development key could not be verified; do not run the development server yet.' }
    Write-Output 'Development Storage input stored privately and verified against the development project.'
    exit
}

if ($Action -eq 'AuditProductionJwt') {
    Invoke-Stage0JwtAudit $CertificatePath
    exit
}

if ($Action -eq 'BackupProduction') {
    Invoke-Stage0ProductionBackup $CertificatePath
    exit
}

if ($Action -eq 'ArchivePassword') {
    $credentials = Read-Stage0Credentials
    Write-Output 'This places the archive password in your clipboard. Paste ONLY into your trusted password manager, not chat or a terminal.'
    if ((Read-Host 'Type COPY to continue while no screen recording or clipboard sync is running') -cne 'COPY') { exit }
    try {
        Set-Clipboard -Value $credentials.archivePassword
        Read-Host 'Save it in your password manager. Press Enter when saved to clear the clipboard' | Out-Null
    } finally {
        if ((Get-Clipboard -Raw).TrimEnd([char[]]"`r`n") -ceq $credentials.archivePassword) {
            Set-Clipboard -Value ''
        }
    }
    Write-Output 'Password transfer finished. Independent recovery is NOT verified until you open an archive using your saved copy.'
    exit
}

if ($Action -eq 'RunDevelopment') {
    $credentials = Read-Stage0Credentials
    if (-not $credentials.developmentStorageKey) { throw 'Run ImportDevelopment first.' }
    & node (Join-Path $PSScriptRoot 'Stage-0-Backup.cjs') verify-development
    if ($LASTEXITCODE -ne 0) { throw 'Development Storage verification failed; no server started.' }
    $names = @('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET', 'NODE_ENV')
    $prior = @{}
    foreach ($name in $names) { $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    try {
        $env:SUPABASE_URL = 'https://yrkvntaqkikuofbpfmkh.supabase.co'
        $env:SUPABASE_SERVICE_ROLE_KEY = $credentials.developmentStorageKey
        $env:SUPABASE_STORAGE_BUCKET = 'attachments'
        $env:NODE_ENV = 'development'
        Push-Location (Join-Path $stage0Repository 'back-end')
        try {
            @'
require('dotenv').config({ quiet: true });
const u = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) || u.pathname !== '/babybook') process.exit(1);
'@ | & node
            if ($LASTEXITCODE -ne 0) { throw 'Local development DB guard failed; no server started.' }
            & npm.cmd run dev
        } finally { Pop-Location }
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
    }
    exit
}

function Invoke-Stage0Sql([string]$Sql, [string]$Database = 'postgres') {
    # Password is inherited privately by the child, not put in command arguments.
    $Sql | & (Join-Path $stage0Bin 'psql.exe') -X -q -v ON_ERROR_STOP=1 `
        -h 127.0.0.1 -p $stage0Port -U bb_stage0_admin -d $Database
    if ($LASTEXITCODE -ne 0) { throw 'Isolated Stage 0 SQL failed' }
}

if (-not (Test-Path -LiteralPath (Join-Path $stage0Bin 'postgres.exe'))) {
    throw 'Install the approved PostgreSQL 17 binaries into the Stage 0 tools directory first.'
}
$stage0Version = & (Join-Path $stage0Bin 'postgres.exe') --version
if ($stage0Version -notmatch 'PostgreSQL\) 17\.') { throw 'PostgreSQL 17 is required' }

if ($Action -eq 'Prepare') {
    if (Test-Path -LiteralPath $stage0Data) { throw 'Existing cluster preserved; use Check instead.' }
    if (Get-NetTCPConnection -LocalPort $stage0Port -State Listen -ErrorAction SilentlyContinue) {
        throw 'Stage 0 port is occupied; no existing service was changed.'
    }
    Protect-Stage0Directory $stage0Root
    Protect-Stage0Directory (Join-Path $stage0Root 'secrets')
    Protect-Stage0Directory 'C:\Users\Arzad\BabyBook+ Backups'
    $credentials = @{
        adminPassword = New-Stage0Password
        testPassword = New-Stage0Password
        archivePassword = New-Stage0Password
    }
    Add-Type -AssemblyName System.Security
    $clear = [Text.Encoding]::UTF8.GetBytes(($credentials | ConvertTo-Json -Compress))
    try {
        [IO.File]::WriteAllBytes($stage0Vault,
            [System.Security.Cryptography.ProtectedData]::Protect($clear, $null,
                [System.Security.Cryptography.DataProtectionScope]::CurrentUser))
    } finally { [Array]::Clear($clear, 0, $clear.Length) }
    # Ephemeral generated credential artifact, kept inside the private directory.
    $passwordFile = Join-Path $stage0Root 'secrets\init-password.tmp'
    try {
        [IO.File]::WriteAllText($passwordFile, $credentials.adminPassword, [Text.Encoding]::ASCII)
        & (Join-Path $stage0Bin 'initdb.exe') -D $stage0Data -U bb_stage0_admin `
            --auth=scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordFile"
        if ($LASTEXITCODE -ne 0) { throw 'Isolated cluster initialization failed' }
    } finally {
        if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
    }
}

if ($Action -in @('Prepare', 'ResumePreparation', 'Start')) {
    $credentials = Read-Stage0Credentials
    $startup = Start-Process -FilePath (Join-Path $stage0Bin 'pg_ctl.exe') -WindowStyle Hidden `
        -ArgumentList @('start', '-w', '-D', $stage0Data, '-l', (Join-Path $stage0Root 'postgres.log'),
            '-o', '"-h 127.0.0.1 -p 55432 -c max_connections=20"') -PassThru
    # Start-Process -Wait follows the server descendants indefinitely on Windows.
    # Wait only for pg_ctl, not the intentionally long-running postgres process.
    if (-not $startup.WaitForExit(30000)) { throw 'Isolated server startup timed out' }
    if ($startup.ExitCode -ne 0) { throw 'Isolated cluster start failed' }
}

if ($Action -in @('Prepare', 'ResumePreparation')) {
    $credentials = Read-Stage0Credentials
    $priorPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $credentials.adminPassword
        Invoke-Stage0Sql "CREATE ROLE bb_stage0_test LOGIN CONNECTION LIMIT 5 PASSWORD '$($credentials.testPassword)';"
        Invoke-Stage0Sql 'CREATE DATABASE babybook_stage0_test OWNER bb_stage0_test TEMPLATE template0;'
        Invoke-Stage0Sql 'CREATE DATABASE babybook_stage0_recovery OWNER bb_stage0_admin TEMPLATE template0;'
        Invoke-Stage0Sql 'REVOKE CONNECT ON DATABASE babybook_stage0_recovery FROM PUBLIC;'
    } finally { $env:PGPASSWORD = $priorPassword }
    Write-Output 'Prepared: isolated PostgreSQL 17 on loopback port 55432; separate test and recovery databases.'
    Write-Output 'Credentials are Windows-account encrypted; archive password requires a separate offline recovery copy.'
}

if ($Action -eq 'Check') {
    $credentials = Read-Stage0Credentials
    $priorPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $credentials.adminPassword
        Invoke-Stage0Sql "SELECT current_setting('server_version') AS version,
                current_setting('listen_addresses') AS listen_addresses,
                current_setting('port') AS port;
            SELECT datname FROM pg_database WHERE datname LIKE 'babybook_stage0_%' ORDER BY datname;
            SELECT rolname, rolsuper, rolcreatedb, rolconnlimit FROM pg_roles WHERE rolname='bb_stage0_test';
            SELECT has_database_privilege('bb_stage0_test', 'babybook_stage0_recovery', 'CONNECT') AS test_role_can_access_recovery;"
    } finally { $env:PGPASSWORD = $priorPassword }
}

if ($Action -eq 'Test') {
    $credentials = Read-Stage0Credentials
    $names = @('DATABASE_URL','DB_SSL','NODE_ENV','JWT_SECRET','DATA_ENCRYPTION_KEY',
        'SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET',
        'SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM')
    $prior = @{}
    foreach ($name in $names) { $prior[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
    try {
        $password = [Uri]::EscapeDataString($credentials.testPassword)
        $env:DATABASE_URL = "postgresql://bb_stage0_test:${password}@127.0.0.1:55432/babybook_stage0_test"
        $target = [Uri]$env:DATABASE_URL
        if ($target.Host -ne '127.0.0.1' -or $target.Port -ne 55432 -or
                $target.AbsolutePath -ne '/babybook_stage0_test') { throw 'Disposable target guard failed' }
        $env:DB_SSL = 'false'
        $env:NODE_ENV = 'test'
        $env:JWT_SECRET = 'stage0-fictional-test-only'
        $env:DATA_ENCRYPTION_KEY = 'stage0-fictional-test-only'
        $env:SUPABASE_URL = 'http://127.0.0.1:9'
        $env:SUPABASE_SERVICE_ROLE_KEY = 'stage0-no-real-storage'
        $env:SUPABASE_STORAGE_BUCKET = 'stage0-fictional-only'
        $env:SMTP_HOST = '127.0.0.1'
        $env:SMTP_PORT = '9'
        $env:SMTP_USER = 'stage0-no-real-email'
        $env:SMTP_PASS = 'stage0-no-real-email'
        $env:SMTP_FROM = 'stage0@example.invalid'
        Push-Location (Join-Path $stage0Repository 'back-end')
        try {
            & npm.cmd test -- --runInBand
            if ($LASTEXITCODE -ne 0) { throw 'Disposable integration tests failed; do not mark this evidence as passed.' }
        } finally { Pop-Location }
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $prior[$name], 'Process') }
    }
}

if ($Action -eq 'Stop') {
    & (Join-Path $stage0Bin 'pg_ctl.exe') stop -w -D $stage0Data -m fast
    if ($LASTEXITCODE -ne 0) { throw 'Isolated cluster stop failed' }
}
