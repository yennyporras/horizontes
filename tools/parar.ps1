# Parada controlada de todas las terminales (cada una corta su sesion, hace commit de seguridad y termina).
$common = (Resolve-Path (git rev-parse --git-common-dir).Trim()).Path
Set-Content -Path (Join-Path $common 'STOP_HZ') -Value (Get-Date -Format o)
Write-Host "STOP activado. Las terminales se detienen en menos de 1 minuto y dejan commit de seguridad."
Write-Host "Para volver a lanzar, tools\lanzar.ps1 borra el STOP automaticamente."
