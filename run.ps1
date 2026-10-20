param(
    [ValidateSet('install', 'start', 'build', 'test', 'lint', 'check', 'format:check')]
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
    if ($Task -in @('start', 'build', 'check')) {
        & $selectedNode 'scripts/runtime-config.mjs'
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    if ($Task -eq 'install') {
        $npmEntry = Join-Path (Split-Path (Get-Command npm -ErrorAction Stop).Source) 'node_modules\npm\bin\npm-cli.js'
        if (-not (Test-Path -LiteralPath $npmEntry)) { throw 'npm CLI was not found beside npm. Install npm with your supported Node runtime.' }
        & $selectedNode $npmEntry exec --yes --package=npm@12.2.0 -- npm ci @TaskArguments
    } else {
        $cliEntry = switch ($Task) {
            'lint' { 'node_modules/eslint/bin/eslint.js' }
            'format:check' { 'node_modules/prettier/bin/prettier.cjs' }
            default { 'node_modules/@angular/cli/bin/ng.js' }
        }
        if ($Task -eq 'check') {
            & $selectedNode 'node_modules/eslint/bin/eslint.js' src
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $selectedNode $cliEntry test --watch=false
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $selectedNode $cliEntry build
        } elseif ($Task -eq 'start') {
            & $selectedNode $cliEntry serve --host 127.0.0.1 --port 4200 @TaskArguments
        } elseif ($Task -eq 'test') {
            & $selectedNode $cliEntry test --watch=false @TaskArguments
        } elseif ($Task -eq 'lint') {
            & $selectedNode $cliEntry src @TaskArguments
        } elseif ($Task -eq 'format:check') {
            & $selectedNode $cliEntry --check src public angular.json 'tsconfig*.json' package.json @TaskArguments
        } else {
            & $selectedNode $cliEntry $Task @TaskArguments
        }
    }
    $taskExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $taskExitCode
