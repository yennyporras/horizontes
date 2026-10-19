// Tipos del contrato de API v1 (docs/CONTRATO_API.md). Dueño: T1. Solo lectura para T2, T3 y T4.
// Los campos opcionales se agregaron después de R0 (ver docs/DECISIONES.md, prefijo CONTRATO:).

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

export interface ErrorCuerpo {
  error: { codigo: string; mensaje: string }
}

export interface Config {
  alcance_resultados: 'mesa' | 'sala'
  vista_participante: 'registrado' | 'en_vivo'
  revelar_hojas: boolean
  cierre_programado_ronda_at: string | null
  cierre_programado_sala_at: string | null
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
/** 201, o 409 CORREO_YA_INSCRITO (trae además `error`). */
export interface RespuestaInscripcion {
  token: string
  participante: ParticipantePublico
  error?: ErrorCuerpo['error']
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
  sala: { id: string; nombre: string; estado: EstadoSala; ronda_actual: 0 | 1 | 2 }
  config: Pick<Config, 'vista_participante' | 'alcance_resultados' | 'revelar_hojas' | 'pais' | 'zona_horaria'>
  contenido: {
    caso: { titulo: string; descripcion_md: string; situacion_md: string }
    portafolio: { id: string; nombre: string; tipo: string; sector: string; descripcion: string; modo: 'fijo' | 'vivo' }[]
    hojas: HojaPerfil[]
  }
  criterios: Criterio[]
  escala: Valor[]
  mis_votos: Voto[]
  pendientes: string[]
  completo_ronda: boolean
  progreso_mesa: ProgresoMesa
  resultados: Tablero | null
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
  sala: { id: string; nombre: string; estado: EstadoSala; ronda_actual: 0 | 1 | 2 }
  alcance: { tipo: 'sala' | 'mesa'; mesa_id: string | null; mesa_nombre: string | null }
  config: Config
  progreso: { inscritos: number; completos: number; precierre: boolean; por_mesa: (ProgresoMesa & { mesa_id: string; nombre: string })[] }
  ejes: Record<'x' | 'y', { titulo: string; subtitulo: string; min: number; max: number }>
  grafico: { titulo: string; horizontes: { id: string; radio: number | null }[]; etiquetas_horizonte?: Record<string, [number, number]>; nota_horizontes?: string; tam_a_radio?: string }
  criterios: { id: CriterioId; nombre: string }[]
  proyectos_fijos: (ProyectoTablero & { t2m: number; eje_x: number; eje_y: number; total?: number })[]
  proyectos_vivos: (ProyectoTablero & { rondas: RondaVivo[] })[]
  preliminar: boolean
  /** Votos mínimos por proyecto y ronda para mostrar resultados de un alcance (hoy 3). */
  minimo_votos?: number
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
