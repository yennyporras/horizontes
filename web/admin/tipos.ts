// Tipos del contrato (docs/CONTRATO_API.md). Lo nuevo se toma de web/shared/api/contrato.ts; lo anterior sigue aquí.
import type { DetalleSala as DetalleContrato, Config, PreguntaGuiada } from '../shared/api/contrato'

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

// Config, programación (C19-4), modo de preguntas (C19-5) y respuestas por persona (C19-3): tipos del contrato.
export type { Config as ConfigSala, ModoPreguntas, PreguntaGuiada, RespuestaPersona } from '../shared/api/contrato'

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
  sala: SalaResumen & { config: Config; url_tablero?: string; pregunta_guiada?: PreguntaGuiada | null }
  mesas: Mesa[]
  participantes: Participante[]
  eventos: Evento[]
  admin_actual: AdminYo
  servidor_at?: DetalleContrato['servidor_at']
  base_url?: DetalleContrato['base_url']
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
