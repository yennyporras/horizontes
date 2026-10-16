# Decisiones

Formato para nuevas entradas: `- AAAA-MM-DD [T#|Paola] decisión — razón`. Prefijo `CONTRATO:` si toca la API.

## Confirmadas por Paola (16-oct-2026)
- Plazo total: 2 días. 4 sesiones de Claude Code en simultáneo. Rondas autónomas de ~4 h.
- Se pide nombre y correo, solo con fines informativos. Se reutiliza la página de consentimiento del IRMI (texto legal: política de Estratek, ver abajo).
- El admin decide si cada mesa ve su propio resultado o el de toda la sala (`alcance_resultados`).
- Las salas se cierran por el admin o de forma programada (`cierre_programado_sala_at`).
- Las rondas las abre y cierra el admin.
- Tras votar: pantalla "Voto registrado" hasta que el admin cierre, o vista en vivo si el admin la activa (`vista_participante`).
- Precierre automático: si todos los inscritos activos ya votaron, se muestra el precierre.
- Todo ocurre en la app, incluidas las hojas de información por perfil (no hay papel).
- Todos los supuestos de la planeación quedan aceptados (ver abajo).
- Desarrollo en Claude Code; el chat del proyecto queda para orquestación, revisión de bitácoras y prompts de cada ronda.

## Supuestos aceptados (vigentes)
- Fecha límite = taller de Jorge. Taller de Nicolai la semana siguiente con la misma versión.
- Stack = el del IRMI; servidor cloud de Hostinger. Subdominio `horizontes.estratek.com.co`.
- Pesos canónicos del Excel Shot Nutresa: T2M 30/35/35; eje X 60/40; eje Y 70/30.
- Escala solo impar: 1, 3, 5, 7, 9. Las 6 preguntas son obligatorias.
- Proyectos fijos: los 8 del JSON del motor, con el mapeo Proyecto 7-10 = SUMSNACK, YUMMI, DEHIDRA, NUTREPET.
- TAM de los vivos fijo: INSUMEX 5, NUTRIWHAT 6 (filas del Excel). Fórmula TAM normalizada queda para v2.
- Nombre del eje Y: "VALUE GENERATION CAPACITY (Core business alignment)", editable desde la semilla.
- Gráfica: curvas H1/H2 de fondo, sin clasificación automática de horizonte.
- Contenido del caso: documento 2026 tal cual (Colombia), con los 6 perfiles (Producción incluido).
- Rúbrica de inversión nivel 1: "10m < Inversión < 50m" (PDF y Keynote).
- Sin resultados individuales en pantallas; sin PDF; sin envío de correos en v1.

## Confirmadas por Paola (16-oct-2026, segunda tanda)
- Perfil asignado automáticamente y balanceado por mesa; el admin lo puede editar.
- Administradores: los crea solo Paola (superadmin) desde un dashboard de gestión de admins. Los participantes nunca pueden ser admin.
- En la ronda 2 se abren las 6 hojas para todos (automático al abrir R2; el admin puede cambiarlo).
- El precierre solo avisa y muestra el resultado (preliminar), sin cerrar la ronda. Se elimina el cierre automático por precierre.
- Autorización de datos con la Política de Tratamiento de Datos Personales de Estratek (se reutiliza solo el componente de consentimiento del IRMI).

## Supuestos de ejecución vigentes
- Rondas de votación: exactamente 2.
- Un correo = una inscripción por sala; si la persona vuelve a entrar con el mismo correo, recupera su sesión.

## Registro de las terminales
- 2026-10-16 [T4] Consentimiento: se reutiliza `consentimiento.ts` + bloque de UI del IRMI (solo la casilla obligatoria, sin la casilla comercial). Texto `hz-1.0` en `docs/CONSENTIMIENTO.md`, basado en el aviso v1.1 aprobado por jurídica — finalidad solo informativa del taller.
- 2026-10-16 [T4] Despliegue igual al IRMI: Coolify en el VPS de Hostinger, Dockerfile en la raíz, 1 réplica, `TZ=America/Bogota`; cierres programados con chequeo perezoso + `setInterval` 15 s en el proceso (sin cron) — es lo que cumple ± 15 s.
- 2026-10-16 [T4] El panel admin vive en `web/admin/` como parte de la SPA única de T1 (entrada `PaginaAdmin.tsx`, rutas relativas bajo `/admin/*`). Se borró el `package.json` propio de R0. Se hizo `git merge t1-backend` porque `main` aún no tiene el esqueleto (igual que T3).
- 2026-10-16 [T4] Modo simulado del admin: servidor en memoria del navegador (`web/admin/mock/servidor.ts`) que se activa con `/admin?mock=1` (se recuerda; `?mock=0` lo apaga) o `VITE_ADMIN_MOCK=1`. Por defecto el panel habla con la API real. Usuarios de prueba paola/jorge, clave demo1234. Simula votos para poder ver el precierre.
- 2026-10-16 [T4] El panel acepta `GET /api/admin/salas` y `GET /api/admin/admins` como arreglo o envueltos (`{salas:[...]}`, `{admins:[...]}`), porque el contrato dice solo "Lista" y los mocks del servidor los envuelven.
- 2026-10-16 [T4] CONTRATO: `PATCH /api/admin/admins/{id}` con `restablecer_clave` como **string** (la clave temporal nueva, generada en el panel igual que `clave_temporal` al crear). Si el servidor prefiere generarla, puede aceptar `true` y devolver `clave_temporal` en la respuesta: el panel muestra esa si viene.
- 2026-10-16 [T4] CONTRATO: campo opcional `sala.url_tablero` en `GET /api/admin/salas/{id}` (tablero de toda la sala con su token). Si no viene, el panel lo deriva del `url_tablero` de una mesa quitando `mesa=`.
- 2026-10-16 [T4] Resultado preliminar en el panel: se lee `GET /api/tablero/{salaId}?alcance=...&t=` con el token que trae `url_tablero` de la mesa. Muestra eje X y eje Y de los vivos en la ronda abierta y enlaza a la matriz de T3.
- 2026-10-16 [T4] Cierres programados: el panel usa `datetime-local` leído como hora Bogotá y envía ISO con `-05:00` (Bogotá no tiene horario de verano). No deja programar una hora pasada.
- 2026-10-16 [T4] Botones de acción: se muestran siempre los 9 en orden del ciclo; los que no aplican al estado quedan deshabilitados. Reiniciar votos y cerrar sala piden confirmación con `<dialog>` nativo.
- 2026-10-16 [T4] Monitor `/admin/salud` (backlog): muestra lo que devuelva `GET /api/health` y la latencia p95 medida por el navegador. Sugerencia a T1 (no rompe nada): agregar `version` (valor de `SOURCE_COMMIT`, que Coolify ya pasa a la imagen) a `/api/health`.
