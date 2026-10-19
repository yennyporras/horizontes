# Contrato de API v1

JSON en UTF-8. Fechas ISO-8601 con el desfase de la zona horaria de la sala (`config.zona_horaria`: `America/Bogota` y `America/Lima` -05:00, `America/Guatemala` -06:00; sin sala, Bogotá). Errores: `{"error":{"codigo":"RONDA_CERRADA","mensaje":"La ronda 1 ya se cerró."}}` con el HTTP adecuado.
Polling: toda respuesta GET de estado trae `version` y header `ETag`. El cliente manda `If-None-Match`; si no hubo cambios → `304`. Intervalo 2,5 s.
Ejemplos completos de respuesta en `mocks/`. T2, T3 y T4 trabajan contra esos mocks hasta que T1 publique la API real.

## Autenticación
- Participante: header `X-Participante-Token` (se recibe al inscribirse; el servidor guarda solo el hash).
- Tablero: query `t={tokenTablero}` (uno por sala, se genera al crearla).
- Admin: cookie de sesión `hz_admin` (httpOnly, SameSite=Lax). `POST /api/admin/login` `{usuario, clave}`.

## Participante
| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/mesas/{codigoMesa}` | | `{sala:{id,nombre,estado,pais}, mesa:{id,nombre}, inscripcion_abierta, consentimiento:{version, texto_autorizacion, politica_url}}` · 404 `MESA_NO_EXISTE`. `version` = `hz-1.1`; `texto_autorizacion` según el país de la sala (CO: Ley 1581 de 2012; PE: Ley 29733; GT: Política de Tratamiento de Datos de Estratek) |
| `POST /api/inscripcion` | `{codigoMesa, nombre, correo, consentimiento:{aceptado:true, version}}` | `201 {token, participante:{id,nombre,mesa,perfil}}` · 409 `CORREO_YA_INSCRITO` devuelve el mismo participante con token nuevo · 422 `CONSENTIMIENTO_REQUERIDO` |
| `GET /api/yo` | | Ver `mocks/GET_api_yo.json`. Incluye estado (con `sala.pregunta_guiada`: `{proyecto_id, criterio_id}` o null), config (con `pais`, `zona_horaria` y `modo_preguntas`), contenido (caso + hojas visibles), criterios, mis votos de la ronda, pendientes, progreso de mi mesa y `resultados` (null si aún no puedo ver) |
| `PUT /api/votos` | `{proyecto_id, ronda, respuestas:{6 criterios: 1, 3, 5, 7 o 9}}` | `200 {voto, completo_ronda, progreso_mesa}` · 409 `RONDA_CERRADA` / `RONDA_NO_ACTIVA` · 422 `RESPUESTA_INVALIDA` |
| `GET /api/resultados?ronda=` | | Misma forma que `GET /api/tablero`, recortada al alcance permitido por config. Disponible si la ronda está cerrada, si `vista_participante = en_vivo`, o si su alcance está en precierre (con `preliminar: true`). Si no, 403 `RESULTADOS_NO_DISPONIBLES` |

## Tablero
| Método y ruta | | Respuesta |
|---|---|---|
| `GET /api/tablero/{salaId}?alcance={sala o mesa}&mesa={mesaId}&t=` | | Ver `mocks/GET_api_tablero.json`. `proyectos_vivos[].rondas[]` trae por ronda: `n_votos, promedios, distribucion, t2m, eje_x, eje_y, total` (null si no hay votos). Con menos de `minimo_votos` (3) votos en el alcance: todo en null salvo `n_votos`, y `bajo_minimo: true`. `total = eje_x + eje_y` (fila «Total» de las tablas; el frontend nunca lo calcula). `proyectos_fijos[]` también trae `total`. `config` trae `pais`, `zona_horaria`, `modo_preguntas` y la programación. `sala.pregunta_guiada` (`{proyecto_id, criterio_id}` o null) es la pregunta que el admin fijó en modo guiado. `progreso` trae `por_mesa[]` con `precierre` |

## Admin
| Método y ruta | Cuerpo / efecto |
|---|---|
| `POST /api/admin/login` · `POST /api/admin/logout` | Sesión |
| `GET /api/admin/salas` | Lista |
| `POST /api/admin/salas` | `{nombre, plantilla:"foodsume_2026", mesas:N}` → crea sala, mesas, proyectos, hojas, token tablero |
| `GET /api/admin/salas/{id}` | Ver `mocks/GET_api_admin_salas_id.json` (con polling). Trae `servidor_at` (hora del servidor en la zona de la sala), `base_url` (la `BASE_URL` del servidor, la de los QR, sin barra final) y `sala.pregunta_guiada` |
| `PATCH /api/admin/salas/{id}/config` | Cualquiera de: `alcance_resultados, vista_participante, revelar_hojas, cierre_programado_ronda_at, cierre_programado_sala_at, apertura_programada_sala_at, apertura_programada_r1_at, cierre_programado_r1_at, apertura_programada_r2_at, cierre_programado_r2_at, modo_preguntas (automatico, guiado), pais (CO, PE, GT), zona_horaria (America/Bogota, America/Lima, America/Guatemala)`. Cambiar `pais` sin `zona_horaria` pone la zona del país. Una sala nueva, duplicada o reiniciada nace con `alcance_resultados: sala`, `vista_participante: en_vivo` y `modo_preguntas: automatico`. Programación: ISO con zona o null; 422 `HORA_PASADA` si ya pasó según el servidor; 422 `ORDEN_INVALIDO` si no respeta el orden del taller (apertura de sala ≤ apertura R1 ≤ cierre R1 ≤ apertura R2 ≤ cierre R2 ≤ cierre de sala, y cada apertura estrictamente antes de su cierre), comparando también con lo ya guardado. `cierre_programado_ronda_at` es alias del cierre de la ronda abierta o, si no hay, de la siguiente (R1 antes de abrirla, R2 desde que se cierra R1): lee y escribe `cierre_programado_r1_at` o `cierre_programado_r2_at`; si llega junto con el campo propio de esa ronda, manda el propio. Cambiar `modo_preguntas` quita la pregunta guiada |
| `POST /api/admin/salas/{id}/acciones` | `{accion}` con: `abrir_inscripcion, abrir_ronda_1, cerrar_ronda_1, abrir_ronda_2, cerrar_ronda_2, reabrir_ronda, reiniciar_ronda, cerrar_sala, reabrir_sala`. 409 `TRANSICION_INVALIDA` |
| `POST /api/admin/salas/{id}/mesas` | `{cantidad}` agrega mesas |
| `GET /api/admin/salas/{id}/respuestas` | `{respuestas:[{participante_id, nombre, correo, mesa_id, mesa, perfil_id, activo, ronda, proyecto_id, respuestas, actualizado_at}]}`: una fila por persona, ronda y proyecto votado, por mesa y orden de inscripción, INSUMEX antes que NUTRIWHAT. Incluye a los desactivados (`activo: false`, sus votos no cuentan). Solo admin y superadmin: 401 sin sesión, 403 `CAMBIO_CLAVE_REQUERIDO`, 404 `SALA_NO_EXISTE`. Nunca se proyecta ni sale en rutas públicas |
| `PUT /api/admin/salas/{id}/pregunta-guiada` | `{proyecto_id, criterio_id}` o `null` (la quita) → `{pregunta_guiada, version}`. Solo con una ronda abierta: 409 `RONDA_CERRADA`. 422 `PROYECTO_INVALIDO` (solo vivos) · 422 `CRITERIO_NO_EXISTE`. Sube `version` y registra el evento `pregunta_guiada`. Cualquier cambio de estado de la sala y cambiar `modo_preguntas` la quitan. El voto sigue siendo completo (`PUT /api/votos` con los 6 criterios). La API no cuenta quién respondió la pregunta actual: el voto llega completo al terminar el proyecto |
| `GET /api/admin/salas/{id}/rubricas` | `{criterios:[{id, nombre, pregunta, rubrica:[{valor, texto}]}], editable, motivo_no_editable?}`. `editable` es false si la sala tiene votos en cualquier ronda; entonces trae `motivo_no_editable` |
| `PUT /api/admin/salas/{id}/rubricas/{criterio_id}` | `{rubrica:[{valor, texto}], usar_en_salas_nuevas?}` → misma forma del GET. Solo cambian los textos: exactamente los valores 1, 3, 5, 7 y 9 sin repetir; texto recortado, no vacío, hasta 300 caracteres, sin caracteres de control, llaves ni `<` pegado a una letra (marcado); las rayas se cambian por comas. 422 `RUBRICA_INVALIDA` · 422 `CRITERIO_NO_EXISTE` · 409 `RUBRICA_CON_VOTOS` si la sala ya tiene votos. Registra el evento `rubrica_editada` y sube `version`. `usar_en_salas_nuevas: true` la deja también para las salas que se creen después con la misma plantilla. Admin y superadmin |
| `GET /api/admin/salas/{id}/hojas` | `{hojas:[{proyecto_id, proyecto, perfil_id, perfil, texto}]}`: las 6 hojas de cada proyecto vivo de la sala, en el orden del catálogo de perfiles y luego del proyecto. Solo lectura y sin depender de `revelar_hojas` (el facilitador las lee aunque los celulares no las vean). 401 sin sesión · 403 `CAMBIO_CLAVE_REQUERIDO` · 404 `SALA_NO_EXISTE`. Admin y superadmin |
| `GET /api/admin/mesas/{mesaId}/qr.svg` | QR de la URL de la mesa |
| `PATCH /api/admin/participantes/{id}` | `{perfil_id?, mesa_id?, activo?}` |
| `GET /api/admin/yo` | `{id, usuario, nombre, rol}` (para mostrar u ocultar la gestión de admins) |
| `GET /api/admin/admins` · `POST /api/admin/admins` `{usuario, nombre, correo, clave_temporal}` · `PATCH /api/admin/admins/{id}` `{activo?, nombre?, correo?, restablecer_clave?}` | **Solo superadmin** (403 `SOLO_SUPERADMIN`). No se puede crear otro superadmin por API |
| `POST /api/admin/cambiar-clave` `{actual, nueva}` | Obligatorio en el primer ingreso si `debe_cambiar_clave` |
| `GET /api/admin/salas/{id}/export/inscritos.csv` · `.../export/votos.csv` | CSV UTF-8 con BOM (abre bien en Excel). Al final, columnas `ip` (inscripción o último guardado del voto) y `pais` (del aviso aceptado) |

## Reglas que el servidor garantiza
- Un voto por participante, proyecto y ronda (upsert).
- Aperturas y cierres programados aplicados antes de responder cualquier petición y cada 15 s, en orden de hora (y del taller si coinciden). Cada uno solo si su transición es válida en ese momento (`abrir_inscripcion`, `abrir_ronda_1`, `cerrar_ronda_1`, `abrir_ronda_2`, `cerrar_ronda_2`, `cerrar_sala`); si no, se descarta. Eventos `apertura_programada`, `cierre_programado`, `apertura_programada_descartada` y `cierre_programado_descartado` (por `programado`, detalle `{accion, programado_at, estado?}`). La acción manual consume lo programado para ella (abrir R1 consume también la apertura de sala; cerrar la sala, todo).
- `version` cambia con cualquier voto, inscripción, acción, cambio de config, de rúbrica o de pregunta guiada de la sala.
- Respuestas sin datos personales fuera de `/api/admin/*`. La IP (detrás de `TRUST_PROXY_HOPS` proxies) se guarda en cada inscripción y voto; solo sale en `participantes[].ip` del detalle de sala y en el export, nunca en vistas públicas ni en logs.
