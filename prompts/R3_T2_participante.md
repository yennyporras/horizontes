# R3 adelantada · T2 Participante

## Reglas de esta R3 adelantada
- Arrancas apenas terminas tu R2, sin esperar a las otras terminales ni a staging (todavía no existe). Todo lo que diga "staging" hazlo contra la imagen de producción local o tu servidor de desarrollo en TU puerto: T1 4101, T2 4102, T3 4103, T4 3999 (`tools/deploy.sh local`). Nunca uses el puerto de otra terminal.
- Cada 30 min: `git log main --oneline -3`. Si aparece "[sync] integracion tras R2", haz `git merge main` y corre `tools/test.sh` antes de seguir.
- Cada 30 min lee el triage de T4 con `git show t4-admin:docs/TRIAGE.md` y corrige lo asignado a ti primero.
- Solo esperas a otra terminal si el triage o un fallo de pruebas depende de su código: en ese caso anótalo en tu bitácora y sigue con la siguiente tarea.
## Entregables en orden
1. Hallazgos de T2 en el triage.
2. Todos los textos con la skill voz-y-tono-estratek (cero rayas), incluidos errores y estados vacíos.
3. Accesibilidad: foco visible, lectura por pantalla de la rúbrica, objetivos táctiles de 44 px o más.
4. (adelanto de R4) Aviso de datos con la política real de Estratek: https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/
5. (adelanto de R4) Recorrido automatizado en 3 perfiles móviles emulados (Chrome Android, Safari iOS con WebKit, Samsung Internet por user agent) en `tools/test.sh`.
Aceptación: cero hallazgos abiertos de T2 y pruebas en verde.
