# Cambios del 19-oct · Contrato fijado antes de empezar

Pedido de Paola del 19-oct, después de la prueba en staging. Lo fija la integración para que servidor, celular, tablero, panel y diseño trabajen en paralelo sin esperarse. Todo campo nuevo es **opcional** (regla del contrato). Cada cambio se anota en `docs/DECISIONES.md` con fecha 2026-10-19 y prefijo `CONTRATO:` si toca la API.

## Pedidos y decisiones de Paola
| ID | Pedido | Decisión |
|---|---|---|
| C19-1 | Los QR de producción salen con la URL de staging | Es configuración: `BASE_URL` de cada app en Coolify. En código: el panel avisa si `BASE_URL` no coincide con el dominio desde el que se abre (ver S5 y A5). |
| C19-2 | A los administradores (rol admin) no les aparece el panel completo | La API no limita las salas por rol (verificado en staging). El panel debe mostrar a un admin todo lo de una sala igual que al superadmin, salvo «Administradores». Prueba de UI con rol admin en cada sección (A6). |
| C19-3 | Los participantes ven sus calificaciones y los resultados anónimos; los datos individuales solo los ven los administradores | El celular muestra **su propia calificación por criterio junto al promedio** anónimo de la mesa o la sala. El panel tiene una vista de **respuestas por persona**, solo admin (S3, P3, A3). |
| C19-4 | Apertura y cierre programados, por ronda y por sala | Para la sala (apertura = abrir inscripción; cierre = cerrar sala), la ronda 1 y la ronda 2: fecha y hora de apertura y de cierre, además de los botones manuales (S2, A2). |
| C19-5 | Una pregunta por pantalla, que pase sola o por decisión del admin | El celular muestra **una pregunta a la vez**. Modo de la sala: `automatico` (al responder pasa sola) o `guiado` (todos ven la pregunta que el admin elige y avanza desde el panel) (S4, P1, A4). |
| C19-6 | Zoom en la gráfica en pantalla completa | La matriz del tablero permite acercar y alejar (botones, rueda y pellizco) y volver a la vista completa (T1). |
| C19-7 | Descripción corta en la gráfica de dónde sale cada valor y por qué | Leyenda breve bajo la matriz y un «¿Cómo se calcula?» desplegable (T2). |
| C19-8 | Colores y tipografía de Estratek como el IRMI | Horizontes adopta el sistema visual del IRMI (`C:\REVISA\2026\IRMI\docs\diseno\DESIGN.md` y `sistema-visual.md`): lienzo oscuro, superficies grafito, teal `#47EBC2` y degradado de marca hacia `#1699DB`, Montserrat 500 a 900 (D1). |

## Servidor (S)
- **S1. Compatibilidad:** nada existente se rompe; los campos nuevos son opcionales.
- **S2. Programación:** en `Config` se agregan `apertura_programada_sala_at`, `apertura_programada_r1_at`, `cierre_programado_r1_at`, `apertura_programada_r2_at` y `cierre_programado_r2_at`, todos `string | null`, ISO con desfase y en la zona de la sala.
  - Ya existen `cierre_programado_sala_at` y `cierre_programado_ronda_at`. El segundo se conserva como alias de la ronda abierta para no romper clientes.
  - Se editan en `PATCH /api/admin/salas/{id}/config` con las mismas reglas: 422 `HORA_PASADA` y validación de orden, donde la apertura debe ser antes del cierre.
  - El mismo mecanismo de los cierres (chequeo perezoso y cada 15 s) aplica las aperturas: `abrir_inscripcion`, `abrir_ronda_1` y `abrir_ronda_2`, solo si la transición es válida en ese momento. Si no lo es, se descarta y queda en la bitácora.
  - Eventos: `apertura_programada` y `apertura_programada_descartada`.
- **S3. Respuestas por persona** (solo admin): `GET /api/admin/salas/{id}/respuestas` devuelve `{ respuestas: [{ participante_id, nombre, correo, mesa_id, mesa, perfil_id, ronda, proyecto_id, respuestas, actualizado_at }] }`, más 401 y 403 como el resto.
  - `/api/yo` ya trae `mis_votos`: el celular los usa para mostrar «tu calificación». Nada nuevo en la API pública.
- **S4. Modo de preguntas:** en `Config` se agrega `modo_preguntas?: 'automatico' | 'guiado'`, por defecto `automatico`.
  - En el estado de la sala se agrega `pregunta_guiada?: { proyecto_id: string; criterio_id: CriterioId } | null`, visible en `/api/yo` (`sala.pregunta_guiada`) y en el tablero.
  - El admin la fija con `PUT /api/admin/salas/{id}/pregunta-guiada` y el cuerpo `{ proyecto_id, criterio_id }` o `null`. Solo con una ronda abierta: si no, 409 `RONDA_CERRADA`.
  - Al fijarla sube la `version` y queda en la bitácora.
  - El voto se sigue guardando completo (`PUT /api/votos` con los 6 criterios); el celular acumula las respuestas y envía al completar el proyecto.
- **S5. Dominio:** `GET /api/admin/salud`, o el detalle de sala si no existe, agrega `base_url` para que el panel compare con su propio dominio.

## Celular (P, `web/participante/`)
- **P1. Una pregunta por pantalla:** muestra su rúbrica 1-3-5-7-9, una barra de progreso («Pregunta 3 de 6 · INSUMEX») y los botones Anterior y Siguiente.
  - En **automático**, al elegir un valor avanza solo a la siguiente pregunta. Al terminar las 6, muestra un resumen y el botón Guardar.
  - En **guiado**, muestra solo la pregunta de `sala.pregunta_guiada`, guarda la respuesta localmente y espera la siguiente con el aviso «Espera la siguiente pregunta del facilitador». Envía el voto cuando las 6 del proyecto estén respondidas.
  - En los dos modos se pueden corregir las respuestas mientras la ronda esté abierta.
- **P3. Resultados:** junto al promedio de cada criterio aparece «Tu calificación», tomada de `mis_votos`. Nunca la de otra persona.

## Tablero (T, `web/tablero/`)
- **T1. Zoom** en la matriz:
  - botones +, − y «Ver todo», rueda del mouse, pellizco y arrastre para mover;
  - funciona en pantalla completa y en el proyector;
  - accesible por teclado (+, −, 0).
- **T2. Descripción** bajo la matriz, de una o dos líneas: «Eje X (Time to Market): qué tan lejos está del mercado, según alistamiento técnico, conocimiento del cliente, regulación y capacidades. Eje Y (Value Generation Capacity): qué tan lejos está del core y cuánto cuesta probarlo. 1 = cerca y listo, 9 = lejos e incierto. Cada punto es el promedio de los votos de la sala; el tamaño es el tamaño de la oportunidad.»
  - Más un desplegable «¿Cómo se calcula?» con los criterios de cada eje y sus pesos (los de la semilla, leídos de la API si están; si no, solo los nombres).
  - La redacción final pasa por la voz de Estratek.
- **T3. Pregunta guiada:** en modo guiado, el tablero muestra la pregunta actual, con su texto y su rúbrica, en grande.

## Panel (A, `web/admin/`)
- **A2. Configuración:** campos de apertura y cierre para la sala, la ronda 1 y la ronda 2, en la zona horaria de la sala, con la hora del servidor visible.
- **A3. Respuestas por persona:** sección nueva con una tabla por persona y ronda, filtros por mesa y ronda, y el aviso «Solo administradores. No se proyecta».
- **A4. Modo de preguntas:**
  - en Configuración se elige automático o guiado;
  - en Sala en vivo, en modo guiado, un control con Anterior, Siguiente y una lista de proyecto y pregunta, y cuántos ya respondieron la pregunta actual si la API lo trae.
- **A5. Aviso de dominio:** si `base_url` no coincide con `location.origin`, un aviso rojo en el panel: «Los QR apuntan a <base_url>, pero estás en <origin>. Corrige BASE_URL en Coolify».
- **A6. Rol admin:** prueba de UI de cada sección con un usuario de rol admin y arreglo de lo que no muestre.

## Diseño (D, `web/shared/ui/`, `web/inicio/` y `docs/DISENO.md`)
- **D1. Sistema visual del IRMI** en `web/shared/ui/tokens.css` y `componentes.css`:
  - lienzo oscuro, cuatro superficies grafito, tinta clara, acento teal `#47EBC2` y degradado de marca solo en la acción principal y el progreso;
  - Montserrat de 500 a 900;
  - radios, foco visible y espaciados como el IRMI.
- **No se renombra ningún token existente:** se cambian sus valores y se agregan los nuevos. Así el celular, el tablero y el panel heredan el estilo sin tocar su código.
- **R1 y R2** siguen distinguibles en el lienzo oscuro: R1 hueco, R2 sólido, siempre con texto. Se ajustan los tonos de `--hz-r1` y `--hz-r2` para AA sobre oscuro, sin usar el teal de acento.
- Contraste AA medido.
- Commit de los tokens en la primera hora y aviso en `docs/DECISIONES.md`.

## Proceso
- Rama de integración: `feat/cambios-19oct`. Cada agente trabaja en su worktree y su rama, nacida de ella. Commits en Conventional Commits, sin push.
- **Pruebas:** durante el trabajo, `HZ_E2E=0 npx vitest run <tu carpeta>` y `npx tsc --noEmit`.
  - Las pruebas en navegador, una vez al final, con el candado `C:/Users/ypaol/hz-pesado.lock`.
- El golden del motor queda al 100 %.
