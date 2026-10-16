# Abre las 4 terminales autonomas (una ventana cada una) y una ventana de integracion que corre sync al final.
# Uso: powershell -ExecutionPolicy Bypass -File .\tools\lanzar.ps1 -Rondas R0,R1
#      (luego -Rondas R2, -Rondas R3, -Rondas R4)
param([Parameter(Mandatory=$true)][string[]]$Rondas)
$root = (git rev-parse --show-toplevel).Trim(); Set-Location $root
$common = (Resolve-Path (git rev-parse --git-common-dir).Trim()).Path
$padre = Split-Path $root -Parent
Remove-Item (Join-Path $common 'STOP_HZ') -ErrorAction SilentlyContinue
$Rondas = @($Rondas | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$ult = $Rondas[-1]
New-Item -ItemType Directory -Force -Path (Join-Path $root 'logs') | Out-Null

for ($n = 1; $n -le 4; $n++) {
  $d = Join-Path $padre "hz-t$n"
  if (-not (Test-Path $d)) { Write-Host "Falta $d. Corre primero tools\preparar.ps1"; exit 1 }
  $l = @("`$Host.UI.RawUI.WindowTitle = 'Horizontes T$n - $($Rondas -join ',')'", "Set-Location '$d'")
  foreach ($r in $Rondas) { $l += "& '$root\tools\ronda.ps1' -T T$n -R $r" }
  $l += "Write-Host 'T$n termino $($Rondas -join ',')' -ForegroundColor Green"
  $f = Join-Path $root "logs\lanzar_T$n.ps1"
  Set-Content -Path $f -Value $l -Encoding UTF8
  Start-Process powershell.exe -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File',"`"$f`""
  Start-Sleep -Seconds 2
}

$li = @(
  "`$Host.UI.RawUI.WindowTitle = 'Horizontes - integracion tras $ult'",
  "Set-Location '$root'",
  "Write-Host 'Esperando a que las 4 terminales terminen $ult...'",
  "while (@(Get-ChildItem '$common' -Filter 'hz_${ult}_T*.done' -ErrorAction SilentlyContinue).Count -lt 4) { if (Test-Path '$common\STOP_HZ') { break }; Start-Sleep -Seconds 60 }",
  "& '$root\tools\sync.ps1' -R $ult"
)
$fi = Join-Path $root "logs\lanzar_integracion.ps1"
Set-Content -Path $fi -Value $li -Encoding UTF8
Start-Process powershell.exe -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File',"`"$fi`""

Write-Host "Rondas $($Rondas -join ',') lanzadas: 4 ventanas de terminal + 1 de integracion."
Write-Host "Estado: powershell -ExecutionPolicy Bypass -File .\tools\estado.ps1 -R $ult"
Write-Host "Parar:  powershell -ExecutionPolicy Bypass -File .\tools\parar.ps1"
