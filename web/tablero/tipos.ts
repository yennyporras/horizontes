// Tipos del tablero: alias sobre el contrato compartido de T1 (web/shared/api/contrato.ts).
// GET /api/tablero/{salaId} y GET /api/resultados tienen la misma forma (`Tablero`).
import type { CriterioId, Distribucion, EstadoSala, RondaVivo, Tablero } from '../shared/api/contrato'

export type { CriterioId, EstadoSala, RondaVivo }

export type DatosTablero = Tablero
export type ValorEscala = keyof Distribucion
export type ProyectoFijo = Tablero['proyectos_fijos'][number]
export type ProyectoVivo = Tablero['proyectos_vivos'][number]
export type ProgresoMesa = Tablero['progreso']['por_mesa'][number]
export type Eje = Tablero['ejes']['x']

export type Vista = 1 | 2 | 'comparacion'
