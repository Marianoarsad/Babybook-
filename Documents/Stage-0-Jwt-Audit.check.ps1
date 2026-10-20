# Masked input/transport checks. SQL, Node and user input are doubled; no vault or DB access.
$ErrorActionPreference = 'Stop'
$stage0Repository = Split-Path $PSScriptRoot -Parent
$jwtCheckTokens = $null
$jwtCheckErrors = $null
$jwtCheckAst = [Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $PSScriptRoot 'Stage-0-Environment.ps1'), [ref]$jwtCheckTokens, [ref]$jwtCheckErrors)
if ($jwtCheckErrors.Count) { throw 'Stage 0 helper syntax failed.' }
$jwtCheckNames = @('Read-Stage0Secret', 'Invoke-Stage0JwtAudit', 'Invoke-Stage0ProductionBackup')
$jwtCheckFunctions = @($jwtCheckAst.FindAll({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -in $jwtCheckNames
}, $false))
if ($jwtCheckFunctions.Count -ne 3) { throw 'Stage 0 check functions missing.' }
foreach ($definition in $jwtCheckFunctions) { . ([ScriptBlock]::Create($definition.Extent.Text)) }

function Assert-JwtCheck([bool]$Condition) {
    if (-not $Condition) { throw 'Fictional candidate transport check failed.' }
}
$script:jwtFixtureKey = ' fictional-' + [char]0x00e9 + '-"-\-key '
$script:jwtFixturePrompts = 0
$script:jwtFixtureExitCode = 0
function Read-Host([string]$Prompt, [switch]$AsSecureString) {
    Assert-JwtCheck ($AsSecureString -and $Prompt.Contains('JWT_SECRET'))
    $script:jwtFixturePrompts++
    return ConvertTo-SecureString $script:jwtFixtureKey -AsPlainText -Force
}
function node([string]$Script, [string]$Mode, [Parameter(ValueFromPipeline = $true)][string]$Packet) {
    process {
        Assert-JwtCheck ((Split-Path $Script -Leaf) -eq 'Stage-0-Backup.cjs')
        Assert-JwtCheck ($env:NODE_EXTRA_CA_CERTS -ceq $script:jwtFixtureCertificate)
        if ($Mode -eq 'audit-production-jwt') {
            Assert-JwtCheck ($OutputEncoding.CodePage -eq 65001)
            Assert-JwtCheck (($Packet | ConvertFrom-Json).candidateKey -ceq $script:jwtFixtureKey)
        } else {
            Assert-JwtCheck ($Mode -eq 'production-preservation')
            Assert-JwtCheck ($env:PGSSLROOTCERT -ceq $script:jwtFixtureCertificate)
        }
        $global:LASTEXITCODE = $script:jwtFixtureExitCode
        Write-Output '{"fictionalTransportOnly":true}'
    }
}

$jwtCheckParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$jwtCheckDirectory = Join-Path $jwtCheckParent ('babybook-stage0-jwt-check-' + [Guid]::NewGuid().ToString('N'))
$jwtCheckOriginalCa = [Environment]::GetEnvironmentVariable('NODE_EXTRA_CA_CERTS', 'Process')
$jwtCheckOriginalPgCa = [Environment]::GetEnvironmentVariable('PGSSLROOTCERT', 'Process')
$jwtCheckOriginalEncoding = $OutputEncoding
New-Item -ItemType Directory -Path $jwtCheckDirectory | Out-Null
try {
    $script:jwtFixtureCertificate = Join-Path $jwtCheckDirectory 'fictional-ca.crt'
    New-Item -ItemType File -Path $script:jwtFixtureCertificate | Out-Null
    $env:NODE_EXTRA_CA_CERTS = 'fictional-prior-ca'
    $result = Invoke-Stage0JwtAudit $script:jwtFixtureCertificate
    Assert-JwtCheck ($result -ceq '{"fictionalTransportOnly":true}')
    Assert-JwtCheck ($script:jwtFixturePrompts -eq 1)
    Assert-JwtCheck ($env:NODE_EXTRA_CA_CERTS -ceq 'fictional-prior-ca')
    Assert-JwtCheck ($OutputEncoding -eq $jwtCheckOriginalEncoding)

    $script:jwtFixtureExitCode = 1
    $failed = $false
    try { Invoke-Stage0JwtAudit $script:jwtFixtureCertificate | Out-Null }
    catch { $failed = $_.Exception.Message.StartsWith('Read-only candidate audit failed.') }
    Assert-JwtCheck $failed
    Assert-JwtCheck ($env:NODE_EXTRA_CA_CERTS -ceq 'fictional-prior-ca')
    Assert-JwtCheck ($OutputEncoding -eq $jwtCheckOriginalEncoding)

    $promptCount = $script:jwtFixturePrompts
    $failed = $false
    try { Invoke-Stage0JwtAudit (Join-Path $jwtCheckDirectory 'missing.crt') | Out-Null }
    catch { $failed = $_.Exception.Message.StartsWith('Supply the downloaded Supabase CA certificate') }
    Assert-JwtCheck ($failed -and $script:jwtFixturePrompts -eq $promptCount)
    $env:PGSSLROOTCERT = 'fictional-prior-pg-ca'
    $script:jwtFixtureExitCode = 0
    Assert-JwtCheck ((Invoke-Stage0ProductionBackup $script:jwtFixtureCertificate) -ceq '{"fictionalTransportOnly":true}')
    Assert-JwtCheck ($env:NODE_EXTRA_CA_CERTS -ceq 'fictional-prior-ca')
    Assert-JwtCheck ($env:PGSSLROOTCERT -ceq 'fictional-prior-pg-ca')
    $script:jwtFixtureExitCode = 1
    $failed = $false
    try { Invoke-Stage0ProductionBackup $script:jwtFixtureCertificate | Out-Null }
    catch { $failed = $_.Exception.Message.StartsWith('Backup verification failed.') }
    Assert-JwtCheck $failed
    Assert-JwtCheck ($env:NODE_EXTRA_CA_CERTS -ceq 'fictional-prior-ca')
    Assert-JwtCheck ($env:PGSSLROOTCERT -ceq 'fictional-prior-pg-ca')
    $failed = $false
    try { Invoke-Stage0ProductionBackup (Join-Path $jwtCheckDirectory 'missing.crt') | Out-Null }
    catch { $failed = $_.Exception.Message.StartsWith('Supply the downloaded Supabase CA certificate') }
    Assert-JwtCheck $failed
    Write-Output 'Masked candidate transport, backup CA restoration and failure checks passed with fictional data only.'
} finally {
    [Environment]::SetEnvironmentVariable('NODE_EXTRA_CA_CERTS', $jwtCheckOriginalCa, 'Process')
    [Environment]::SetEnvironmentVariable('PGSSLROOTCERT', $jwtCheckOriginalPgCa, 'Process')
    $OutputEncoding = $jwtCheckOriginalEncoding
    $jwtCheckResolved = (Resolve-Path -LiteralPath $jwtCheckDirectory).ProviderPath
    if ([IO.Path]::GetDirectoryName($jwtCheckResolved) -ine $jwtCheckParent.TrimEnd('\') -or
        [IO.Path]::GetFileName($jwtCheckResolved) -notlike 'babybook-stage0-jwt-check-*') {
        throw 'Fictional fixture cleanup path refused.'
    }
    Remove-Item -LiteralPath $jwtCheckResolved -Recurse -Force
}
