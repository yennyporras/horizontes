# R2 · T1 Backend · 4 h autónomas · Integración real y carga

Lee CLAUDE.md, docs, `docs/bitacora/S_R1.md` y las bitácoras `R1_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Si `tools/test.sh` está en rojo en main: arréglalo primero (aunque el fallo sea de integración).
2. Cierra pendientes de R1 del contrato completo, incluida la gestión de administradores y el cambio de clave obligatorio.
3. **Simulador de taller** `tools/simulador`: crea una sala, 4 mesas, inscribe 40 participantes con consentimiento, vota 2 rondas con distribuciones realistas, abre y cierra rondas como admin, mide latencias. Modo `--golden` que reproduce la prueba sintética y compara con `tests/golden`.
4. Rendimiento: p95 < 500 ms con 40 clientes haciendo polling cada 2,5 s; caché de agregados por `(sala, version, alcance, mesa)` si hace falta.
5. E2E de la máquina de estados, precierre con resultado preliminar, cierre programado de ronda y de sala, apertura automática de hojas en R2, permisos superadmin/admin.
6. Publica en la bitácora cómo correr el simulador contra local y contra staging.

Aceptación: simulador en verde contra local con 40 participantes; golden 100 %; p95 medido y anotado.
