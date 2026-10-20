// Tipos del tablero: alias sobre el contrato compartido (web/shared/api/contrato.ts).
// GET /api/tablero/{salaId} y GET /api/resultados tienen la misma forma (`Tablero`).
// QA por roles (20-oct): `oculta`, `convergencia` y `convergencia_alcance` son campos opcionales del contrato nuevo.
// Se declaran aquí como extensión aditiva para que el tablero los lea aunque el contrato compartido aún no los traiga.
import type { CriterioId, EstadoSala, RondaVivo as RondaContrato, Rubrica, Tablero } from '../shared/api/contrato'

export type { CriterioId, EstadoSala }

/**
 * Una ronda de un proyecto vivo. `oculta`: la ronda 1 sigue abierta y el alcance no está en precierre; el servidor
 * manda `n_votos` y deja en null promedios, distribución y ejes (decisión de Paola del 20-oct).
 */
export type RondaVivo = RondaContrato & { oculta?: true }

/** Convergencia R1 → R2 de un proyecto, calculada en el servidor (solo con R1 y R2 visibles). */
export interface Convergencia {
  dispersion_r1: number
  dispersion_r2: number
  reduccion_pct: number
  criterio_mayor_cambio: CriterioId
  delta_x: number
  delta_y: number
}

export type ProyectoVivo = Omit<Tablero['proyectos_vivos'][number], 'rondas'> & { rondas: RondaVivo[]; convergencia?: Convergencia }

export type DatosTablero = Omit<Tablero, 'proyectos_vivos'> & {
  proyectos_vivos: ProyectoVivo[]
  /** Promedio de las reducciones de dispersión de los vivos del alcance. */
  convergencia_alcance?: { reduccion_pct: number }
}
export type ProgresoMesa = Tablero['progreso']['por_mesa'][number]

export type Vista = 1 | 2 | 'comparacion'

/** El tablero trae de cada criterio solo id y nombre; si un día trae la pregunta y la rúbrica, la pregunta guiada las muestra. */
export type CriterioTablero = Tablero['criterios'][number] & { pregunta?: string; rubrica?: Rubrica[] }
