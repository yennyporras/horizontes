// Tipos del tablero: alias sobre el contrato compartido de T1 (web/shared/api/contrato.ts).
// GET /api/tablero/{salaId} y GET /api/resultados tienen la misma forma (`Tablero`).
import type { CriterioId, EstadoSala, RondaVivo as RondaContrato, Tablero } from '../shared/api/contrato'

export type { CriterioId, EstadoSala }

/**
 * R4_CONTRATO C1: `total` = eje X + eje Y, calculado en el servidor (null si no hay votos o bajo el
 * mínimo). Opcional y con el mismo nombre con que T1 lo publica en el contrato: al integrarlo, esta
 * intersección no cambia nada.
 */
export type RondaVivo = RondaContrato & { total?: number | null }
export type ProyectoVivo = Omit<Tablero['proyectos_vivos'][number], 'rondas'> & { rondas: RondaVivo[] }
export type DatosTablero = Omit<Tablero, 'proyectos_vivos'> & { proyectos_vivos: ProyectoVivo[] }
export type ProgresoMesa = Tablero['progreso']['por_mesa'][number]

export type Vista = 1 | 2 | 'comparacion'
