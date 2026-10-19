# R4 · T2 Participante · 4 h autónomas · Cambios del acta del 16-oct y ajustes finales

Lee CLAUDE.md, docs, **`docs/ACTA_2026-10-16.md` completo (manda sobre la SPEC donde choquen)**, `docs/bitacora/S_R3.md` y las bitácoras `R3_T*.md` de las 4 terminales. Empieza por cualquier falla de pruebas atribuible a tu área. T1 publica los campos nuevos del contrato en su primera hora; mientras tanto trabaja con los mocks.

## Prioridad 1 · Cambios del acta en el celular
1. **Tabla de resultados (A3, P2)** en `web/participante/pantallas/Resultado.tsx`: quita las filas Eje X (Time to Market), Eje Y y el número de calificaciones o votos. Quedan los 6 criterios y **una fila «Total»** con el campo `total` del servidor (nunca lo calcules). 2 decimales, igual que el tablero.
2. **Rondas (A7, P3):** ronda 1 = individual y en silencio, con la hoja del perfil; ronda 2 = discusión en la mesa. Ajusta los textos de cada pantalla con la voz Estratek. Ronda 1 en **verde** y ronda 2 en **rojo** en la matriz del celular, las insignias y la tabla R1/R2, siempre con el texto «R1»/«R2» (sin depender del color). T2 es dueña del sistema de diseño: define en la primera hora los tokens `--hz-r1` (verde) y `--hz-r2` (rojo) en `web/shared/ui/` con contraste AA sobre fondo claro, haz commit y anótalos en `docs/DECISIONES.md` para T3 y T4.
3. **Resultados de la sala por defecto (A2):** tras votar, el participante ve el consolidado de la sala. Aviso de mínimo: «Hace falta al menos 3 votos para mostrar estos resultados» (P6).
4. **Aviso de datos por país (P4):** el texto del consentimiento menciona la ley del país de la sala (Colombia: Ley 1581 de 2012; Perú: Ley 29733; Guatemala: política de Estratek), versión `hz-1.1`. Deja el texto en `docs/CONSENTIMIENTO.md` marcado «Pendiente de revisión de Paola». Fechas y horas en la zona de la sala.

## Prioridad 2 · Pendientes de R3
5. Textos con voz Estratek en todas las pantallas (cero rayas), objetivos táctiles de 44 px, lector de pantalla y foco visible.
6. Recorrido e2e con 3 perfiles móviles (Chrome Android, Safari iOS con WebKit, Samsung Internet) **en local**, con la API real en memoria.
7. TRIAGE abierto de T2.

## Límites
- Nada contra staging ni producción. Sin respuestas individuales ni nombres en ninguna pantalla.

Aceptación: los 4 puntos del acta funcionando contra la API real en local, 360 px sin desborde, `tools/test.sh` en verde, cero hallazgos abiertos de T2, bitácora al día.
