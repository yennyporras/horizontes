# R0 · T4 Admin + Infra · ~1 h · rama `t4-admin`

1. Lee `CLAUDE.md` y los docs. Lee `voz-y-tono-estratek`.
2. Localiza en el repo del IRMI la página de consentimiento y reutiliza su componente. El texto legal es la **Política de Tratamiento de Datos Personales de Estratek**: busca su URL en el IRMI o en el sitio de Estratek y déjala en `POLITICA_PRIVACIDAD_URL`; si no aparece, anótalo en `docs/BLOQUEOS.md` para Paola y sigue con un marcador. Documenta en `docs/CONSENTIMIENTO.md`: componente, texto corto de autorización (responsable Estratek, finalidad: fines informativos del taller, derechos del titular, enlace a la política), versión y qué se guarda.
3. Escribe `docs/DESPLIEGUE.md`: cómo se despliega el IRMI en Hostinger y cómo replicarlo para `staging-horizontes` y `horizontes` (build, variables `.env`, BD, SSL, cron o intervalo para cierres programados, respaldo).
4. Cuando `git log main --oneline | grep 'ESQUELETO LISTO'` devuelva algo (revísalo cada 10 min): `git rebase main` e implementa el login de admin y la estructura de `/admin` con navegación (Salas, Sala en vivo, Participantes, Configuración, Export y **Administradores**, visible solo para superadmin) contra mocks.

Aceptación: `docs/CONSENTIMIENTO.md` y `docs/DESPLIEGUE.md` completos; `/admin` navega contra mocks.
Si a los 45 min de ronda el esqueleto no ha llegado, deja la parte de código lista como módulo independiente y anótalo en tu bitácora: la R1 arranca con el esqueleto integrado.
