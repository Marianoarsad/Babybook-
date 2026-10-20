param([switch]$ExpectOriginalFailure)

# Regression check: loads only helper function definitions and uses fictional
# credentials in a fresh temporary directory. Never opens the actual vault.
$ErrorActionPreference = 'Stop'
$stage0CheckTokens = $null
$stage0CheckErrors = $null
$stage0CheckAst = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot 'Stage-0-Environment.ps1'),
    [ref]$stage0CheckTokens, [ref]$stage0CheckErrors)
if ($stage0CheckErrors.Count) { throw 'Stage 0 helper syntax failed.' }
$stage0CheckNames = @('Protect-Stage0Directory', 'Read-Stage0Credentials', 'Write-Stage0Credentials')
$stage0CheckFunctions = @($stage0CheckAst.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -in $stage0CheckNames
}, $false))
if ($stage0CheckFunctions.Count -ne $stage0CheckNames.Count) { throw 'Expected helper functions not found.' }
foreach ($definition in $stage0CheckFunctions) {
    . ([ScriptBlock]::Create($definition.Extent.Text))
}

function Assert-Stage0Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$stage0CheckTempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$stage0CheckDirectory = Join-Path $stage0CheckTempParent ('babybook-stage0-vault-check-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage0CheckDirectory | Out-Null
$stage0Vault = Join-Path $stage0CheckDirectory 'secrets\fictional.dpapi'
try {
    Protect-Stage0Directory (Split-Path $stage0Vault -Parent)
    Add-Type -AssemblyName System.Security
    $original = [pscustomobject]@{
        adminPassword = 'fictional-admin'
        testPassword = 'fictional-test'
        archivePassword = 'fictional-archive'
    }
    $clear = [Text.Encoding]::UTF8.GetBytes(($original | ConvertTo-Json -Compress))
    try {
        $encrypted = [Security.Cryptography.ProtectedData]::Protect($clear, $null,
            [Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllBytes($stage0Vault, $encrypted)
    } finally { [Array]::Clear($clear, 0, $clear.Length) }
    $before = [Convert]::ToBase64String([IO.File]::ReadAllBytes($stage0Vault))
    $incoming = Read-Stage0Credentials
    $incoming | Add-Member NoteProperty productionDatabaseUrl 'postgresql://fictional-only' -Force
    $incoming | Add-Member NoteProperty productionEncryptionKey 'fictional-production-key' -Force

    if ($ExpectOriginalFailure) {
        $failedAsExpected = $false
        try { Write-Stage0Credentials $incoming }
        catch {
            $failedAsExpected = $_.Exception.GetBaseException() -is [ArgumentException]
        }
        Assert-Stage0Check $failedAsExpected 'Original replacement bug was not reproduced.'
        Assert-Stage0Check ([Convert]::ToBase64String([IO.File]::ReadAllBytes($stage0Vault)) -ceq $before) 'Failure modified the original fixture vault.'
        Assert-Stage0Check (-not (Test-Path -LiteralPath ($stage0Vault + '.new'))) 'Failed save left a temporary fixture file.'
        Write-Output 'Original Windows PowerShell null-string replacement failure reproduced; fixture vault preserved.'
    } else {
        Write-Stage0Credentials $incoming
        $stored = Read-Stage0Credentials
        foreach ($name in @('adminPassword', 'testPassword', 'archivePassword')) {
            Assert-Stage0Check ($stored.$name -ceq $original.$name) 'An existing fixture credential changed.'
        }
        Assert-Stage0Check ($stored.productionEncryptionKey -ceq $incoming.productionEncryptionKey) 'Production fixture import missing.'
        Assert-Stage0Check ($stored.productionDatabaseUrl -ceq $incoming.productionDatabaseUrl) 'Production fixture URI missing.'
        $stored | Add-Member NoteProperty developmentStorageKey 'fictional-development-key' -Force
        Write-Stage0Credentials $stored
        $reimported = Read-Stage0Credentials
        Assert-Stage0Check ($reimported.developmentStorageKey -ceq $stored.developmentStorageKey) 'Development fixture import missing.'
        Assert-Stage0Check ($reimported.productionEncryptionKey -ceq $incoming.productionEncryptionKey) 'Production fixture credential lost on reimport.'
        Assert-Stage0Check (-not (Test-Path -LiteralPath ($stage0Vault + '.new'))) 'Successful save left a temporary fixture file.'
        Assert-Stage0Check ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($stage0Vault)) -notmatch 'fictional') 'Fixture vault was saved as plaintext.'
        Write-Output ('Stage 0 encrypted-vault save/reimport checks passed with fictional data (PowerShell ' + $PSVersionTable.PSVersion.ToString() + ').')
    }
} finally {
    # Only this new fixture directory is removable; never touch real credentials.
    $stage0CheckResolved = (Resolve-Path -LiteralPath $stage0CheckDirectory).ProviderPath
    if ([IO.Path]::GetDirectoryName($stage0CheckResolved) -ine $stage0CheckTempParent.TrimEnd('\') -or
        [IO.Path]::GetFileName($stage0CheckResolved) -notlike 'babybook-stage0-vault-check-*') {
        throw 'Fixture cleanup path refused.'
    }
    Remove-Item -LiteralPath $stage0CheckResolved -Recurse -Force
}
