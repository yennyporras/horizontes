# R1 · T3 Tablero · 4 h autónomas · rama `t3-tablero`

Lee `CLAUDE.md`, docs, `docs/DISENO.md` y bitácoras R0. Contra mocks; cambia a la API real cuando esté en `main`.

## Entregables
1. `/tablero/:sala?mesa=&t=` modo proyector 1920 px: matriz (componente de R0) + panel lateral.
2. Panel por proyecto vivo: por criterio, promedio R1 y R2 y mini distribución 1-3-5-7-9; `n_votos`; t2m, eje X y eje Y.
3. Vistas de ronda: R1, R2, Comparación (flecha R1→R2). Por defecto: la ronda actual; tras cerrar R2, Comparación.
4. Progreso: inscritos, completos, precierre por mesa con aviso visible ("Mesa 2: todos votaron"). En precierre el resultado se muestra con la etiqueta "Preliminar" hasta que el admin cierre.
5. Selector de alcance (sala o mesa X) visible solo con token de tablero; exporta un componente embebible `MatrizHorizontes` para que T2 lo use en la vista en vivo (solo props, sin fetch interno).
6. Polling 2,5 s con ETag; sin parpadeo al actualizar; estados vacíos ("Aún no hay votos en la ronda 1").
7. Legibilidad a 6 metros: tipografía grande, contraste AA, etiquetas de vivos sin solaparse con fijos.

Aceptación: contra el mock y contra datos de la prueba sintética el punto dibujado coincide con golden; probado en 1920, 1366 y 360 px.
