# Builds the front end, packages only code (never the database or uploads) and applies it on the VPS.
# Usage, from iglesia-zoe-laravel/:  powershell -ExecutionPolicy Bypass -File deploy\release.ps1
param(
  [string]$Server = "root@161.132.51.100",
  [string[]]$Sites = @("https://iglesiacristianazoe.miacademiapreu.com", "https://iglesiacristianazoe2.miacademiapreu.com", "https://admi-iglesiazoe.miacademiapreu.com"),
  [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$app = Split-Path -Parent $PSScriptRoot
Set-Location $app

if (-not $SkipBuild) {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}

$package = Join-Path $env:TEMP "zoe-release.tgz"
if (Test-Path $package) { Remove-Item $package }
tar -czf $package app config routes bootstrap/app.php database/migrations database/seeders resources/views public/build composer.json composer.lock
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
Write-Host ("Package: {0:N1} MB" -f ((Get-Item $package).Length / 1MB))

scp -q $package "${Server}:/root/zoe-release.tgz"
scp -q (Join-Path $PSScriptRoot "release.sh") "${Server}:/root/zoe-release.sh"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }
ssh $Server "sed -i 's/\r$//' /root/zoe-release.sh && bash /root/zoe-release.sh"
if ($LASTEXITCODE -ne 0) { throw "release failed on the server" }

foreach ($site in $Sites) {
  foreach ($path in "/", "/acceso") {
    $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 25 "$site$path"
    Write-Host "$code  $site$path"
  }
}
