# Bloqueos

Solo para lo que impide avanzar y no se resuelve decidiendo: credenciales, acceso al repo del IRMI, panel de Hostinger o DNS, o un cambio de contrato que rompa a otra terminal. Después de anotar, sigue con otra tarea.

Formato: `- AAAA-MM-DD HH:MM [T#] qué falta — qué se necesita y de quién — qué se hizo mientras tanto`

- 2026-10-16 05:27 [T4] Ubicación del VPS de Hostinger (país) para el aviso de privacidad — Paola confirma; si está fuera de Colombia hay que agregar el párrafo de transferencia internacional (versión `hz-1.1`) — se dejó `hz-1.0` sin ese párrafo en `docs/CONSENTIMIENTO.md`.
- 2026-10-16 05:27 [T4] Acceso a Coolify y DNS de Hostinger para crear `staging-horizontes` y `horizontes` — Paola — `docs/DESPLIEGUE.md` deja los pasos listos.
- 2026-10-16 07:05 [T4] El repo de Horizontes no tiene remoto en GitHub (`git remote -v` vacío), así que Coolify no tiene de dónde construir — Paola: crear el repo privado, conectarlo a la GitHub App `coolify-estratek`, crear la app `horizontes-staging` (ver `deploy/README.md`), el registro DNS `staging-horizontes` y llenar `deploy/.env.deploy` (URL de Coolify, token de API, UUID de la app) — se dejó listo `deploy/Dockerfile` (verificado con `deploy/desplegar.sh verificar`) y el pipeline `deploy/desplegar.sh staging`.
