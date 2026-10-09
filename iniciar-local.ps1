param([switch]$SinDocker)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeExecutable = $nodeCommand.Source
} else {
    $nodeExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $nodeExecutable)) {
        throw 'Instala Node.js 22.12 o superior, ejecuta npm install y vuelve a iniciar.'
    }
}
$env:PATH = "$(Split-Path -Parent $nodeExecutable);$env:PATH"
if ($SinDocker) {
    & $nodeExecutable scripts/local.mjs --native
} else {
    & $nodeExecutable scripts/local.mjs
}
exit $LASTEXITCODE
