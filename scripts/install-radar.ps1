param(
    [string]$Version = "v2.2.0"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$RadarRoot = Join-Path $Root "tools\rsshub-radar"
$ZipPath = Join-Path $RadarRoot "chrome-mv3-prod-$Version.zip"
$OutputDir = Join-Path $RadarRoot "chrome-mv3-prod"
$Url = "https://github.com/DIYgod/RSSHub-Radar/releases/download/$Version/chrome-mv3-prod.zip"

New-Item -ItemType Directory -Force -Path $RadarRoot | Out-Null

if (-not (Test-Path -LiteralPath $ZipPath)) {
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath
}

if (Test-Path -LiteralPath $OutputDir) {
    Remove-Item -LiteralPath $OutputDir -Recurse -Force
}

Expand-Archive -LiteralPath $ZipPath -DestinationPath $OutputDir -Force

$Manifest = Join-Path $OutputDir "manifest.json"
if (-not (Test-Path -LiteralPath $Manifest)) {
    throw "RSSHub-Radar manifest.json not found after extraction: $Manifest"
}

Write-Host "RSSHub-Radar ready:"
Write-Host $OutputDir
Write-Host "Load this directory in Chrome/Edge extension developer mode."
