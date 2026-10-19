// Tipos del contrato (docs/CONTRATO_API.md). Cuando T1 publique web/shared/api, se reemplazan por los generados.

export type Rol = 'superadmin' | 'admin'

export interface AdminYo {
  id: number
  usuario: string
  nombre: string
  rol: Rol
  debe_cambiar_clave?: boolean
}

export interface AdminFila extends AdminYo {
  correo: string | null
  activo: boolean
}

export type EstadoSala =
  | 'preparada'
  | 'inscripcion'
  | 'r1_abierta'
  | 'r1_cerrada'
  | 'r2_abierta'
  | 'r2_cerrada'
  | 'cerrada'

export type Pais = 'CO' | 'PE' | 'GT'
export type ZonaHoraria = 'America/Bogota' | 'America/Lima' | 'America/Guatemala'

export interface ConfigSala {
  alcance_resultados: 'mesa' | 'sala'
  vista_participante: 'registrado' | 'en_vivo'
  revelar_hojas: boolean
  cierre_programado_ronda_at: string | null
  cierre_programado_sala_at: string | null
  /** R4_CONTRATO C4: si faltan, el servidor usa CO y la zona del país. */
  pais?: Pais
  zona_horaria?: ZonaHoraria
  /** C19-4 (S2): apertura y cierre programados por sala y por ronda. ISO con el desfase de la sala; null sin programar. */
  apertura_programada_sala_at?: string | null
  apertura_programada_r1_at?: string | null
  cierre_programado_r1_at?: string | null
  apertura_programada_r2_at?: string | null
  cierre_programado_r2_at?: string | null
  /** C19-5 (S4): automático (pasa sola al responder) o guiado (el admin elige la pregunta). Por defecto automático. */
  modo_preguntas?: ModoPreguntas
}

export type ModoPreguntas = 'automatico' | 'guiado'

/** C19-5 (S4): la pregunta que ven todos en modo guiado. */
export interface PreguntaGuiada {
  proyecto_id: string
  criterio_id: string
}

export interface SalaResumen {
  id: string
  codigo: string
  nombre: string
  estado: EstadoSala
  ronda_actual?: number
  creada_at: string
  mesas?: number
}

export interface Mesa {
  id: string
  nombre: string
  codigo: string
  url_participante: string
  url_tablero: string
  inscritos: number
  completos: number
  precierre: boolean
  perfiles: Record<string, number>
}

export interface Participante {
  id: string
  nombre: string
  correo: string
  mesa_id: string
  perfil_id: string
  activo: boolean
  completo_ronda: boolean
  consentimiento_at: string
  /** R4_CONTRATO C8: solo en el panel, nunca en vistas públicas. */
  ip?: string | null
  pais?: string
}

export interface Evento {
  at: string
  tipo: string
  detalle: Record<string, unknown>
  por: string
}

export interface SalaDetalle {
  version: string
  /** url_tablero es opcional (CONTRATO: agregado por T4); si falta, se deriva del tablero de una mesa. */
  sala: SalaResumen & { config: ConfigSala; url_tablero?: string; pregunta_guiada?: PreguntaGuiada | null }
  mesas: Mesa[]
  participantes: Participante[]
  eventos: Evento[]
  admin_actual: AdminYo
  /** Hora del servidor con el desfase de la sala. */
  servidor_at?: string
  /** C19-1 (S5): dominio con el que el servidor arma QR y enlaces. */
  base_url?: string
}

/** GET /api/admin/salas/{id}/respuestas (C19-3, S3): solo admin. */
export interface RespuestaPersona {
  participante_id: string
  nombre: string
  correo: string
  mesa_id: string
  mesa: string
  perfil_id: string
  ronda: number
  proyecto_id: string
  respuestas: Record<string, number>
  actualizado_at: string
}

/** GET /api/admin/salas/{id}/rubricas y respuesta del PUT de un criterio. */
export interface RubricasSala {
  criterios: { id: string; nombre: string; pregunta: string; rubrica: { valor: number; texto: string }[] }[]
  editable: boolean
  motivo_no_editable?: string
}

/** GET /api/admin/salas/{id}/hojas: las 6 hojas de cada proyecto vivo, en el orden del catálogo de perfiles. */
export interface HojasSala {
  hojas: { proyecto_id: string; proyecto: string; perfil_id: string; perfil: string; texto: string }[]
}

export type Accion =
  | 'abrir_inscripcion'
  | 'abrir_ronda_1'
  | 'cerrar_ronda_1'
  | 'abrir_ronda_2'
  | 'cerrar_ronda_2'
  | 'reabrir_ronda'
  | 'reiniciar_ronda'
  | 'cerrar_sala'
  | 'reabrir_sala'

/** Lo que el panel usa de GET /api/tablero (ver mocks/GET_api_tablero.json). */
export interface RondaVivo {
  ronda: number
  n_votos: number
  promedios: Record<string, number> | null
  /** Conteo de 1, 3, 5, 7 y 9 por criterio (bloque «Cómo votó»); null sin votos o bajo el mínimo. */
  distribucion?: Record<string, Record<'1' | '3' | '5' | '7' | '9', number>> | null
  /** R4_CONTRATO C1: eje X + eje Y, calculado en el servidor; null sin votos o bajo el mínimo. */
  total?: number | null
  bajo_minimo?: boolean
}

export interface TableroResumen {
  version: string
  preliminar?: boolean
  alcance: { tipo: 'sala' | 'mesa'; mesa_id?: string | null; mesa_nombre?: string | null }
  criterios: { id: string; nombre: string }[]
  proyectos_vivos: { id: string; nombre: string; rondas: RondaVivo[] }[]
  minimo_votos?: number
}
