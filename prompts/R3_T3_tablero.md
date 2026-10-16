# R3 adelantada · T3 Tablero

## Reglas de esta R3 adelantada
- Arrancas apenas terminas tu R2, sin esperar a las otras terminales ni a staging (todavía no existe). Todo lo que diga "staging" hazlo contra la imagen de producción local o tu servidor de desarrollo en TU puerto: T1 4101, T2 4102, T3 4103, T4 3999 (`tools/deploy.sh local`). Nunca uses el puerto de otra terminal.
- Cada 30 min: `git log main --oneline -3`. Si aparece "[sync] integracion tras R2", haz `git merge main` y corre `tools/test.sh` antes de seguir.
- Cada 30 min lee el triage de T4 con `git show t4-admin:docs/TRIAGE.md` y corrige lo asignado a ti primero.
- Solo esperas a otra terminal si el triage o un fallo de pruebas depende de su código: en ese caso anótalo en tu bitácora y sigue con la siguiente tarea.
## Entregables en orden
1. Hallazgos de T3 en el triage.
2. Legibilidad a 6 m y en proyector de 1280×720; nombres de los proyectos fijos sin solaparse.
3. Animación suave R1 → R2 al cerrar la ronda 2, sin afectar el rendimiento.
4. (adelanto de R4) Capturas de referencia de cada vista (R1, R2, comparación, preliminar, todas las mesas, proyector) en `docs/capturas/` para la guía del facilitador.
Aceptación: pruebas visuales en verde en 1920, 1366, 1280 y 360 px; cero hallazgos abiertos de T3.
