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
