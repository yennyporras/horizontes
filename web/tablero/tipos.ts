// Tipos del tablero: alias sobre el contrato compartido de T1 (web/shared/api/contrato.ts).
// GET /api/tablero/{salaId} y GET /api/resultados tienen la misma forma (`Tablero`).
import type { CriterioId, EstadoSala, RondaVivo, Rubrica, Tablero } from '../shared/api/contrato'

export type { CriterioId, EstadoSala, RondaVivo }

export type DatosTablero = Tablero
export type ProyectoVivo = Tablero['proyectos_vivos'][number]
export type ProgresoMesa = Tablero['progreso']['por_mesa'][number]

export type Vista = 1 | 2 | 'comparacion'

/** El tablero trae de cada criterio solo id y nombre; si un día trae la pregunta y la rúbrica, la pregunta guiada las muestra. */
export type CriterioTablero = Tablero['criterios'][number] & { pregunta?: string; rubrica?: Rubrica[] }
