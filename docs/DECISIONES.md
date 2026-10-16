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
- 2026-10-16 [T1] Dependencia `qrcode` (+ `@types/qrcode`) para `GET /api/admin/mesas/{id}/qr.svg` — generar QR a mano no vale el riesgo; commit aparte solo con package.json/lock.
- 2026-10-16 [T1] BD: además del modelo, tabla `sesiones_admin` (token con hash, 12 h) y columna `salas.token_tablero` en claro junto al hash — el admin necesita volver a mostrar el enlace del tablero y el token no es dato personal. Fechas en UTC ISO en BD; la API responde en `-05:00` (Bogotá).
- 2026-10-16 [T1] CONTRATO: `GET /api/admin/salas/{id}` agrega `sala.token_tablero`, `sala.url_tablero`, `sala.plantilla`, `progreso` (sala) y `perfiles` (catálogo); `mesas[]` agrega `numero`. `POST /api/admin/salas` responde el mismo `sala` + `mesas`. `GET /api/admin/yo` y login agregan `debe_cambiar_clave`. `GET /api/yo` agrega `participante.activo` y `hojas[].perfil` (nombre). Todo opcional para los clientes.
- 2026-10-16 [T1] CONTRATO: `/api/tablero/{salaId}` acepta id (`s_xxxx`) o código de sala (`HZ7K2`); `mesa=` acepta id o código de mesa. Con cookie de admin no exige `t`. `url_tablero` usa el id de sala. Sin `t` válido → 401 `TOKEN_TABLERO_INVALIDO`.
- 2026-10-16 [T1] ETag: `version` = `v-{n}` más sufijo por vista (`-sala`, `-{mesaId}`, `-{participanteId}`, `-r{ronda}`) para que un cliente que cambia de alcance no reciba un 304 equivocado.
- 2026-10-16 [T1] Máquina de estados: `abrir_ronda_1` se permite desde `preparada` o `inscripcion`; `reabrir_ronda` vuelve de `rN_cerrada` a `rN_abierta`; `reiniciar_ronda` (body opcional `ronda`) borra los votos de esa ronda sin cambiar el estado; `reabrir_sala` vuelve a la última ronda cerrada (o a `inscripcion` si no hubo rondas). Cerrar una ronda consume `cierre_programado_ronda_at`; un programado de ronda que vence sin ronda abierta se descarta (evento `cierre_programado_descartado`) para no cerrar de golpe la siguiente ronda.
- 2026-10-16 [T1] Resultados del participante: con `vista_participante = en_vivo` se ven después de completar los 2 proyectos (SPEC §2.6), con `preliminar: true`. En R2 la respuesta trae rondas 1 y 2 (comparación). `/api/yo.resultados` usa la ronda actual; si no está visible, `null`.
- 2026-10-16 [T1] Inscripción con correo ya inscrito: responde 409 `CORREO_YA_INSCRITO` con `{error, token, participante}`, conserva su mesa y perfil, invalida el token anterior y registra un nuevo consentimiento. Funciona incluso con la inscripción cerrada (recuperar sesión), salvo que no exista. Sala sin inscripción abierta → 409 `INSCRIPCION_CERRADA`.
- 2026-10-16 [T1] Admins: el superadmin del `.env` se crea con `debe_cambiar_clave = false` (Paola elige esa clave); los admins creados por API nacen con `true` y, hasta cambiarla, todo `/api/admin/*` salvo `yo`, `cambiar-clave` y `logout` responde 403 `CAMBIO_CLAVE_REQUERIDO`. `restablecer_clave: true` genera y devuelve `clave_temporal`; también acepta un texto como clave temporal. Clave mínima 8 caracteres, hash scrypt.
- 2026-10-16 [T1] Export CSV: UTF-8 con BOM y separador `;` (Excel en configuración regional de Colombia). `votos.csv` usa `id_hash` = sha256(sala:participante) truncado a 12.
- 2026-10-16 [T1] Cookie `hz_admin` con `Secure` solo si la petición llega por HTTPS (`X-Forwarded-Proto` con `trustProxy`), para que funcione en desarrollo local.
- 2026-10-16 [T1] CONTRATO: nuevo `GET /api/admin/salas/{id}/eventos?limite=50&antes={id}` → `{eventos:[{id,at,tipo,detalle,por}], siguiente}` (más reciente primero; `siguiente` es el cursor o null). El detalle de sala sigue trayendo los últimos 100.
- 2026-10-16 [T1] CONTRATO: 429 `DEMASIADAS_PETICIONES` por IP en `POST /api/inscripcion` (120/min), `PUT /api/votos` (600/min) y `POST /api/admin/login` (20/min). Topes holgados porque los celulares del taller comparten la IP del Wi-Fi.
- 2026-10-16 [T1] Respaldo automático: al cerrar una sala (a mano o programado) se hace `VACUUM INTO` en `<carpeta de DB_PATH>/respaldos/` y se conservan los últimos 30. T4: el volumen de la BD debe montar la carpeta completa, no solo el archivo.
- 2026-10-16 [T1] Caché de tableros en memoria por `(sala, version, alcance, rondas, preliminar)`; se invalida sola porque `version` sube con cada escritura. Simulador: p95 en servidor ≈ 31 ms con 40 personas.
- 2026-10-16 [T3] La matriz es un módulo ES sin dependencias (`web/tablero/matriz/matriz.js`) que produce un string SVG en píxeles reales del contenedor (no un viewBox fijo escalado) — así la tipografía queda legible a 360 px y grande en proyector; se redibuja con ResizeObserver.
- 2026-10-16 [T3] Si las burbujas R1 y R2 de un vivo se superponen (movimiento corto), la flecha va de centro a centro, encima, en azul Estratek con contorno blanco; si están separadas, de borde a borde en el color del proyecto. Sin flecha si el movimiento es menor que la punta.
- 2026-10-16 [T3] Colores de vivos: INSUMEX `#E8590C` (naranja) y NUTRIWHAT `#00A3FF` (cielo de rúbricas); fijos gris azulado `#7D8FA9`. Fondos H1/H2/H3 en azules claros. R1 = relleno 22 % con contorno punteado; R2 = sólido.
- 2026-10-16 [T3] El mock de `GET /api/tablero` no trae `grafico.etiquetas_horizonte`; la matriz usa las posiciones de la semilla (H1 1,3/1,9; H2 4,3/4,0; H3 8,0/7,6) por defecto y respeta las del servidor si llegan.
- 2026-10-16 [T3] Etiquetas sin solape: colocador voraz con 8 posiciones y hasta 5 anillos; prioridad nombres de vivos, luego "R1", luego fijos. Ancho de texto estimado (0,68 em) para poder probar en Node sin DOM. Pruebas: `node --test web/tablero/matriz/matriz.test.js`.
- 2026-10-16 [T3] R1: traje el esqueleto con `git merge t1-backend` (solo commits de R0 de T1) porque `main` no lo tenía y `/tablero/:sala` vive ahí. No toqué archivos de T1.
- 2026-10-16 [T3] El tablero usa los tokens `--hz-*` de `docs/DISENO.md` con valores de respaldo locales en `web/tablero/tablero.css`, para no depender de que `web/shared/ui/tokens.css` (T2) esté en la rama.
- 2026-10-16 [T3] Proyector (≥ 1100 px): los 2 vivos van en una sola tabla comparada para que matriz, progreso y detalle quepan en 1920×1080 sin scroll. En móvil, un panel por proyecto.
- 2026-10-16 [T3] La mini distribución muestra la ronda en foco: R1 en vista Ronda 1, R2 en Ronda 2 y en Comparación (R1 si R2 aún no tiene votos).
- 2026-10-16 [T3] "Preliminar" se muestra si el servidor manda `preliminar: true` o si el alcance mostrado está en precierre con la ronda abierta. Con la ronda cerrada desaparece.
- 2026-10-16 [T3] Vista por defecto: ronda actual (preparada, inscripción y R1 → Ronda 1; R2 abierta → Ronda 2; R2 cerrada o sala cerrada → Comparación). La elección manual se reinicia cuando cambia el estado de la sala.
- 2026-10-16 [T3] Sin `?t=` el tablero no muestra el selector de alcance; usa `?mesa=` si viene (alcance mesa) o la sala. Con 401/403 muestra "Pide al facilitador el enlace completo con su token".
- 2026-10-16 [T3] Etiquetas de vivos en color oscuro AA (INSUMEX `#A63C06`, NUTRIWHAT `#00609A`); la burbuja conserva el color de marca. Matriz con `escalaTexto` 1,3 en proyector.
- 2026-10-16 [T3] `MatrizHorizontes` (embebible para T2): `import { MatrizHorizontes } from '../tablero'`; props `datos`, `vista` (1, 2 o 'comparacion'), `alto` o `llenar`, `escalaTexto`. Sin fetch interno.
- 2026-10-16 [T3] Vista "todas las mesas": `?vista=mesas` (solo con token), una matriz por mesa con inscritos; cada mesa hace polling cada 5 s (no 2,5 s) para no multiplicar la carga del servidor.
- 2026-10-16 [T3] Atajos del proyector: F pantalla completa (oculta controles; si el navegador no deja, igual oculta controles), 1, 2 y C cambian de vista. No actúan dentro de campos.
- 2026-10-16 [T3] Animación R1 a R2 solo al pasar a Comparación (incluye el cambio automático al cerrar R2), una vez, 1,2 s, sin animación con `prefers-reduced-motion`.
- 2026-10-16 [T3] Verifiqué contra la API real de T1 con una copia desacoplada (`git worktree add --detach ../hz-t3-api t1-backend`), sin escribir en su rama.
