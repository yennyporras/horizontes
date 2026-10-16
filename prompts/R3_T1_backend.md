# R3 adelantada · T1 Backend

## Reglas de esta R3 adelantada
- Arrancas apenas terminas tu R2, sin esperar a las otras terminales ni a staging (todavía no existe). Todo lo que diga "staging" hazlo contra la imagen de producción local o tu servidor de desarrollo en TU puerto: T1 4101, T2 4102, T3 4103, T4 3999 (`tools/deploy.sh local`). Nunca uses el puerto de otra terminal.
- Cada 30 min: `git log main --oneline -3`. Si aparece "[sync] integracion tras R2", haz `git merge main` y corre `tools/test.sh` antes de seguir.
- Cada 30 min lee el triage de T4 con `git show t4-admin:docs/TRIAGE.md` y corrige lo asignado a ti primero.
- Solo esperas a otra terminal si el triage o un fallo de pruebas depende de su código: en ese caso anótalo en tu bitácora y sigue con la siguiente tarea.
## Entregables en orden
1. Hallazgos de T1 en el triage y cualquier rojo de `tools/test.sh`.
2. Ensayo completo automático con el servidor en proceso o en el puerto 4101: 4 mesas, 40 participantes, 2 rondas, cambio de alcance y de vista en vivo, cierre programado real a 10 min, precierre por mesa. Informe en `docs/ENSAYO.md`. Modo `--golden` idéntico a `tests/golden`.
3. Casos borde: inscripción tardía en R2, participante desactivado, doble pestaña, reloj del cliente desfasado, reinicio de ronda.
4. (adelanto de R4) Rate limit en inscripción y votos, validación estricta de entradas, cabeceras de seguridad, cero datos personales en logs.
5. (adelanto de R4) Respaldo de la BD antes y después de cada sala, y script de reinicio limpio de la sala del taller.
Aceptación: ensayo sin errores 5xx y golden al 100 %; todo en `tools/test.sh`.
