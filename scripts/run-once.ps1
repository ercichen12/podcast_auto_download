$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Test-LocalTcpPort {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutMs = 1000
    )

    $Client = [System.Net.Sockets.TcpClient]::new()
    try {
        $AsyncResult = $Client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $AsyncResult.AsyncWaitHandle.WaitOne($TimeoutMs)) {
            return $false
        }
        $Client.EndConnect($AsyncResult)
        return $true
    } catch {
        return $false
    } finally {
        $Client.Close()
    }
}

function Add-NodeOption {
    param([string]$Option)

    $Options = @()
    if ($env:NODE_OPTIONS) {
        $Options = $env:NODE_OPTIONS -split "\s+" | Where-Object { $_ }
    }
    if ($Options -notcontains $Option) {
        $Options += $Option
    }
    $env:NODE_OPTIONS = $Options -join " "
}

$ProxyUrl = $env:RSSHUB_DOWNLOADER_PROXY
if (-not $ProxyUrl -and (Test-LocalTcpPort -HostName "127.0.0.1" -Port 7890)) {
    $ProxyUrl = "http://127.0.0.1:7890"
}

if ($ProxyUrl) {
    $env:HTTP_PROXY = $ProxyUrl
    $env:HTTPS_PROXY = $ProxyUrl

    $ExistingNoProxy = @()
    if ($env:NO_PROXY) {
        $ExistingNoProxy = $env:NO_PROXY -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    }
    $env:NO_PROXY = ((@("127.0.0.1", "localhost") + $ExistingNoProxy) | Select-Object -Unique) -join ","
    Add-NodeOption "--use-env-proxy"
    Write-Host "Using proxy for remote downloads: $ProxyUrl"
} else {
    Write-Host "No local proxy detected at 127.0.0.1:7890; running without proxy."
}

npm run download
