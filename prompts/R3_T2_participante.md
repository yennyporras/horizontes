# R3 · T2 Participante · 4 h autónomas · Triage y pulido

Lee CLAUDE.md, docs, `docs/bitacora/S_R2.md` y las bitácoras `R2_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Corregir lo asignado a T2 en el triage (`git show t4-admin:docs/TRIAGE.md`, revisar cada 30 min). Mientras llega, empieza por el punto 2.
2. Todos los textos con la skill voz-y-tono-estratek (cero rayas), incluidos errores y estados vacíos.
3. Accesibilidad: foco visible, lectura por pantalla de la rúbrica, tamaños táctiles ≥ 44 px.
4. Prueba en staging con el simulador de fondo: el recorrido humano sigue fluido.

Aceptación: `/qa-my-app:verify` (si existe) y pruebas en verde; cero hallazgos abiertos de T2 en TRIAGE.
