# Tablero de control. Uso: powershell -ExecutionPolicy Bypass -File .\tools\estado.ps1 -R R1
param([Parameter(Mandatory=$true)][string]$R)
$root = (git rev-parse --show-toplevel).Trim(); $padre = Split-Path $root -Parent
$common = (Resolve-Path (git -C $root rev-parse --git-common-dir).Trim()).Path
for ($n = 1; $n -le 4; $n++) {
  $d = Join-Path $padre "hz-t$n"; if (-not (Test-Path $d)) { continue }
  $est = 'en curso'; if (Test-Path (Join-Path $common "hz_${R}_T$n.done")) { $est = 'terminada' }
  $bit = Join-Path $d "docs\bitacora\${R}_T$n.md"
  if ((Test-Path $bit) -and (Select-String -Path $bit -Pattern 'RONDA COMPLETA' -Quiet)) { $est += ' - COMPLETA' }
  Write-Host "== T$n ($est)" -ForegroundColor Cyan
  Write-Host ("   ultimo commit: " + (git -C $d log -1 --format='%cr - %s'))
  $lg = Join-Path $d "logs\${R}_T$n.log"
  if (Test-Path $lg) { $u = Get-Content $lg -Tail 1 -Encoding UTF8; if ($u.Length -gt 160) { $u = $u.Substring(0,160) }; Write-Host "   ultimo log:    $u" }
  $bl = Join-Path $d 'docs\BLOQUEOS.md'
  if (Test-Path $bl) { Select-String -Path $bl -Pattern '^- 20' | Select-Object -Last 2 | ForEach-Object { Write-Host ("   bloqueo: " + $_.Line) -ForegroundColor Yellow } }
}
if (Test-Path (Join-Path $common 'STOP_HZ')) { Write-Host "!! STOP activo" -ForegroundColor Red }
