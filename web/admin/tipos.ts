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

export interface ConfigSala {
  alcance_resultados: 'mesa' | 'sala'
  vista_participante: 'registrado' | 'en_vivo'
  revelar_hojas: boolean
  cierre_programado_ronda_at: string | null
  cierre_programado_sala_at: string | null
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
  sala: SalaResumen & { config: ConfigSala; url_tablero?: string }
  mesas: Mesa[]
  participantes: Participante[]
  eventos: Evento[]
  admin_actual: AdminYo
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
  t2m: number | null
  eje_x: number | null
  eje_y: number | null
}

export interface TableroResumen {
  version: string
  preliminar?: boolean
  alcance: { tipo: 'sala' | 'mesa'; mesa_id?: string; mesa_nombre?: string }
  proyectos_vivos: { id: string; nombre: string; rondas: RondaVivo[] }[]
}
