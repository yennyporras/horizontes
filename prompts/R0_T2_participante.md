# R0 · T2 Participante · ~1 h · rama `t2-participante`

1. Lee `CLAUDE.md` y los docs. Lee las skills `frontend-design` y `voz-y-tono-estratek`.
2. Mientras T1 publica el esqueleto: escribe `docs/DISENO.md` con el sistema de diseño (tokens de color de marca, tipografía Montserrat, escala, espaciado, radios, estados de foco, componentes base: botón, campo, tarjeta de rúbrica seleccionable 9-7-5-3-1, pestañas, barra de progreso, aviso). Móvil primero 360 px.
3. Diseña en texto el flujo completo de pantallas del participante según `docs/SPEC.md` §2 (incluye estados vacíos, error, sin señal, ronda cerrada, precierre). Textos finales con voz Estratek, cero rayas.
4. Cuando `git log main --oneline | grep 'ESQUELETO LISTO'` devuelva algo (revísalo cada 10 min mientras haces lo anterior): `git rebase main` e implementa `web/shared/ui/` (tokens y componentes base) con una página de muestra `/m/_ui`.

Aceptación: `/m/_ui` muestra todos los componentes base en 360 px; `docs/DISENO.md` completo.
Si a los 45 min de ronda el esqueleto no ha llegado, deja la parte de código lista como módulo independiente y anótalo en tu bitácora: la R1 arranca con el esqueleto integrado.
