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
- 2026-10-16 [T2] El participante usa tema claro (fondo blanco, tinta `#0F2340`, acción `#1C4587`), no el tema oscuro del IRMI: la identidad de Horizontes en CLAUDE.md pide azules claros como el deck y el celular se usa con luz de salón.
- 2026-10-16 [T2] Firma visual única: arco de horizonte (cuarto de círculo con radio proporcional al valor 1 a 9) en cada opción de la rúbrica, coherente con las curvas H1/H2 de la matriz. Todo lo demás sobrio.
- 2026-10-16 [T2] Textos de la app en tuteo (como el IRMI, D-113). Sin rayas.
- 2026-10-16 [T2] Componentes base en React + TypeScript sin dependencias de UI externas (mismo stack del IRMI). Si R0-T1 fija otro framework, se portan; los tokens CSS no cambian.
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
- 2026-10-16 [T2] El participante usa su propio transporte (`web/participante/api.ts`), con la misma forma de errores que `web/shared/api/cliente.ts` (de uso opcional según T1): guarda el token por mesa (`hz_token:{CODIGO}`) en vez de una llave global, para que un mismo celular pueda estar en dos salas de ensayo sin pisarse. Los tipos se alinean al contrato; si T1 lo pide, se cambia el import sin tocar pantallas.
- 2026-10-16 [T2] Navegación interna por estado (no subrutas): la pantalla en curso (`inicio`, `lectura`, `elegir`, `calificar:{proyecto}`) vive en sessionStorage, así que recargar devuelve al mismo punto; lo marcado sin guardar vive en sessionStorage por proyecto y ronda.
- 2026-10-16 [T2] Tras guardar un voto se aplica en local la respuesta del PUT y se fuerza un GET /api/yo; si la versión no cambió (mocks) se conserva lo local.
- 2026-10-16 [T2] Con la inscripción cerrada (sala ya en curso o terminada) se ofrece "Ya me inscribí: recuperar mi sesión", que usa el mismo POST /api/inscripcion (409 CORREO_YA_INSCRITO recupera; 409 INSCRIPCION_CERRADA = correo no inscrito). Sin consentimiento tampoco se recupera, porque el servidor registra uno nuevo.
- 2026-10-16 [T2] Resultado en el celular, provisional hasta integrar la matriz de T3: posición (eje X, eje Y) y promedio por criterio en R1 y R2, tal como los entrega el servidor (sin recalcular).
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
- 2026-10-16 [T2] R2: `playwright-core@1.64.1` como devDependency (commit aparte). Usa el Chromium headless 1248 ya instalado (misma revisión); `PW_EXE` permite otro ejecutable. Sin Chromium, el recorrido se omite con aviso (no pone la suite en rojo en una máquina sin navegador).
- 2026-10-16 [T2] El recorrido e2e del participante corre dentro de Vitest (`web/participante/e2e/recorrido.test.ts`), así entra en `tools/test.sh` sin tocar archivos de T1: API real en proceso con BD en memoria, build de producción en carpeta temporal servido por un estático mínimo que reenvía `/api`, y Chromium a 360 px. Se descartó el servidor de desarrollo de Vite: su CPU hacía fallar por tiempo pruebas jsdom de otras áreas en la compuerta.
- 2026-10-16 [T2] Sin señal al guardar un voto: va a una cola en el celular (`localStorage hz_cola:{CODIGO}`), se marca "Por enviar" y se reenvía sola cada 4 s y al evento `online`. Si el servidor la rechaza (ronda cerrada), lo marcado vuelve al borrador y se avisa. Reemplaza el botón manual "Reintentar guardado" de R1.
- 2026-10-16 [T2] Recuperar sesión con token vencido o reemplazado: nombre y correo se guardan solo en el celular (`hz_datos:{CODIGO}`) para rellenar el formulario; se conserva pantalla, borradores y cola. Se vuelve a pedir la casilla de consentimiento porque el servidor registra uno nuevo.
- 2026-10-16 [T2] Matriz en el celular: `MatrizHorizontes` de T3 con vista 1 en la ronda 1 y `'comparacion'` cuando hay votos en las 2 rondas (2 si solo R2). Debajo sigue la tabla de promedios por criterio.
- 2026-10-16 [T2] Sin saltos de diseño: el esqueleto de carga espera a Montserrat (pesos 400 a 800) en paralelo con la primera llamada a la API, con tope de 1,5 s; si vence, el texto sale con "Montserrat Respaldo" (Arial o Roboto con `size-adjust` según el peso). CLS medido = 0.
- 2026-10-16 [T2] Rendimiento medido (build de producción, 360 px, CPU 4x, mediana de 5 hasta el título visible): Fast 4G de DevTools 1,7 s sin compresión y 1,46 s con gzip; perfil lento de Lighthouse (1,6 Mbps) 2,8 s sin compresión y 2,1 s con gzip. Pedido a T1 (servidor) o T4 (Traefik/Coolify): activar gzip o brotli y `Cache-Control: public, max-age=31536000, immutable` en `/assets/*` (hoy sale `max-age=0` y sin compresión: 319 KB de JS crudos). Opcional T1: `React.lazy` para `PaginaAdmin` y `PaginaTablero` en `web/App.tsx`.
- 2026-10-16 [T2] R2 tras revisión: cada petición del participante tiene tope de 10 s (`AbortController`); el corte cuenta como sin señal (cola y reintento). Cada voto en cola lleva `id` de versión y `participante_id`: un reenvío viejo no borra una edición nueva y la cola nunca se envía con el token de otra persona. Nombre y correo guardados en el celular solo rellenan "Recuperar mi sesión" y se borran al cerrar la sala.
- 2026-10-16 [T2] `tablero.css` (T3) define `.hz-cifra`, `.hz-insignia` y `.hz-progreso` globales y se carga en toda la SPA. En vez de renombrar clases del sistema de diseño, `componentes.css` las blinda dentro de `.hz` (raíz de las páginas del participante). Sugerencia a T3: darles alcance `.hz-tablero`.
