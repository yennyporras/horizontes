# R3 · T4 Admin + Infra · 4 h autónomas · QA total y triage

Lee CLAUDE.md, docs, `docs/bitacora/S_R2.md` y las bitácoras `R2_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Primera hora: QA completo sobre staging (`/qa-my-app:run-all` si existe; si no, recorrido propio de todas las pantallas en móvil y escritorio). Escribe `docs/TRIAGE.md` con cada hallazgo: severidad, pantalla, pasos, terminal dueña y estado. Haz commit en tu rama cada vez que lo actualices: las demás terminales lo leen con `git show t4-admin:docs/TRIAGE.md`.
2. Corregir lo asignado a T4.
3. Hoja imprimible de QR (A4) y botón "Proyectar QR".
4. Re-desplegar staging con lo integrado y volver a pasar QA al final.

Aceptación: TRIAGE con estado actualizado; staging con la última integración.
