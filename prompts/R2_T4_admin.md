# R2 · T4 Admin + Infra · 4 h autónomas · API real y staging

Lee CLAUDE.md, docs, `docs/bitacora/S_R1.md` y las bitácoras `R1_T*.md` de las 4 terminales (están en main tras la integración; si falta alguna, `git log main` te orienta). Empieza por lo que tu bitácora anterior dejó pendiente y por cualquier falla de pruebas atribuible a tu área.

## Entregables en orden
1. Panel completo contra la API real: salas, sala en vivo, configuración, mesas y QR, participantes (reasignar perfil o mesa), export, gestión de administradores solo para superadmin, cambio de clave en primer ingreso.
2. Desplegar a `staging-horizontes.estratek.com.co` siguiendo `docs/DESPLIEGUE.md`: build, BD, `.env` del servidor, SSL, intervalo o cron para cierres programados. Script `tools/deploy.sh staging|produccion` idempotente.
3. Si el plugin qa-my-app está disponible: `/qa-my-app:init` sobre staging.
4. Correr el simulador de T1 contra staging (si ya existe) y anotar resultados.
5. Pruebas del panel en `tools/test.sh`.

Aceptación: staging arriba con HTTPS, una sala creada desde el panel y recorrida completa; si faltan credenciales, todo listo para un comando y el faltante en BLOQUEOS.
