# R3 adelantada · T4 Admin + Infra

## Reglas de esta R3 adelantada
- Arrancas apenas terminas tu R2, sin esperar a las otras terminales ni a staging (todavía no existe). Todo lo que diga "staging" hazlo contra la imagen de producción local o tu servidor de desarrollo en TU puerto: T1 4101, T2 4102, T3 4103, T4 3999 (`tools/deploy.sh local`). Nunca uses el puerto de otra terminal.
- Cada 30 min: `git log main --oneline -3`. Si aparece "[sync] integracion tras R2", haz `git merge main` y corre `tools/test.sh` antes de seguir.
- Cada 30 min lee el triage de T4 con `git show t4-admin:docs/TRIAGE.md` y corrige lo asignado a ti primero.
- Solo esperas a otra terminal si el triage o un fallo de pruebas depende de su código: en ese caso anótalo en tu bitácora y sigue con la siguiente tarea.
## Entregables en orden
1. QA total sobre el sistema integrado, en local: crea en tu carpeta una rama temporal `qa-integrada` desde `t4-admin`, haz merge de las puntas actuales de `t1-backend`, `t3-tablero` y `t2-participante` (si hay conflicto: `git merge --abort` y prueba solo sobre `t4-admin`), levanta `tools/deploy.sh local` y recorre todas las pantallas en móvil y escritorio, con el simulador de T1 de fondo. **Nunca hagas push ni sync de `qa-integrada`**. Vuelve a `t4-admin` para todo commit.
2. `docs/TRIAGE.md` en `t4-admin`: severidad, pantalla, pasos, terminal dueña y estado. Commit cada vez que lo actualices; repite el QA cada 60 min con las puntas nuevas.
3. Corrige lo asignado a T4.
4. (adelanto de R4) `docs/GUIA_FACILITADOR.md` (1 página, voz Estratek), `docs/PLAN_B.md` (Excel Shot Nutresa + formulario de respaldo), hoja de QR en A4 y borrador de `docs/ENTREGA.md`.
5. Deja `tools/deploy.sh staging` y `produccion` listos para el primer comando de Paola; no esperes credenciales.
Aceptación: TRIAGE al día, guía y plan B escritos, y la rama `t4-admin` activa al terminar (nunca `qa-integrada`).
