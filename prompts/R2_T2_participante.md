# R2 · T2 Participante · 4 h autónomas · API real y resiliencia

Lee CLAUDE.md, docs, `docs/bitacora/S_R1.md` y las bitácoras `R1_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Todo el flujo contra la API real (sin mocks): inscripción con consentimiento y política de Estratek, perfil asignado, caso y hojas (las 6 en R2, la propia destacada), votación de los 2 proyectos, edición mientras siga abierta.
2. Vista en vivo y resultados con el componente `MatrizHorizontes` de T3 (solo props). Precierre: aviso "Todos votaron" + resultado marcado como preliminar.
3. Resiliencia: pérdida de señal (reintento con cola), recarga, token vencido o correo repetido (recupera sesión), ronda cerrada mientras votaba (mensaje claro, sin perder lo escrito).
4. Polling con ETag/304 y backoff si la red falla.
5. Rendimiento móvil: carga inicial < 2 s en 4G simulada; sin saltos de diseño.
6. Pruebas automatizadas del recorrido (Playwright móvil 360 px) en `tools/test.sh`.

Aceptación: recorrido completo de 2 rondas en 360 px contra la API real, cubierto por pruebas.
