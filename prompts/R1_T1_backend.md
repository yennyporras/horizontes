# R1 · T1 Backend · 4 h autónomas · rama `t1-backend`

Lee `CLAUDE.md`, docs y las bitácoras `docs/bitacora/R0_*.md`. Trabaja sin pedir confirmación. Usa subagentes para pruebas.

## Entregables en orden
1. **BD y migraciones** según `docs/MODELO_DATOS.md`. Script `seed` que crea el superadmin desde `SUPERADMIN_USUARIO`/`SUPERADMIN_CLAVE` (idempotente) y la acción "crear sala desde plantilla `foodsume_2026`" (proyectos, hojas, contenido, token tablero).
2. **API participante** completa (`docs/CONTRATO_API.md`): mesa por código, inscripción con consentimiento (guardar versión, hash del texto, `politica_url`, IP, UA), asignación balanceada de perfil, `GET /api/yo`, `PUT /api/votos` (upsert, validación 1/3/5/7/9, 6 obligatorias), `GET /api/resultados` respetando `alcance_resultados` y `vista_participante`.
3. **Máquina de estados** de `docs/SPEC.md` §3 y `POST /api/admin/salas/{id}/acciones` con 409 en transiciones inválidas. Todo a `eventos`.
4. **Precierre** (§4) derivado por mesa y sala: solo avisa y libera el resultado preliminar (`preliminar: true`), nunca cierra. Al abrir R2, `revelar_hojas = true`. **Cierres programados** (§5): chequeo perezoso en cada petición + intervalo de 15 s.
5. **Tablero** `GET /api/tablero/{salaId}` con alcance sala o mesa, promedios, distribución, n_votos, t2m/x/y por ronda y progreso por mesa. ETag/`version` → 304.
6. **Admin**: login con hash, sesión por cookie, roles superadmin/admin, endpoints de gestión de admins solo para superadmin (403 al resto), cambio de clave obligatorio en primer ingreso, CRUD del contrato, PATCH config, reasignar participante, QR SVG, export CSV con BOM.
7. **Pruebas**: unitarias del motor (golden), integración de cada endpoint, y un e2e que reproduce la prueba sintética (20 personas, 2 rondas) por API y compara con golden.

## Reglas
- Merge a `main` al final, con todas las pruebas en verde. Si el contrato necesita algo nuevo: solo agregar campos opcionales y anotar `CONTRATO:` en DECISIONES.
- Respuestas fuera de `/api/admin/*` sin nombres ni correos.

Aceptación: el e2e sintético pasa; una sala nueva se recorre completa por API (inscripción → R1 → precierre → cierre → R2 → cierre → sala cerrada); cierre programado verificado con reloj simulado; un admin normal recibe 403 en `/api/admin/admins`; no existe forma de convertir un participante en admin.
