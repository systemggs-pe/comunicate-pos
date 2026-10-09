$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$postgresPath = Join-Path $projectPath '.local\postgres'
$runtimePath = Join-Path $postgresPath 'runtime'
$dataPath = Join-Path $postgresPath 'data'
$binPath = Join-Path $runtimePath 'pgsql\bin'
$pgCtl = Join-Path $binPath 'pg_ctl.exe'
$databaseUri = [Uri]$env:DATABASE_URL
if ($databaseUri.Host -notin @('127.0.0.1', 'localhost') -or $databaseUri.Port -ne 55432 -or $databaseUri.AbsolutePath -ne '/communicate_pos') {
    throw 'Se requiere la base local communicate_pos en el puerto 55432.'
}
$credentials = $databaseUri.UserInfo.Split(':', 2)
$databaseUser = [Uri]::UnescapeDataString($credentials[0])
$databasePassword = [Uri]::UnescapeDataString($credentials[1])
if (-not $databaseUser -or -not $databasePassword) { throw 'DATABASE_URL requiere usuario y contraseña.' }

function Invoke-PostgresTool([string]$tool, [string[]]$toolArguments) {
    & (Join-Path $binPath $tool) @toolArguments
    if ($LASTEXITCODE -ne 0) { throw "Falló $tool. Consulta .local\postgres\postgres.log si corresponde." }
}

if (-not (Test-Path -LiteralPath $pgCtl)) {
    New-Item -ItemType Directory -Path $postgresPath -Force | Out-Null
    $archivePath = Join-Path $postgresPath 'postgresql-16.15.zip'
    if (-not (Test-Path -LiteralPath $archivePath)) {
        Write-Host 'Descargando PostgreSQL 16.15 desde EDB (sólo la primera vez, 317 MB)...'
        $partialPath = "$archivePath.partial"
        & curl.exe --fail --silent --show-error --location --retry 2 --max-time 600 --output $partialPath 'https://get.enterprisedb.com/postgresql/postgresql-16.15-1-windows-x64-binaries.zip'
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar PostgreSQL. Revisa tu conexión y vuelve a iniciar.' }
        Move-Item -LiteralPath $partialPath -Destination $archivePath -Force
    }
    Write-Host 'Extrayendo PostgreSQL...'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -notmatch '^pgsql/(bin|lib|share)/' -or $entry.FullName.EndsWith('/')) { continue }
            $targetPath = [IO.Path]::GetFullPath((Join-Path $runtimePath $entry.FullName))
            if (-not $targetPath.StartsWith([IO.Path]::GetFullPath($runtimePath) + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta no válida en el archivo.' }
            New-Item -ItemType Directory -Path (Split-Path -Parent $targetPath) -Force | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true)
        }
    } finally { $archive.Dispose() }
}

if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'PG_VERSION'))) {
    $passwordPath = Join-Path $postgresPath 'init-password.tmp'
    try {
        [IO.File]::WriteAllText($passwordPath, $databasePassword, [Text.UTF8Encoding]::new($false))
        Invoke-PostgresTool 'initdb.exe' @('-D', $dataPath, '-U', $databaseUser, '--pwfile', $passwordPath, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C')
    } finally {
        if (Test-Path -LiteralPath $passwordPath) { Remove-Item -LiteralPath $passwordPath }
    }
}
& $pgCtl -D $dataPath status *> $null
if ($LASTEXITCODE -ne 0) {
    Invoke-PostgresTool 'pg_ctl.exe' @('-D', $dataPath, '-l', (Join-Path $postgresPath 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w', '-t', '60', 'start')
}
$env:PGPASSWORD = $databasePassword
try {
    $connectionArguments = @('-h', '127.0.0.1', '-p', '55432', '-U', $databaseUser)
    $databaseExists = & (Join-Path $binPath 'psql.exe') @connectionArguments -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'communicate_pos'"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar a PostgreSQL. Verifica DATABASE_URL.' }
    if ($databaseExists -ne '1') { Invoke-PostgresTool 'createdb.exe' ($connectionArguments + @('communicate_pos')) }
    Write-Host 'PostgreSQL listo en 127.0.0.1:55432. Los datos persisten en .local\postgres\data.'
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
