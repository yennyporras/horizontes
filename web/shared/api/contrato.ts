// Tipos del contrato de API v1 (docs/CONTRATO_API.md). Responsable: equipo del servidor. Solo lectura para el celular, el tablero y el panel.
// Los campos opcionales se agregaron después de la primera versión (ver docs/DECISIONES.md, prefijo CONTRATO:).

export type CriterioId =
  | 'alistamiento_tecnico'
  | 'conocimiento_cliente'
  | 'regulacion'
  | 'capacidades_organizacionales'
  | 'alineacion_core'
  | 'inversion_requerida'
export type Valor = 1 | 3 | 5 | 7 | 9
export type Respuestas = Record<CriterioId, Valor>
export type EstadoSala = 'preparada' | 'inscripcion' | 'r1_abierta' | 'r1_cerrada' | 'r2_abierta' | 'r2_cerrada' | 'cerrada'
export type PerfilId = 'cliente' | 'regulacion' | 'financiero' | 'tecnica_operaciones' | 'estrategica' | 'produccion'
export type Pais = 'CO' | 'PE' | 'GT'
export type ZonaHoraria = 'America/Bogota' | 'America/Lima' | 'America/Guatemala'

/** Modo de preguntas del celular (19-oct): `automatico` pasa sola al responder; `guiado` muestra la que fija el admin. */
export type ModoPreguntas = 'automatico' | 'guiado'
/** Pregunta que el admin fija en modo guiado (`PUT /api/admin/salas/{id}/pregunta-guiada`). */
export interface PreguntaGuiada {
  proyecto_id: string
  criterio_id: CriterioId
}

export interface ErrorCuerpo {
  error: { codigo: string; mensaje: string }
}

export interface Config {
  alcance_resultados: 'mesa' | 'sala'
  vista_participante: 'registrado' | 'en_vivo'
  revelar_hojas: boolean
  /** Alias del cierre de la ronda abierta (o de la siguiente): lee y escribe `cierre_programado_r1_at` o `cierre_programado_r2_at`. */
  cierre_programado_ronda_at: string | null
  cierre_programado_sala_at: string | null
  /** Programación (19-oct), ISO con el desfase de la sala o null. Apertura de la sala = abrir inscripción. */
  apertura_programada_sala_at?: string | null
  apertura_programada_r1_at?: string | null
  cierre_programado_r1_at?: string | null
  apertura_programada_r2_at?: string | null
  cierre_programado_r2_at?: string | null
  /** Por defecto `automatico`. */
  modo_preguntas?: ModoPreguntas
  /** País de la sala (por defecto CO). Define el texto del aviso de datos. */
  pais?: Pais
  /** Zona horaria de la sala (por defecto la del país). Las horas de la sala salen con su desfase. */
  zona_horaria?: ZonaHoraria
}

// --- Participante -------------------------------------------------------------

export interface InfoMesa {
  sala: { id: string; nombre: string; estado: EstadoSala; pais?: Pais }
  mesa: { id: string; nombre: string }
  inscripcion_abierta: boolean
  consentimiento: { version: string; texto_autorizacion: string; politica_url: string }
}

export interface ParticipantePublico {
  id: string
  nombre: string
  mesa: { id: string; nombre: string }
  perfil: { id: PerfilId; nombre: string }
  activo?: boolean
}

export interface CuerpoInscripcion {
  codigoMesa: string
  nombre: string
  correo: string
  consentimiento: { aceptado: true; version: string }
}
/**
 * 201 de `POST /api/inscripcion`. Desde el 20-oct (D1) un correo ya inscrito en la sala responde 409 `CORREO_YA_INSCRITO`
 * solo con `error` (sin token, nombre ni datos): la sesión la devuelve el facilitador con «Dar acceso de nuevo».
 */
export interface RespuestaInscripcion {
  token: string
  participante: ParticipantePublico
  /** Obsoleto desde el 20-oct: el 409 ya no trae token ni participante. Se conserva para no romper a quien lo lea. */
  error?: ErrorCuerpo['error']
}

/** `POST /api/acceso`: canjea el enlace personal (`/m/{codigoMesa}?acceso=…`) que genera el facilitador. */
export interface CuerpoAcceso {
  acceso: string
}
/**
 * 200 de `POST /api/acceso`: la misma forma que la inscripción exitosa. El token nuevo cierra las demás sesiones del participante.
 * Errores: 404 `ACCESO_INVALIDO` · 410 `ACCESO_VENCIDO` (venció a los 15 min o ya se usó) · 409 `SALA_CERRADA` ·
 * 403 `PARTICIPANTE_INACTIVO` · 422 `DATOS_INVALIDOS` (sin `acceso`) · 429 `DEMASIADAS_PETICIONES`.
 */
export interface RespuestaAcceso {
  token: string
  participante: ParticipantePublico
}

export interface Rubrica {
  valor: Valor
  texto: string
}
export interface Criterio {
  id: CriterioId
  nombre: string
  pregunta: string
  perfil_informante: PerfilId
  rubrica: Rubrica[]
}
export interface Voto {
  proyecto_id: string
  ronda: 1 | 2
  respuestas: Respuestas
  actualizado_at: string
}
export interface ProgresoMesa {
  inscritos: number
  completos: number
  precierre: boolean
}

export interface Yo {
  version: string
  participante: ParticipantePublico
  sala: { id: string; nombre: string; estado: EstadoSala; ronda_actual: 0 | 1 | 2; pregunta_guiada?: PreguntaGuiada | null }
  config: Pick<Config, 'vista_participante' | 'alcance_resultados' | 'revelar_hojas' | 'pais' | 'zona_horaria' | 'modo_preguntas'>
  contenido: {
    caso: { titulo: string; descripcion_md: string; situacion_md: string }
    portafolio: { id: string; nombre: string; tipo: string; sector: string; descripcion: string; modo: 'fijo' | 'vivo' }[]
    hojas: HojaPerfil[]
  }
  criterios: Criterio[]
  escala: Valor[]
  mis_votos: Voto[]
  /** Aditivo (20-oct): votos propios de las rondas anteriores a la actual (la ronda 1 cuando la actual es la 2). */
  mis_votos_anteriores?: Voto[]
  pendientes: string[]
  completo_ronda: boolean
  progreso_mesa: ProgresoMesa
  resultados: ResultadosParticipante | null
}

/** Hoja de información de un perfil para un proyecto vivo. */
export interface HojaPerfil {
  proyecto_id: string
  proyecto: string
  perfil_id: PerfilId
  perfil?: string
  texto: string
}

export interface CuerpoVoto {
  proyecto_id: string
  ronda: 1 | 2
  respuestas: Respuestas
}
export interface RespuestaVoto {
  voto: Voto
  completo_ronda: boolean
  progreso_mesa: ProgresoMesa
}

// --- Tablero -------------------------------------------------------------------

export type Distribucion = Record<'1' | '3' | '5' | '7' | '9', number>
export interface RondaVivo {
  ronda: 1 | 2
  n_votos: number
  promedios: Record<CriterioId, number> | null
  distribucion: Record<CriterioId, Distribucion> | null
  t2m: number | null
  eje_x: number | null
  eje_y: number | null
  /** eje_x + eje_y, calculado en el servidor (fila «Total»). null sin votos o con `bajo_minimo`. */
  total?: number | null
  /** true si hay votos pero menos que `Tablero.minimo_votos`: promedios, distribución y punto van en null por privacidad. */
  bajo_minimo?: boolean
  /**
   * R1 oculta (20-oct, decisión 1 de Paola): la ronda 1 está abierta, el alcance no está en precierre y quien pide no es el
   * panel del admin (`GET /api/tablero/{id}?vista=panel` con sesión admin). `n_votos` sí va; promedios, distribución, t2m,
   * ejes y total en null. Se muestra cuando todo el alcance votó (precierre) o al cerrar la ronda.
   */
  oculta?: true
}
/**
 * Convergencia R1 → R2 de un proyecto vivo en el alcance (20-oct), calculada en el servidor. Solo cuando R1 y R2 tienen
 * resultado visible (sin `oculta` ni `bajo_minimo`). Dispersión = promedio de las desviaciones estándar (poblacionales) de
 * los 6 criterios, sobre la distribución publicada. `reduccion_pct` = (d1 − d2) / d1 × 100 redondeado (0 si d1 es 0;
 * negativa si la dispersión creció). `criterio_mayor_cambio` = mayor |promedio R2 − promedio R1| (empate: el primero en
 * el orden de los criterios). `delta_x`, `delta_y` = eje R2 − eje R1, con 2 decimales.
 */
export interface Convergencia {
  dispersion_r1: number
  dispersion_r2: number
  reduccion_pct: number
  criterio_mayor_cambio: CriterioId
  delta_x: number
  delta_y: number
}
export interface ProyectoTablero {
  id: string
  nombre: string
  sector: string
  modo: 'fijo' | 'vivo'
  tam: number
}
export interface Tablero {
  version: string
  sala: { id: string; nombre: string; estado: EstadoSala; ronda_actual: 0 | 1 | 2; pregunta_guiada?: PreguntaGuiada | null }
  alcance: { tipo: 'sala' | 'mesa'; mesa_id: string | null; mesa_nombre: string | null }
  config: Config
  /** `por_mesa` solo en el tablero (con token o sesión de admin); las vistas del participante usan `ResultadosParticipante`. */
  progreso: { inscritos: number; completos: number; precierre: boolean; por_mesa: (ProgresoMesa & { mesa_id: string; nombre: string })[] }
  ejes: Record<'x' | 'y', { titulo: string; subtitulo: string; min: number; max: number }>
  grafico: { titulo: string; horizontes: { id: string; radio: number | null }[]; etiquetas_horizonte?: Record<string, [number, number]>; nota_horizontes?: string; tam_a_radio?: string }
  /** `pregunta` y `rubrica` (mismo formato que en `/api/yo`) solo llegan con `config.modo_preguntas = 'guiado'`. */
  criterios: { id: CriterioId; nombre: string; pregunta?: string; rubrica?: Rubrica[] }[]
  proyectos_fijos: (ProyectoTablero & { t2m: number; eje_x: number; eje_y: number; total?: number })[]
  proyectos_vivos: (ProyectoTablero & { rondas: RondaVivo[]; convergencia?: Convergencia })[]
  preliminar: boolean
  /** Votos mínimos por proyecto y ronda para mostrar resultados de un alcance (hoy 3). */
  minimo_votos?: number
  /**
   * Consolidado en vivo (20-oct, D2): con la ronda abierta, el agregado de cada alcance, ronda y proyecto es una foto que se
   * renueva solo cuando llegan al menos estos votos nuevos o cambiados desde la última (hoy 3). Con la ronda cerrada, exacto.
   */
  votos_por_actualizacion?: number
  /** Promedio (redondeado) de `reduccion_pct` de los vivos que tienen `convergencia`. Sin ninguno, no llega. */
  convergencia_alcance?: { reduccion_pct: number }
}

/**
 * `GET /api/resultados` y `GET /api/yo` → `resultados`: la forma del tablero recortada al alcance del participante.
 * Desde el 20-oct (D2) no trae `progreso.por_mesa` (cuántos hay inscritos en cada mesa no es del participante).
 */
export type ResultadosParticipante = Omit<Tablero, 'progreso'> & {
  progreso: Omit<Tablero['progreso'], 'por_mesa'> & { por_mesa?: Tablero['progreso']['por_mesa'] }
}

// --- Admin -----------------------------------------------------------------------

export interface AdminYo {
  id: number
  usuario: string
  nombre: string
  rol: 'superadmin' | 'admin'
  debe_cambiar_clave?: boolean
}
export interface Admin extends AdminYo {
  correo: string | null
  activo: boolean
  debe_cambiar_clave: boolean
  creado_at: string
  clave_temporal?: string
}
/** Migración 8 (20-oct): `ensayo` no cuenta en `GET /api/admin/metricas`. Duplicar una sala crea un ensayo. */
export type TipoSala = 'taller' | 'ensayo'
export type SectorSala = 'alimentos' | 'energia' | 'financiero' | 'comercio' | 'salud' | 'manufactura' | 'otro'
export const SECTORES_SALA: readonly SectorSala[] = ['alimentos', 'energia', 'financiero', 'comercio', 'salud', 'manufactura', 'otro']
/**
 * Opcionales en `POST /api/admin/salas` y `PATCH /api/admin/salas/{id}/config`. `empresa`: texto de hasta 80 caracteres
 * (vacía o null la quita); `sector`: uno de `SECTORES_SALA` o null. Si no, 422 `DATOS_INVALIDOS`.
 */
export interface ClasificacionSala {
  tipo?: TipoSala
  empresa?: string | null
  sector?: SectorSala | null
}
export interface CuerpoNuevaSala extends ClasificacionSala {
  nombre: string
  plantilla: 'foodsume_2026'
  mesas: number
}
/** Una fila de `GET /api/admin/salas` → `{salas}`. */
export interface SalaListada {
  id: string
  codigo: string
  nombre: string
  estado: EstadoSala
  ronda_actual: number
  creada_at: string
  mesas: number
  inscritos: number
  tipo?: TipoSala
  empresa?: string | null
  sector?: SectorSala | null
}
/** `GET /api/admin/metricas`: solo salas `taller` con al menos una persona activa (sin ensayos ni demostraciones). */
export interface Metricas {
  talleres: number
  personas: number
  /** Personas activas con los 2 proyectos vivos votados en la ronda 2. */
  completaron_r2: number
  /** Países de esos talleres, en orden alfabético. */
  paises: Pais[]
}
/** `POST /api/admin/demo` (solo superadmin, 201). 409 `DEMO_EN_CURSO` si ya hay una corriendo. */
export interface RespuestaDemo {
  sala: SalaResumen
}
/** Archivos de `GET /api/admin/salas/{id}/export/{archivo}`. `resultados.csv` no lleva datos personales. */
export type ArchivoExport = 'inscritos.csv' | 'votos.csv' | 'resultados.csv'
export interface SalaResumen {
  id: string
  codigo: string
  nombre: string
  plantilla?: string
  estado: EstadoSala
  ronda_actual: number
  creada_at: string
  config: Config
  token_tablero?: string
  url_tablero?: string
  /** Pregunta fijada en modo guiado (null sin pregunta). */
  pregunta_guiada?: PreguntaGuiada | null
  tipo?: TipoSala
  empresa?: string | null
  sector?: SectorSala | null
}
export interface MesaAdmin {
  id: string
  numero?: number
  nombre: string
  codigo: string
  url_participante: string
  url_tablero: string
  inscritos: number
  completos: number
  precierre: boolean
  perfiles: Record<PerfilId, number>
}
export interface ParticipanteAdmin {
  id: string
  nombre: string
  correo: string
  mesa_id: string
  perfil_id: PerfilId
  activo: boolean
  completo_ronda: boolean
  consentimiento_at: string | null
  /** IP de la inscripción. Solo en el panel admin y el export interno. */
  ip?: string | null
  pais?: string
}
/** `POST /api/admin/participantes/{id}/acceso` («Dar acceso de nuevo»): enlace personal de un solo uso que vence a los 15 min. */
export interface AccesoParticipante {
  /** `{BASE_URL}/m/{codigoMesa}?acceso={token}`. Mostrarlo como QR y como enlace para copiar; no se puede volver a consultar. */
  url: string
  /** Hora de vencimiento, ISO con el desfase de la sala. */
  vence_at: string
}
/** `DELETE /api/admin/rubricas-plantilla/{criterio_id}`: las salas nuevas vuelven a la rúbrica de la semilla en ese criterio. */
export interface RubricaPlantillaBorrada {
  plantilla: string
  criterio_id: CriterioId
  /** false si no había una rúbrica guardada para las salas nuevas (la llamada es idempotente). */
  borrada: boolean
  /** La rúbrica que usarán desde ahora las salas nuevas (la de la semilla). */
  rubrica: Rubrica[]
}
/**
 * `DELETE /api/admin/salas/{id}` (solo superadmin; 21-oct): cuerpo con el nombre exacto de la sala. 204 sin cuerpo.
 * 403 SOLO_SUPERADMIN, 404 SALA_NO_EXISTE, 422 CONFIRMACION_INVALIDA, 500 RESPALDO_FALLIDO (no se borró nada).
 */
export interface CuerpoEliminarSala {
  confirmar: string
}
/**
 * `DELETE /api/admin/mesas/{id}` (cualquier admin; 21-oct): las mesas que quedan en la sala. 404 MESA_NO_EXISTE,
 * 409 MESA_CON_INSCRITOS (inscritos activos o inactivos), 409 ULTIMA_MESA. Evento `mesa_eliminada` con
 * `{mesa_id, numero, nombre, codigo}`. `DELETE /api/admin/admins/{id}` (solo superadmin) responde 204 sin cuerpo.
 */
export interface RespuestaEliminarMesa {
  mesas: MesaAdmin[]
}
/** Códigos de error de las rutas de eliminar (21-oct). */
export type CodigoErrorEliminar = 'CONFIRMACION_INVALIDA' | 'RESPALDO_FALLIDO' | 'MESA_CON_INSCRITOS' | 'ULTIMA_MESA' | 'OPERACION_INVALIDA' | 'SOLO_SUPERADMIN'
export interface Evento {
  at: string
  tipo: string
  detalle: Record<string, unknown> | null
  por: string
}
export interface DetalleSala {
  version: string
  sala: SalaResumen
  progreso?: { ronda: number; inscritos: number; completos: number; precierre: boolean }
  mesas: MesaAdmin[]
  participantes: ParticipanteAdmin[]
  perfiles?: { id: PerfilId; nombre: string }[]
  eventos: Evento[]
  admin_actual: AdminYo
  /** Hora del servidor en la zona de la sala (para programar aperturas y cierres). */
  servidor_at?: string
  /** BASE_URL del servidor: la de los QR y enlaces. El panel avisa si no coincide con su dominio. */
  base_url?: string
  resumen?: ResumenTaller
}
/** Resumen del taller en el detalle de sala (20-oct). */
export interface ResumenTaller {
  /** De la primera apertura al último cierre de la ronda según la bitácora, con 1 decimal. null si la ronda no se ha cerrado. */
  minutos_r1: number | null
  minutos_r2: number | null
  /** Participantes activos. */
  inscritos: number
  /** Activos con los 2 proyectos vivos votados en esa ronda. */
  completaron_r1: number
  completaron_r2: number
  /** Veces que se usó «Dar acceso de nuevo» (eventos `acceso_reemitido`). */
  accesos_nuevos: number
}
/** GET /api/admin/salas/{id}/respuestas: una fila por persona, ronda y proyecto votado. Solo admin, nunca se proyecta. */
export interface RespuestaPersona {
  participante_id: string
  nombre: string
  correo: string
  mesa_id: string
  mesa: string
  perfil_id: PerfilId
  /** false: sus votos no cuentan en la matriz. */
  activo?: boolean
  ronda: 1 | 2
  proyecto_id: string
  respuestas: Respuestas
  actualizado_at: string
}
export interface RespuestasSala {
  respuestas: RespuestaPersona[]
}
/** PUT /api/admin/salas/{id}/pregunta-guiada: `{proyecto_id, criterio_id}` o `null` para quitarla. */
export type CuerpoPreguntaGuiada = PreguntaGuiada | null
export interface RespuestaPreguntaGuiada {
  pregunta_guiada: PreguntaGuiada | null
  version: string
}
/** GET /api/admin/salas/{id}/rubricas (y respuesta del PUT). */
export interface RubricasSala {
  criterios: { id: CriterioId; nombre: string; pregunta: string; rubrica: Rubrica[] }[]
  /** false si la sala ya tiene votos (en cualquier ronda). */
  editable: boolean
  /** Solo cuando `editable` es false: por qué no se puede editar. */
  motivo_no_editable?: string
}
/** GET /api/admin/salas/{id}/hojas: las 6 hojas de cada proyecto vivo, en el orden del catálogo de perfiles (solo lectura). */
export interface HojasSala {
  hojas: (HojaPerfil & { perfil: string })[]
}
/** PUT /api/admin/salas/{id}/rubricas/{criterio_id}: los 5 niveles (1, 3, 5, 7, 9), solo cambian los textos. */
export interface CuerpoRubrica {
  rubrica: Rubrica[]
  /** true: también será la rúbrica de las salas nuevas de la plantilla. */
  usar_en_salas_nuevas?: boolean
}
export type AccionSala =
  | 'abrir_inscripcion'
  | 'abrir_ronda_1'
  | 'cerrar_ronda_1'
  | 'abrir_ronda_2'
  | 'cerrar_ronda_2'
  | 'reabrir_ronda'
  | 'reiniciar_ronda'
  | 'cerrar_sala'
  | 'reabrir_sala'
  /** B-2 (20-oct): token nuevo para el tablero; los enlaces anteriores dejan de funcionar. Válida en cualquier estado. */
  | 'regenerar_token_tablero'
