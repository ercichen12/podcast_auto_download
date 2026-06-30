$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Entry = Join-Path $Root "src\rsshub-server.js"
$LogDir = Join-Path $Root "logs"
$OutLog = Join-Path $LogDir "rsshub.out.log"
$ErrLog = Join-Path $LogDir "rsshub.err.log"

if (-not (Test-Path -LiteralPath $Entry)) {
    throw "Local RSSHub wrapper is missing: $Entry"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$env:NODE_ENV = "production"
$env:PORT = "1200"
$env:HOST = "127.0.0.1"
$env:NODE_OPTIONS = "--max-http-header-size=32768"

$Process = Start-Process -FilePath "node" `
    -ArgumentList @($Entry) `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Write-Host "RSSHub started. PID: $($Process.Id)"
Write-Host "URL: http://127.0.0.1:1200"
