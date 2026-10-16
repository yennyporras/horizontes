# Plan de ejecución · 2 días · 4 terminales autónomas

Cada bloque se lanza con un solo comando (`tools\lanzar.ps1` en Windows; `tools/lanzar.sh` en Mac/Linux). Las 4 terminales trabajan solas; al terminar las 4, `tools\sync.ps1` integra en main en orden T1 → T3 → T2 → T4, corre `tools/test.sh` y deja `docs/bitacora/S_R{n}.md`.

| Bloque | Comando | Duración | T1 Backend | T2 Participante | T3 Tablero | T4 Admin + Infra |
|---|---|---|---|---|---|---|
| Día 1 · A | `lanzar.ps1 -Rondas R0,R1` | ~1 h + 4 h | Stack del IRMI, esqueleto, motor + golden; luego BD, API completa, estados, precierre, cierres, roles | Diseño y componentes; luego todo el flujo del participante | Prototipo de la matriz; luego tablero completo | Consentimiento + despliegue documentados; luego panel completo y pipeline |
| Día 1 · B | `lanzar.ps1 -Rondas R2` | 4 h | Simulador 40 bots, rendimiento, e2e | API real, vista en vivo, resiliencia | API real, ETag, modo proyector | API real, staging arriba |
| Día 2 · C | `lanzar.ps1 -Rondas R3` | 4 h | Ensayo automático en staging, casos borde | Triage, textos Estratek, accesibilidad | Triage, legibilidad, animación | QA total, TRIAGE, redeploy |
| Día 2 · D | `lanzar.ps1 -Rondas R4` | 4 h | Endurecer, simulador en producción | Ajustes finales | Ajustes finales y capturas | Producción, sala real, guía, plan B, entrega |

Entre bloques no hay tareas manuales obligatorias: puedes lanzar el siguiente apenas la ventana de integración imprima su reporte. Opcional y recomendado: subir los `S_R{n}.md` y bitácoras al chat del proyecto para revisión.

## Control sin supervisión
- `tools\estado.ps1 -R R1`: estado de las 4 terminales, último commit, último log y bloqueos.
- Las 4 ventanas de PowerShell muestran el avance en vivo (puedes minimizarlas; no las cierres).
- `tools\parar.ps1`: parada controlada de todo (commit de seguridad incluido).
- Cada ronda tiene tope de tiempo, reanudación automática, reintentos ante límites de uso y commit de seguridad al final.

## Plan B (listo desde R4)
`Plantilla_Horizontes_Shot_Nutresa.xlsx` con INSUMEX y NUTRIWHAT listos para digitar promedios, y un formulario de respaldo (ver `docs/PLAN_B.md`).
