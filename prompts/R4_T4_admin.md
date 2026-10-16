# R4 · T4 Admin + Infra · 4 h autónomas · Producción y entrega

Lee CLAUDE.md, docs, `docs/bitacora/S_R3.md` y las bitácoras `R3_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

1. Desplegar a `horizontes.estratek.com.co` con `tools/deploy.sh produccion`; HTTPS, cron de cierres, respaldo.
2. Crear la sala real del taller (mesas según DECISIONES), generar la hoja de QR en PDF.
3. `docs/GUIA_FACILITADOR.md` (1 página, voz Estratek): antes, durante (rondas, alcance, en vivo, precierre, cierre programado), después (export), qué hacer si falla.
4. **Plan B**: `docs/PLAN_B.md` con la plantilla Excel Shot Nutresa lista para digitar promedios y un formulario de respaldo.
5. QA final en producción y `docs/ENTREGA.md` con URLs, accesos (sin claves) y estado.

Aceptación: producción operativa, sala real creada, guía, plan B y entrega escritos.
