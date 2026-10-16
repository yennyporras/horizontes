# R3 · T1 Backend · 4 h autónomas · Ensayo automático y triage

Lee CLAUDE.md, docs, `docs/bitacora/S_R2.md` y las bitácoras `R2_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Corregir todo lo de `docs/TRIAGE.md` asignado a T1 (lo publica T4 en su rama durante la primera hora; léelo con `git show t4-admin:docs/TRIAGE.md` cada 30 min).
2. **Ensayo completo automático en staging** con el simulador: 4 mesas, 40 participantes, 2 rondas, cambio de alcance y de vista en vivo, cierre programado real a 10 min, precierre por mesa. Informe en `docs/ENSAYO.md`.
3. Casos borde: inscripción tardía en R2 (no rompe el precierre), participante desactivado, doble pestaña, reloj del cliente desfasado, reinicio de ronda.
4. Respaldo de la BD antes y después de cada sala (script) y logs de errores con rotación.

Aceptación: ensayo en staging sin errores 5xx y con resultados idénticos a golden en el modo `--golden`.
