# R4 · T3 Tablero · 4 h autónomas · Cambios del acta del 16-oct y ajustes finales

Lee CLAUDE.md, docs, **`docs/ACTA_2026-10-16.md` completo (manda sobre la SPEC donde choquen)**, `docs/bitacora/S_R3.md` y las bitácoras `R3_T*.md` de las 4 terminales. Empieza por cualquier falla de pruebas atribuible a tu área. T1 publica los campos nuevos del contrato en su primera hora; mientras tanto trabaja con los mocks.

## Prioridad 1 · Cambios del acta en el tablero
1. **Tabla (A3, P2):** en `web/tablero/TablaComparada.tsx` y `web/tablero/PanelProyecto.tsx` quita las filas T2M (Time to Market), Eje X, Eje Y y los encabezados o columnas de «Votos R{n}». Quedan los 6 criterios y **una fila «Total»** con el campo `total` del servidor (nunca recalcules). 2 decimales. Ajusta `tablero.css`.
2. **Colores por ronda (P3):** en la matriz (`web/tablero/matriz/`), la leyenda y las tablas, la **ronda 1 va en verde y la ronda 2 en rojo**, con los tokens `--hz-r1` y `--hz-r2` de T2 (si aún no existen, usa provisionales y anótalo). Forma distinta por ronda (fantasma hueco R1, burbuja sólida R2) y etiqueta «R1»/«R2» siempre visible. Los dos proyectos vivos se distinguen por su nombre, no por color. El verde de R1 no puede confundirse con el color de ningún proyecto fijo. Contraste AA medido en la prueba de navegador.
3. **Franja de fase:** «Ronda 1 · individual y en silencio» (verde) y «Ronda 2 · discusión en la mesa» (rojo), legible a 6 m en proyector.
4. **Mínimo de 3 votos (P6, TRIAGE #1 y #29):** con `bajo_minimo`, el texto «Hace falta al menos 3 votos para mostrar esta mesa» (hoy dice «Aún no hay votos en la ronda 1»).
5. Horas en la zona horaria de la sala (P4), si el tablero muestra alguna.

## Prioridad 2 · Pendientes
6. TRIAGE abierto de T3: #5, #6, #7, #9, #11 (en el tablero, un solo nombre por eje), #12, #13 (la leyenda ahora es por ronda) y #14 (ante 401 o 403 deja de consultar y dice «Pide al facilitador el enlace completo del tablero»). Actualiza su estado en `docs/TRIAGE.md`.
7. Capturas de referencia nuevas en `docs/capturas/` con los cambios del acta, para la guía del facilitador.

## Límites
- Nada contra staging ni producción: verificación en local con la API real en memoria.

Aceptación: tabla con «Total» y sin las 4 filas, R1 verde y R2 rojo legibles sin color, 1920 y 360 px verificados en navegador, `tools/test.sh` en verde, cero hallazgos abiertos de T3, capturas nuevas.
