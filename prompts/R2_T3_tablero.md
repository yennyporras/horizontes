# R2 · T3 Tablero · 4 h autónomas · API real y modo proyector

Lee CLAUDE.md, docs, `docs/bitacora/S_R1.md` y las bitácoras `R1_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Tablero contra la API real con ETag/304, sin parpadeo; alcance sala o mesa con token de tablero.
2. Vistas R1, R2 y Comparación con flecha; etiqueta "Preliminar" en precierre; cambio automático a Comparación al cerrar R2.
3. Panel por criterio con promedios R1/R2 y distribución 1-3-5-7-9; progreso por mesa con avisos de precierre.
4. Modo proyector: pantalla completa (tecla F), tipografía legible a 6 m, contraste AA.
5. `MatrizHorizontes` estable y documentado para T2 (props, ejemplo).
6. Prueba que dibuja los puntos de la prueba sintética y verifica posiciones contra golden; prueba visual en 1920, 1366 y 360 px en `tools/test.sh`.

Aceptación: con el simulador de T1 corriendo, el tablero se actualiza en < 5 s y coincide con golden.
