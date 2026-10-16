// Máquina de estados de la sala (SPEC §3), configuración (§6) y cierres programados (§5).
// preparada → inscripcion → r1_abierta → r1_cerrada → r2_abierta → r2_cerrada → cerrada
import { type Db, ejecutar, todos, transaccion } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { type EstadoSala, type SalaFila, cargarSala, registrarEvento, tocar } from './salas.js'
import { isoUtc } from './util.js'

export const ACCIONES = [
  'abrir_inscripcion',
  'abrir_ronda_1',
  'cerrar_ronda_1',
  'abrir_ronda_2',
  'cerrar_ronda_2',
  'reabrir_ronda',
  'reiniciar_ronda',
  'cerrar_sala',
  'reabrir_sala',
] as const
export type Accion = (typeof ACCIONES)[number]

interface Transicion {
  desde: EstadoSala[]
  /** Estado destino (o función si depende de la sala). */
  hacia: EstadoSala | ((s: SalaFila) => EstadoSala)
  ronda?: number
  tipo: string
}

const TRANSICIONES: Record<Exclude<Accion, 'reiniciar_ronda'>, Transicion> = {
  abrir_inscripcion: { desde: ['preparada'], hacia: 'inscripcion', tipo: 'inscripcion_abierta' },
  abrir_ronda_1: { desde: ['preparada', 'inscripcion'], hacia: 'r1_abierta', ronda: 1, tipo: 'ronda_abierta' },
  cerrar_ronda_1: { desde: ['r1_abierta'], hacia: 'r1_cerrada', tipo: 'ronda_cerrada' },
  abrir_ronda_2: { desde: ['r1_cerrada'], hacia: 'r2_abierta', ronda: 2, tipo: 'ronda_abierta' },
  cerrar_ronda_2: { desde: ['r2_abierta'], hacia: 'r2_cerrada', tipo: 'ronda_cerrada' },
  reabrir_ronda: { desde: ['r1_cerrada', 'r2_cerrada'], hacia: (s) => (s.estado === 'r1_cerrada' ? 'r1_abierta' : 'r2_abierta'), tipo: 'ronda_reabierta' },
  cerrar_sala: { desde: ['preparada', 'inscripcion', 'r1_abierta', 'r1_cerrada', 'r2_abierta', 'r2_cerrada'], hacia: 'cerrada', tipo: 'sala_cerrada' },
  reabrir_sala: {
    desde: ['cerrada'],
    hacia: (s) => (s.ronda_actual >= 2 ? 'r2_cerrada' : s.ronda_actual === 1 ? 'r1_cerrada' : 'inscripcion'),
    tipo: 'sala_reabierta',
  },
}

const NOMBRE_ESTADO: Record<EstadoSala, string> = {
  preparada: 'preparada',
  inscripcion: 'en inscripción',
  r1_abierta: 'con la ronda 1 abierta',
  r1_cerrada: 'con la ronda 1 cerrada',
  r2_abierta: 'con la ronda 2 abierta',
  r2_cerrada: 'con la ronda 2 cerrada',
  cerrada: 'cerrada',
}

export interface OpcionesAccion {
  /** Solo para reiniciar_ronda: qué ronda reiniciar (por defecto la actual). */
  ronda?: number
}

/** Aplica una acción del admin (o del programador). 409 TRANSICION_INVALIDA si no aplica. */
export function aplicarAccion(db: Db, salaId: string, accion: string, ahora: number, por: string, op: OpcionesAccion = {}): SalaFila {
  if (!(ACCIONES as readonly string[]).includes(accion)) {
    throw new ErrorApi(422, 'ACCION_INVALIDA', `La acción "${accion}" no existe.`)
  }
  return transaccion(db, () => {
    const s = cargarSala(db, salaId)
    if (accion === 'reiniciar_ronda') {
      const ronda = op.ronda ?? s.ronda_actual
      if (s.estado === 'cerrada' || ronda < 1 || ronda > s.ronda_actual) {
        throw new ErrorApi(409, 'TRANSICION_INVALIDA', 'No hay votos de esa ronda para reiniciar en el estado actual de la sala.')
      }
      const borrados = ejecutar(db, 'DELETE FROM votos WHERE sala_id = ? AND ronda = ?', s.id, ronda).changes
      registrarEvento(db, s.id, ahora, 'reinicio', por, { ronda, votos_borrados: Number(borrados) })
      tocar(db, s.id)
      return cargarSala(db, s.id)
    }
    const t = TRANSICIONES[accion as Exclude<Accion, 'reiniciar_ronda'>]
    if (!t.desde.includes(s.estado)) {
      throw new ErrorApi(409, 'TRANSICION_INVALIDA', `No se puede ${accion.replace(/_/g, ' ')}: la sala está ${NOMBRE_ESTADO[s.estado]}.`)
    }
    const hacia = typeof t.hacia === 'function' ? t.hacia(s) : t.hacia
    const sets: string[] = ['estado = ?']
    const params: unknown[] = [hacia]
    if (t.ronda) {
      sets.push('ronda_actual = ?')
      params.push(t.ronda)
    }
    // Al abrir R2 se revelan las 6 hojas (el admin puede apagarlo después).
    if (accion === 'abrir_ronda_2') sets.push('revelar_hojas = 1')
    // Una ronda cerrada (a mano o programada) consume el cierre programado de ronda.
    if (hacia.endsWith('_cerrada') || hacia === 'cerrada') sets.push('cierre_programado_ronda_at = NULL')
    if (hacia === 'cerrada') sets.push('cierre_programado_sala_at = NULL')
    ejecutar(db, `UPDATE salas SET ${sets.join(', ')} WHERE id = ?`, ...params, s.id)
    registrarEvento(db, s.id, ahora, t.tipo, por, { accion, desde: s.estado, hacia, ronda: t.ronda ?? (s.ronda_actual || undefined) })
    tocar(db, s.id)
    return cargarSala(db, s.id)
  })
}

// --- Configuración (§6) -----------------------------------------------------

export interface CambiosConfig {
  alcance_resultados?: unknown
  vista_participante?: unknown
  revelar_hojas?: unknown
  cierre_programado_ronda_at?: unknown
  cierre_programado_sala_at?: unknown
}

function fechaOpcional(campo: string, v: unknown): string | null {
  if (v === null || v === '') return null
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) {
    throw new ErrorApi(422, 'CONFIG_INVALIDA', `${campo} debe ser una fecha ISO-8601 con zona o null.`)
  }
  return isoUtc(Date.parse(v))
}

export function cambiarConfig(db: Db, salaId: string, cambios: CambiosConfig, ahora: number, por: string): SalaFila {
  const sets: string[] = []
  const params: unknown[] = []
  const detalle: Record<string, unknown> = {}
  const poner = (col: string, v: unknown) => {
    sets.push(`${col} = ?`)
    params.push(v)
    detalle[col] = v
  }
  if (cambios.alcance_resultados !== undefined) {
    if (!['mesa', 'sala'].includes(cambios.alcance_resultados as string)) throw new ErrorApi(422, 'CONFIG_INVALIDA', 'alcance_resultados debe ser "mesa" o "sala".')
    poner('alcance_resultados', cambios.alcance_resultados)
  }
  if (cambios.vista_participante !== undefined) {
    if (!['registrado', 'en_vivo'].includes(cambios.vista_participante as string)) throw new ErrorApi(422, 'CONFIG_INVALIDA', 'vista_participante debe ser "registrado" o "en_vivo".')
    poner('vista_participante', cambios.vista_participante)
  }
  if (cambios.revelar_hojas !== undefined) {
    if (typeof cambios.revelar_hojas !== 'boolean') throw new ErrorApi(422, 'CONFIG_INVALIDA', 'revelar_hojas debe ser true o false.')
    poner('revelar_hojas', cambios.revelar_hojas ? 1 : 0)
  }
  if (cambios.cierre_programado_ronda_at !== undefined) poner('cierre_programado_ronda_at', fechaOpcional('cierre_programado_ronda_at', cambios.cierre_programado_ronda_at))
  if (cambios.cierre_programado_sala_at !== undefined) poner('cierre_programado_sala_at', fechaOpcional('cierre_programado_sala_at', cambios.cierre_programado_sala_at))
  if (sets.length === 0) throw new ErrorApi(422, 'CONFIG_INVALIDA', 'No llegó ningún cambio de configuración.')

  return transaccion(db, () => {
    const s = cargarSala(db, salaId)
    ejecutar(db, `UPDATE salas SET ${sets.join(', ')} WHERE id = ?`, ...params, s.id)
    registrarEvento(db, s.id, ahora, 'config', por, detalle)
    tocar(db, s.id)
    return cargarSala(db, s.id)
  })
}

// --- Cierres programados (§5) -------------------------------------------------

/**
 * Aplica los cierres programados vencidos de todas las salas. Se llama antes de cada
 * petición (chequeo perezoso) y cada 15 s. Devuelve cuántos cierres aplicó y qué salas quedaron cerradas.
 */
export function aplicarCierresProgramados(db: Db, ahora: number): { aplicados: number; salasCerradas: string[] } {
  const corte = isoUtc(ahora)
  const vencidas = todos<SalaFila>(
    db,
    `SELECT * FROM salas
      WHERE (cierre_programado_ronda_at IS NOT NULL AND cierre_programado_ronda_at <= ?)
         OR (cierre_programado_sala_at IS NOT NULL AND cierre_programado_sala_at <= ?)`,
    corte,
    corte,
  )
  let aplicados = 0
  const salasCerradas: string[] = []
  for (const v of vencidas) {
    transaccion(db, () => {
      const s = cargarSala(db, v.id)
      if (s.cierre_programado_ronda_at && s.cierre_programado_ronda_at <= corte) {
        const accion = s.estado === 'r1_abierta' ? 'cerrar_ronda_1' : s.estado === 'r2_abierta' ? 'cerrar_ronda_2' : null
        if (accion) {
          aplicarAccion(db, s.id, accion, ahora, 'programado')
          registrarEvento(db, s.id, ahora, 'cierre_programado', 'programado', { accion, programado_at: s.cierre_programado_ronda_at })
          aplicados++
        } else {
          // Venció sin ronda abierta: se descarta para que no cierre la próxima ronda de golpe.
          ejecutar(db, 'UPDATE salas SET cierre_programado_ronda_at = NULL WHERE id = ?', s.id)
          registrarEvento(db, s.id, ahora, 'cierre_programado_descartado', 'programado', { programado_at: s.cierre_programado_ronda_at, estado: s.estado })
          tocar(db, s.id)
        }
      }
      const s2 = cargarSala(db, v.id)
      if (s2.cierre_programado_sala_at && s2.cierre_programado_sala_at <= corte && s2.estado !== 'cerrada') {
        aplicarAccion(db, s2.id, 'cerrar_sala', ahora, 'programado')
        salasCerradas.push(s2.id)
        registrarEvento(db, s2.id, ahora, 'cierre_programado', 'programado', { accion: 'cerrar_sala', programado_at: s2.cierre_programado_sala_at })
        aplicados++
      } else if (s2.cierre_programado_sala_at && s2.cierre_programado_sala_at <= corte) {
        ejecutar(db, 'UPDATE salas SET cierre_programado_sala_at = NULL WHERE id = ?', s2.id)
        tocar(db, s2.id)
      }
    })
  }
  return { aplicados, salasCerradas }
}
