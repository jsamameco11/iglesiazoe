$ErrorActionPreference = "Continue"
$tarball = "D:\Renzo\RENZO\1. G Y S DIGITALS\G Y S DIGITALS CODIGOS\IGLESIA CRISTIANA ZOE\iglesia-zoe-laravel.tgz"
$script  = "D:\Renzo\RENZO\1. G Y S DIGITALS\G Y S DIGITALS CODIGOS\IGLESIA CRISTIANA ZOE\iglesia-zoe-laravel\scripts\vps-deploy.sh"
$key     = "$env:USERPROFILE\.ssh\id_ed25519"
$host    = "root@161.132.51.100"
$sshOpts = @("-o","BatchMode=yes","-o","ConnectTimeout=12","-o","IPQoS=none","-o","ConnectionAttempts=1","-o","IdentitiesOnly=yes","-i",$key)
$deadline = (Get-Date).AddMinutes(45)
Write-Host "[watch] Esperando SSH en $host hasta $($deadline.ToString('HH:mm'))"
$ok = $false
while ((Get-Date) -lt $deadline) {
  $out = & ssh @sshOpts $host "echo SSH_UP && hostname && systemctl is-active apache2 2>/dev/null; systemctl is-active php8.3-fpm 2>/dev/null" 2>&1
  if ($LASTEXITCODE -eq 0 -and ($out -match 'SSH_UP')) {
    Write-Host "[watch] SSH OK: $out"
    $ok = $true; break
  }
  Write-Host "[watch] $(Get-Date -Format HH:mm:ss) sin ssh todavia..."
  Start-Sleep -Seconds 20
}
if (-not $ok) { Write-Host "[watch] TIMEOUT: SSH nunca respondio"; exit 2 }

Write-Host "[deploy] scp tarball ($(Get-Item $tarball).Length bytes)"
& scp @sshOpts "$tarball" "${host}:/tmp/iglesia-zoe-laravel.tgz"
if ($LASTEXITCODE -ne 0) { Write-Host "[deploy] scp tarball fallo"; exit 3 }

Write-Host "[deploy] scp vps-deploy.sh"
& scp @sshOpts "$script" "${host}:/tmp/vps-deploy.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "[deploy] scp script fallo"; exit 4 }

Write-Host "[deploy] ejecutando vps-deploy.sh en el VPS"
& ssh @sshOpts $host "sed -i 's/\r$//' /tmp/vps-deploy.sh && chmod +x /tmp/vps-deploy.sh && bash /tmp/vps-deploy.sh"
$rc = $LASTEXITCODE
Write-Host "[deploy] exit=$rc"

Write-Host "[verify] curl publico"
curl.exe -sI --max-time 25 "https://iglesiacristianazoe.miacademiapreu.com/" | Select-Object -First 6
Write-Host "---"
curl.exe -sI --max-time 25 "https://iglesiacristianazoe.miacademiapreu.com/acceso" | Select-Object -First 6
Write-Host "---"
curl.exe -sI --max-time 25 "https://iglesiacristianazoe2.miacademiapreu.com/" | Select-Object -First 6
exit $rc
