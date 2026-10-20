param(
    [ValidateSet('install', 'start', 'build', 'test', 'lint', 'check', 'format:check', 'test:e2e', 'test:e2e:mobile', 'test:e2e:all', 'test:e2e:update', 'preview')]
    [string]$Task = 'start',
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TaskArguments
)

$ErrorActionPreference = 'Stop'
$runtimeCandidates = @(
    $env:BOILERATE_NODE,
    (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

$selectedNode = $null
foreach ($candidate in $runtimeCandidates) {
    $versionText = & $candidate --version
    $versionValue = [version]($versionText.TrimStart('v'))
    if (($versionValue.Major -eq 22 -and $versionValue -ge [version]'22.22.3') -or
        ($versionValue.Major -eq 24 -and $versionValue -ge [version]'24.15.0') -or
        ($versionValue.Major -ge 26)) {
        $selectedNode = $candidate
        break
    }
}
if (-not $selectedNode) { throw 'Angular 22 requires Node 22.22.3+, 24.15.0+ or 26+. Set BOILERATE_NODE to a supported node.exe.' }

$env:Path = (Split-Path $selectedNode) + [IO.Path]::PathSeparator + $env:Path
Push-Location $PSScriptRoot
try {
    $npmEntry = Join-Path (Split-Path (Get-Command npm -ErrorAction Stop).Source) 'node_modules\npm\bin\npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmEntry)) { throw 'npm CLI was not found beside npm. Install npm with your supported Node runtime.' }
    if ($Task -eq 'install') {
        & $selectedNode $npmEntry exec --yes --package=npm@12.2.0 -- npm ci @TaskArguments
    } else {
        & $selectedNode $npmEntry run $Task -- @TaskArguments
    }
    $taskExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $taskExitCode
