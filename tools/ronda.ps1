# Ronda autonoma de una terminal (Windows PowerShell 5.1+).
# Uso: powershell -ExecutionPolicy Bypass -File <repo>\tools\ronda.ps1 -T T1 -R R1 [-Min 240]
# Se ejecuta DESDE la carpeta del worktree (hz-t1...). La lanza tools\lanzar.ps1.
param(
  [Parameter(Mandatory=$true)][ValidateSet('T1','T2','T3','T4')][string]$T,
  [Parameter(Mandatory=$true)][ValidateSet('R0','R1','R2','R3','R4')][string]$R,
  [int]$Min = 0
)
$ErrorActionPreference = 'Continue'
if ($Min -le 0) { if ($R -eq 'R0') { $Min = 60 } else { $Min = 240 } }

$root = (git rev-parse --show-toplevel).Trim()
Set-Location $root
$common = (Resolve-Path (git rev-parse --git-common-dir).Trim()).Path
$prompt = Get-ChildItem -Path "prompts" -Filter "${R}_${T}_*.md" | Select-Object -First 1
if (-not $prompt) { Write-Host "No existe prompts\${R}_${T}_*.md"; exit 1 }
$promptRel = "prompts/" + $prompt.Name

$exe = $null
foreach ($n in @('claude.exe','claude.cmd')) { $c = Get-Command $n -ErrorAction SilentlyContinue; if ($c) { $exe = $c.Source; break } }
if (-not $exe) { Write-Host "No encuentro Claude Code (claude.exe). Instalalo y vuelve a abrir PowerShell."; exit 1 }

New-Item -ItemType Directory -Force -Path logs, docs\bitacora | Out-Null
$bit  = "docs/bitacora/${R}_${T}.md"
$log  = "logs\${R}_${T}.log"
$sidf = "logs\${R}_${T}.session"
$out  = "logs\.ultimo_${R}_${T}.json"
$errf = "logs\.ultimo_${R}_${T}.err"
$turno = "logs/turno_${R}_${T}.md"
$done = Join-Path $common "hz_${R}_${T}.done"
$stop = Join-Path $common "STOP_HZ"
Remove-Item $done -ErrorAction SilentlyContinue

$inicio = Get-Date
$fin = $inicio.AddMinutes($Min)
$maxTurns = 200
$modoFile = Join-Path $common 'hz_modo'
$modo = 'auto'
if ($env:HZ_MODO) { $modo = $env:HZ_MODO } elseif (Test-Path $modoFile) { $modo = (Get-Content $modoFile -Raw).Trim() }
switch ($modo) {
  'bypass'      { $perm = '--dangerously-skip-permissions' }
  'acceptEdits' { $perm = '--permission-mode acceptEdits' }
  default       { $perm = '--permission-mode auto --permission-prompts none' }
}

function Log($m) { $l = "[{0}] [{1} {2}] {3}" -f (Get-Date -Format 'HH:mm:ss'), $T, $R, $m; Write-Host $l; Add-Content -Path $log -Value $l -Encoding UTF8 }
function Completa { (Test-Path $bit) -and (Select-String -Path $bit -Pattern 'RONDA COMPLETA' -Quiet) }
function Parar { Test-Path $stop }
function Quedan { [int][math]::Floor(($fin - (Get-Date)).TotalMinutes) }

# 1) Sincronizar con main
$nota = ''
git show-ref -q refs/heads/main
if ($LASTEXITCODE -eq 0) {
  git rebase main 2>&1 | Out-File -FilePath $log -Append -Encoding UTF8
  if ($LASTEXITCODE -ne 0) {
    git rebase --abort 2>&1 | Out-File -FilePath $log -Append -Encoding UTF8
    $nota = "IMPORTANTE: el rebase automatico sobre main fallo. Tu primera tarea es 'git merge main' y resolver los conflictos respetando la propiedad de carpetas del CLAUDE.md."
  }
}

$reglas = @"
Reglas de esta ronda autónoma (nadie va a responder preguntas):
- Hora límite: $($fin.ToString('HH:mm')) (hora local). Trabaja por entregables completos y en orden.
- Tu bitácora $bit es tu memoria: actualízala después de CADA entregable (hecho, en curso, siguiente, decisiones). Si la sesión se reinicia, de ahí continúas.
- Commit después de cada entregable con mensaje '[$T] ...'. Nunca hagas checkout de main ni push forzado. No modifiques los scripts de orquestación (tools/ronda.*, lanzar.*, sync.*, preparar.*, estado.*, parar.*).
- Antes de terminar cada respuesta, detén cualquier servidor de desarrollo o proceso en segundo plano que hayas iniciado.
- No hagas preguntas. Decide con docs/SPEC.md y registra en docs/DECISIONES.md. Bloqueos reales: docs/BLOQUEOS.md y sigue con otra tarea.
- Cuando completes TODOS los entregables y criterios de aceptación de tu prompt, escribe al final de la bitácora la línea exacta: RONDA COMPLETA
"@

function Correr([string]$texto) {
  Set-Content -Path $turno -Value $texto -Encoding UTF8
  $argStr = "-p `"Lee y ejecuta las instrucciones del archivo $turno`" $perm --output-format json --max-turns $maxTurns"
  if ((Test-Path $sidf) -and ((Get-Content $sidf -Raw).Trim())) { $argStr += " --resume " + (Get-Content $sidf -Raw).Trim() }
  $p = Start-Process -FilePath $exe -ArgumentList $argStr -RedirectStandardOutput $out -RedirectStandardError $errf -NoNewWindow -PassThru
  $null = $p.Handle
  while (-not $p.HasExited) {
    Start-Sleep -Seconds 20
    if ((Parar) -or ((Get-Date) -gt $fin.AddMinutes(15))) {
      Log "Corte: STOP o tiempo excedido; cerrando la sesion"
      & taskkill.exe /T /F /PID $p.Id *> $null
    }
  }
  $p.WaitForExit()
  if (Test-Path $errf) { Get-Content $errf -Encoding UTF8 | Add-Content -Path $log -Encoding UTF8 }
  $ok = $false
  try {
    $j = Get-Content $out -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($j.session_id) { Set-Content -Path $sidf -Value $j.session_id } else { Remove-Item $sidf -ErrorAction SilentlyContinue }
    $res = [string]$j.result; if ($res.Length -gt 400) { $res = $res.Substring(0,400) }
    Add-Content -Path $log -Value ("  resultado: " + ($res -replace "`r?`n",' ') + "  | turnos: " + $j.num_turns) -Encoding UTF8
    $ok = (-not $j.is_error) -and ($p.ExitCode -eq 0)
  } catch {
    Remove-Item $sidf -ErrorAction SilentlyContinue
    Log "Respuesta no legible de Claude (codigo $($p.ExitCode))"
  }
  return $ok
}

Log "Inicio ronda $R ($promptRel). Fin previsto $($fin.ToString('HH:mm')). Modo de permisos: $modo"
$null = Correr ("Eres $T en la ronda $R del proyecto Horizontes. Lee CLAUDE.md y los documentos en el orden que indica, luego lee y ejecuta $promptRel de principio a fin en modo autónomo. $nota`n`n$reglas")

$err = 0
while (-not (Completa) -and -not (Parar)) {
  $q = Quedan
  if ($q -le 0) { break }
  if ($q -le 25) {
    Log "Quedan $q min: cierre de ronda"
    $null = Correr ("Quedan $q minutos de la ronda $R. CIERRA YA: termina o revierte lo que esté a medias, deja las pruebas en verde, commit, actualiza $bit con hecho / pendiente / riesgos / cómo probar, y escribe la línea RONDA COMPLETA aunque queden pendientes (quedan listados para la siguiente ronda).`n`n$reglas")
    break
  }
  $ok = Correr ("Continúa como $T en la ronda $R. Son las $(Get-Date -Format 'HH:mm') y quedan $q minutos. Relee $bit y 'git log --oneline -15' para ubicarte y sigue con el siguiente entregable pendiente de $promptRel. Si ya cumpliste todo, verifica los criterios de aceptación uno por uno y escribe RONDA COMPLETA; si sobra tiempo después de eso, toma tareas de docs/BACKLOG_EXTRA.md de tu área.`n`n$reglas")
  if ($ok) { $err = 0 } else {
    $err++; if ($err -lt 4) { $espera = 120 } else { $espera = 600 }
    Log "La llamada fallo (intento $err). Posible limite de uso o red. Reintento en $($espera/60) min"
    Start-Sleep -Seconds $espera
  }
}

# 2) Red de seguridad
if (git status --porcelain) { git add -A; git commit -qm "[$T] cierre automatico de $R (cambios sin commit al terminar)"; Log "Commit de seguridad hecho" }
if (Completa) { Log "RONDA COMPLETA" } else { Log "Ronda terminada por tiempo o STOP sin marca de completa (ver $bit)" }
Set-Content -Path $done -Value (Get-Date -Format o)
