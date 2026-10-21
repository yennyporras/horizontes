// Consolidado en vivo de 3 en 3 (D2, 20-oct; S-2 de la auditoría).
// Desde el 21-oct (decisión de Paola) el umbral es 1 en todas las salas: la foto se renueva con cada voto.
// Con la ronda abierta, el agregado de cada alcance (la sala o una mesa), ronda y proyecto se publica como una foto
// congelada: se renueva solo cuando al menos VOTOS_POR_ACTUALIZACION personas distintas votaron, cambiaron su voto o
// salieron del alcance desde la foto anterior. Así, entre dos fotos seguidas nunca cambia un solo voto y comparar
// consultas antes y después de un voto ya no lo despeja. Con la ronda cerrada se publica el resultado exacto.
import { type Db, ejecutar, todos, uno } from '../db/index.js'
import { type Agregado, CRITERIOS, type Entradas, type Pesos, agregar } from '../../shared/motor/motor.js'

/** Personas que deben haber votado o cambiado su voto desde la última foto para renovarla. */
export const VOTOS_POR_ACTUALIZACION = 3

export interface VotoAlcance {
  participante_id: string
  entradas: Entradas
}

/** Votos que cuentan (participantes activos) de una ronda por proyecto, de toda la sala o de una mesa. */
export function votosDelAlcance(db: Db, salaId: string, ronda: number, mesaId?: string): Map<string, VotoAlcance[]> {
  const columnas = CRITERIOS.map((c) => `v.${c}`).join(', ')
  const filtroMesa = mesaId ? 'AND p.mesa_id = ?' : ''
  const params: unknown[] = mesaId ? [salaId, ronda, mesaId] : [salaId, ronda]
  const filas = todos<Entradas & { proyecto_id: string; participante_id: string }>(
    db,
    `SELECT v.proyecto_id, v.participante_id, ${columnas}
       FROM votos v JOIN participantes p ON p.id = v.participante_id
      WHERE v.sala_id = ? AND v.ronda = ? AND p.activo = 1 ${filtroMesa}
      ORDER BY v.participante_id`,
    ...params,
  )
  const m = new Map<string, VotoAlcance[]>()
  for (const { proyecto_id, participante_id, ...e } of filas) {
    if (!m.has(proyecto_id)) m.set(proyecto_id, [])
    m.get(proyecto_id)!.push({ participante_id, entradas: e as Entradas })
  }
  return m
}

interface FotoFila {
  n_votos: number
  agregado_json: string | null
  huellas_json: string
}

export interface Publicado {
  /** Agregado publicable (o null si no hay foto con votos). */
  agregado: Agregado | null
  /** Votos que respaldan lo publicado (de la foto, o el conteo real si todavía no hay foto). */
  n_votos: number
}

const huellas = (votos: VotoAlcance[]) => Object.fromEntries(votos.map((v) => [v.participante_id, CRITERIOS.map((c) => v.entradas[c]).join('')]))

/** Personas cuyo voto es distinto entre dos fotos: nuevas, con otro voto o que ya no están. */
function cambios(actual: Record<string, string>, previo: Record<string, string>): number {
  let n = 0
  for (const k of new Set([...Object.keys(actual), ...Object.keys(previo)])) if (actual[k] !== previo[k]) n++
  return n
}

function guardarFoto(db: Db, clave: [string, string, number, string], votos: VotoAlcance[], a: Agregado | null, h: string, versionSala: number) {
  ejecutar(
    db,
    `INSERT INTO fotos_agregado (sala_id, alcance, ronda, proyecto_id, n_votos, agregado_json, huellas_json, version_sala) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (sala_id, alcance, ronda, proyecto_id) DO UPDATE SET
       n_votos = excluded.n_votos, agregado_json = excluded.agregado_json, huellas_json = excluded.huellas_json, version_sala = excluded.version_sala`,
    ...clave,
    votos.length,
    a ? JSON.stringify(a) : null,
    h,
    versionSala,
  )
}

export interface ClaveFoto {
  salaId: string
  /** 'sala' o el id de la mesa. */
  alcance: string
  ronda: number
  proyectoId: string
  versionSala: number
  /** Votantes distintos que renuevan la foto. Por defecto VOTOS_POR_ACTUALIZACION; desde el 21-oct las vistas pasan 1 en todas las salas. */
  umbral?: number
}

/**
 * Lo que se publica para un alcance, ronda y proyecto. `exacto` (ronda cerrada): el agregado real, que además queda como
 * foto para que, si la ronda se reabre, la siguiente cuente los cambios desde lo que ya se mostró.
 */
export function agregadoPublicado(db: Db, k: ClaveFoto, votos: VotoAlcance[], pesos: Pesos, exacto: boolean): Publicado {
  const clave: [string, string, number, string] = [k.salaId, k.alcance, k.ronda, k.proyectoId]
  const actual = huellas(votos)
  const h = JSON.stringify(actual)
  const f = uno<FotoFila>(db, 'SELECT n_votos, agregado_json, huellas_json FROM fotos_agregado WHERE sala_id = ? AND alcance = ? AND ronda = ? AND proyecto_id = ?', ...clave)
  if (exacto || cambios(actual, f ? JSON.parse(f.huellas_json) : {}) >= (k.umbral ?? VOTOS_POR_ACTUALIZACION)) {
    const a = agregar(
      votos.map((v) => v.entradas),
      pesos,
    )
    if (!f || f.huellas_json !== h) guardarFoto(db, clave, votos, a, h, k.versionSala)
    return { agregado: a, n_votos: votos.length }
  }
  // Sin foto todavía: nada que mostrar salvo el conteo (sin valores no despeja ningún voto).
  if (!f) return { agregado: null, n_votos: votos.length }
  return { agregado: f.agregado_json ? (JSON.parse(f.agregado_json) as Agregado) : null, n_votos: f.n_votos }
}

/** Deja como foto el resultado exacto de la ronda en todos los alcances (al reabrirla: es lo último que se mostró). */
export function fijarFotosExactas(db: Db, salaId: string, ronda: number, versionSala: number, pesos: Pesos, proyectos: string[], mesas: string[]) {
  for (const alcance of ['sala', ...mesas]) {
    const porProyecto = votosDelAlcance(db, salaId, ronda, alcance === 'sala' ? undefined : alcance)
    for (const proyectoId of proyectos) {
      agregadoPublicado(db, { salaId, alcance, ronda, proyectoId, versionSala }, porProyecto.get(proyectoId) ?? [], pesos, true)
    }
  }
}

/** Borra las fotos de una ronda (reiniciar ronda) o de toda la sala (reinicio limpio). */
export function borrarFotos(db: Db, salaId: string, ronda?: number) {
  if (ronda === undefined) ejecutar(db, 'DELETE FROM fotos_agregado WHERE sala_id = ?', salaId)
  else ejecutar(db, 'DELETE FROM fotos_agregado WHERE sala_id = ? AND ronda = ?', salaId, ronda)
}
