# Preparacion unica (5 min). Ejecutar en la carpeta principal del repo con el kit ya commiteado en main:
#   powershell -ExecutionPolicy Bypass -File .\tools\preparar.ps1
$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel).Trim(); Set-Location $root
$common = (Resolve-Path (git rev-parse --git-common-dir).Trim()).Path
$padre = Split-Path $root -Parent

$exe = $null
foreach ($n in @('claude.exe','claude.cmd')) { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { $exe = $c.Source; break } }
if (-not $exe) { throw "No encuentro Claude Code. Instalalo con: irm https://claude.ai/install.ps1 | iex  (y abre PowerShell de nuevo)" }
if (-not (Test-Path .env)) { throw "Falta .env en $root (ver README_ARRANQUE.md, paso 3)" }
git show-ref -q refs/heads/main; if ($LASTEXITCODE -ne 0) { throw "No existe la rama main. Haz el commit inicial." }
if (git status --porcelain) { throw "Hay cambios sin commit en main. Haz commit primero." }

$ramas = @('t1-backend','t2-participante','t3-tablero','t4-admin')
for ($i = 1; $i -le 4; $i++) {
  $d = Join-Path $padre "hz-t$i"
  if (-not (Test-Path $d)) { git worktree add $d -b $ramas[$i-1] main | Out-Null }
  Copy-Item .env (Join-Path $d '.env') -Force
  Write-Host "Terminal T$i lista en $d (rama $($ramas[$i-1]))"
}
git switch --detach -q
Write-Host "main liberada (la carpeta principal queda en HEAD separado: es normal)"

$ErrorActionPreference = 'Continue'
function Probar([string]$flags) {
  $o = & cmd /c "`"$exe`" -p `"Responde solo: OK`" $flags --output-format json --max-turns 1 2>nul"
  try { $j = ($o -join "`n") | ConvertFrom-Json; return ($j.result -and -not $j.is_error) } catch { return $false }
}
if (Probar '--permission-mode auto --permission-prompts none') { $modo = 'auto' }
elseif (Probar '--permission-mode acceptEdits') { $modo = 'acceptEdits' }
else { throw "Claude Code no respondio en modo headless. Abre 'claude' una vez, inicia sesion con la cuenta del equipo y vuelve a correr este script." }
Set-Content -Path (Join-Path $common 'hz_modo') -Value $modo
Write-Host "Modo de permisos para las rondas: $modo"
if (Test-Path (Join-Path $padre 'irmi')) { Write-Host "Repo IRMI encontrado en $padre\irmi" } else { Write-Host "AVISO: no encuentro $padre\irmi. Clonalo ahi o deja la ruta en docs/STACK.md" }
Write-Host "Listo. Siguiente paso: powershell -ExecutionPolicy Bypass -File .\tools\lanzar.ps1 -Rondas R0,R1"
