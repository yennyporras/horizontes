// Tipos de GET /api/tablero/{salaId} y GET /api/resultados (misma forma). Ver mocks/GET_api_tablero.json.
// Cuando T1 publique el cliente generado en web/shared/api/, estos tipos se reemplazan por los suyos.

export type EstadoSala = 'preparada' | 'inscripcion' | 'r1_abierta' | 'r1_cerrada' | 'r2_abierta' | 'r2_cerrada' | 'cerrada'

export type CriterioId =
  | 'alistamiento_tecnico'
  | 'conocimiento_cliente'
  | 'regulacion'
  | 'capacidades_organizacionales'
  | 'alineacion_core'
  | 'inversion_requerida'

export type ValorEscala = '1' | '3' | '5' | '7' | '9'

export interface Eje {
  titulo: string
  subtitulo?: string
  min: number
  max: number
}

export interface RondaVivo {
  ronda: number
  n_votos: number
  promedios: Partial<Record<CriterioId, number | null>> | null
  distribucion: Partial<Record<CriterioId, Partial<Record<ValorEscala, number>>>> | null
  t2m: number | null
  eje_x: number | null
  eje_y: number | null
}

export interface ProyectoFijo {
  id: string
  nombre: string
  sector?: string
  modo: 'fijo'
  tam: number
  t2m: number
  eje_x: number
  eje_y: number
}

export interface ProyectoVivo {
  id: string
  nombre: string
  sector?: string
  modo: 'vivo'
  tam: number
  rondas: RondaVivo[]
}

export interface ProgresoMesa {
  mesa_id: string
  nombre: string
  inscritos: number
  completos: number
  precierre: boolean
}

export interface DatosTablero {
  version: string | number
  sala: { id: string; nombre: string; estado: EstadoSala; ronda_actual: number | null }
  alcance: { tipo: 'sala' | 'mesa'; mesa_id?: string | null; mesa_nombre?: string | null }
  config?: Record<string, unknown>
  progreso: {
    inscritos: number
    completos: number
    precierre: boolean
    por_mesa: ProgresoMesa[]
  }
  ejes: { x: Eje; y: Eje }
  grafico?: {
    titulo?: string
    horizontes?: { id: string; radio: number | null }[]
    etiquetas_horizonte?: Record<string, [number, number]>
    [k: string]: unknown
  }
  criterios: { id: CriterioId; nombre: string }[]
  proyectos_fijos: ProyectoFijo[]
  proyectos_vivos: ProyectoVivo[]
  preliminar: boolean
}

export type Vista = 1 | 2 | 'comparacion'
