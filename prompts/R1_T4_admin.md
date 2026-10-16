# R1 · T4 Admin + Infra · 4 h autónomas · rama `t4-admin`

Lee `CLAUDE.md`, docs, `docs/DISENO.md`, `docs/DESPLIEGUE.md` y bitácoras R0. Contra mocks; cambia a la API real cuando esté en `main`.

## Entregables
1. **Salas**: lista y "Crear sala" (nombre, plantilla Foodsume, número de mesas).
2. **Sala en vivo** (polling 2,5 s): estado y ronda, botones de acción según la máquina de estados (deshabilitar los inválidos, confirmación en reiniciar y cerrar sala), banner de precierre por mesa y sala con vista del resultado preliminar (la ronda sigue abierta hasta que el admin cierre), contador hacia cierres programados, enlaces al tablero de sala y de cada mesa.
3. **Configuración**: alcance (mesa o sala), vista participante (registrado o en vivo), revelar hojas, cierre programado de ronda y de sala (fecha y hora Bogotá).
4. **Mesas y QR**: códigos, URLs, QR SVG, botón "Proyectar QR" a pantalla completa y hoja imprimible.
5. **Participantes**: por mesa, con perfil y completo/no de la ronda; reasignar perfil o mesa; desactivar. Nunca mostrar respuestas.
6. **Export** CSV de inscritos y votos.
7. **Administradores** (solo superadmin): crear admin con clave temporal, desactivar, restablecer clave; el admin normal no ve la sección. Pantalla de cambio de clave obligatorio en el primer ingreso.
8. **Infra**: pipeline de build y despliegue a `staging-horizontes.estratek.com.co` siguiendo `docs/DESPLIEGUE.md`; si faltan credenciales, deja todo listo y anótalo en BLOQUEOS.

Aceptación: un admin recorre en el panel todo el ciclo de una sala contra la API real (o mocks si aún no está), y staging queda arriba o listo para subir con un comando.
