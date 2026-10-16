# Integra las 4 ramas en main (T1 -> T3 -> T2 -> T4), resuelve conflictos con Claude, corre pruebas y deja reporte.
# Uso: powershell -ExecutionPolicy Bypass -File .\tools\sync.ps1 -R R1
param([string]$R = 'manual')
$ErrorActionPreference = 'Continue'
$root = (git rev-parse --show-toplevel).Trim(); Set-Location $root
$common = (Resolve-Path (git rev-parse --git-common-dir).Trim()).Path
$exe = $null
foreach ($n in @('claude.exe','claude.cmd')) { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { $exe = $c.Source; break } }
$modo = 'acceptEdits'; $mf = Join-Path $common 'hz_modo'; if (Test-Path $mf) { $modo = (Get-Content $mf -Raw).Trim() }
if ($modo -eq 'auto') { $perm = '--permission-mode auto --permission-prompts none' } else { $perm = '--permission-mode acceptEdits' }
New-Item -ItemType Directory -Force -Path logs, docs\bitacora | Out-Null

git switch -q main
if ($LASTEXITCODE -ne 0) { Write-Host "No pude cambiar a main (algun worktree la tiene?)"; exit 1 }
$rep = @("# Integración tras $R · $(Get-Date -Format 'yyyy-MM-dd HH:mm')", "")

foreach ($b in @('t1-backend','t3-tablero','t2-participante','t4-admin')) {
  git merge --no-ff --no-edit $b *> $null
  if ($LASTEXITCODE -eq 0) { $rep += "- ${b}: integrada"; continue }
  Write-Host "Conflicto con $b : lo resuelve Claude"
  $inst = "Estás en la rama main con un merge en curso de '$b' que tiene conflictos. Resuélvelos conservando el trabajo de ambas partes y respetando la propiedad de carpetas del CLAUDE.md (en archivos de una terminal, gana la versión de su dueña). No cambies lógica fuera de los conflictos. Corre las pruebas (tools/test.sh con bash). Luego 'git add' de lo resuelto y 'git commit --no-edit'. No hagas push."
  Set-Content -Path logs\sync_conflicto.md -Value $inst -Encoding UTF8
  & cmd /c "`"$exe`" -p `"Lee y ejecuta las instrucciones del archivo logs/sync_conflicto.md`" $perm --output-format json --max-turns 80 > logs\.sync_$b.json 2>&1"
  $pend = git diff --name-only --diff-filter=U
  if ($pend) { git merge --abort; $rep += "- ${b}: NO integrada (conflictos sin resolver; queda para la siguiente ronda)" }
  else { $rep += "- ${b}: integrada con conflictos resueltos por Claude" }
}

$gitRoot = Split-Path (Split-Path (Get-Command git).Source -Parent) -Parent
$bash = Join-Path $gitRoot 'bin\bash.exe'
if (Test-Path tools\test.sh) {
  & $bash tools/test.sh 2>&1 | Out-File -FilePath "logs\.sync_test_$R.log" -Encoding UTF8
  if ($LASTEXITCODE -eq 0) { $rep += "- Pruebas: verde" } else { $rep += "- Pruebas: EN ROJO (ver logs\.sync_test_$R.log). Primera tarea de T1 en la siguiente ronda." }
} else { $rep += "- Pruebas: tools/test.sh aún no existe" }

$f = "docs\bitacora\S_$R.md"
Set-Content -Path $f -Value $rep -Encoding UTF8
git add $f; git commit -qm "[sync] integracion tras $R" *> $null
if (git remote) { git push -q origin main *> $null; if ($LASTEXITCODE -eq 0) { Add-Content $f "- main publicada en origin" } }
git switch --detach -q
Get-Content $f -Encoding UTF8
Write-Host ""
Write-Host "Integracion lista. Siguiente bloque cuando quieras (tools\lanzar.ps1 -Rondas ...)." -ForegroundColor Green
