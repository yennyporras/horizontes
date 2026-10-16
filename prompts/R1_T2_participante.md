# R1 · T2 Participante · 4 h autónomas · rama `t2-participante`

Lee `CLAUDE.md`, docs, `docs/DISENO.md` y bitácoras R0. Trabaja contra mocks (`USE_MOCKS=1`) con el cliente de `web/shared/api/`; cambia a la API real cuando T1 la publique en `main`, sin tocar tu código salvo la config.

## Pantallas (docs/SPEC.md §2), en orden
1. `/m/:codigo` → carga mesa; error claro si no existe o la inscripción está cerrada.
2. **Inscripción**: nombre, correo (validación), componente de consentimiento del IRMI con la política de datos de Estratek según `docs/CONSENTIMIENTO.md` (casilla sin marcar, botón desactivado hasta aceptar). Correo repetido → recupera la sesión.
3. **Bienvenida** con el perfil asignado y qué significa.
4. **Lectura** con pestañas "Caso" (descripción, situación, tabla de 10 proyectos como tarjetas en móvil) y "Tu hoja" (INSUMEX y NUTRIWHAT de su perfil; en ronda 2 o si `revelar_hojas`, las 6 hojas con su perfil destacado).
5. **Espera** si no hay ronda abierta, con polling de `GET /api/yo` cada 2,5 s y 304.
6. **Votación**: selector de proyecto con estado (pendiente / completo), 6 preguntas, cada una con su rúbrica en tarjetas 9-7-5-3-1, progreso 1/6...6/6, guardar, editar mientras siga abierta.
7. **Voto registrado** con progreso de la mesa, o **vista en vivo** (componente de matriz de T3 importado de `web/tablero/`; si aún no existe, placeholder con promedios) según config.
8. **Precierre**: aviso "Todos votaron" y resultado marcado como preliminar (sigue pudiendo editar). **Ronda cerrada** con resultado definitivo según alcance; comparación R1→R2 tras la ronda 2.
9. Persistencia del token, recuperación tras recarga o sin señal, mensajes de error útiles.

Aceptación: recorrido completo en 360 px contra mocks y luego contra la API real; `/qa-my-app:verify` en verde si el plugin ya está inicializado.
