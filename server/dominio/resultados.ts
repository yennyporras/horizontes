import { type Db, todos } from '../db/index.js'
import { CRITERIOS, type Entradas, type Pesos, agregar, calcularPunto } from '../../shared/motor/motor.js'
import type { CriterioSemilla } from './semilla.js'
import { type MesaFila, type SalaFila, mesasDeSala } from './salas.js'
import { isoEnZona } from './util.js'

export interface Contenido {
  caso: { titulo: string; descripcion_md: string; situacion_md: string }
  criterios: CriterioSemilla[]
  pesos: Pesos
  ejes: Record<string, unknown>
  grafico: Record<string, unknown>
  escala: number[]
}

export interface ProyectoFila {
  id: string
  nombre: string
  tipo: string
  sector: string
  descripcion: string
  modo: 'fijo' | 'vivo'
  orden: number
  tam: number
  inputs_json: string | null
}

// Los proyectos no cambian después de crear la sala y el contenido solo al editar una rúbrica (que borra su caché):
// se cachean por BD y sala.
const cacheContenido = new WeakMap<Db, Map<string, Contenido>>()
const cacheProyectos = new WeakMap<Db, Map<string, ProyectoFila[]>>()

function mapaDe<T>(w: WeakMap<Db, Map<string, T>>, db: Db) {
  let m = w.get(db)
  if (!m) w.set(db, (m = new Map()))
  return m
}

export function contenido(db: Db, salaId: string): Contenido {
  const m = mapaDe(cacheContenido, db)
  let c = m.get(salaId)
  if (!c) {
    const f = todos<{ caso_json: string; criterios_json: string; pesos_json: string; grafico_json: string }>(
      db,
      'SELECT * FROM contenido_sala WHERE sala_id = ?',
      salaId,
    )[0]
    const g = JSON.parse(f.grafico_json)
    c = { caso: JSON.parse(f.caso_json), criterios: JSON.parse(f.criterios_json), pesos: JSON.parse(f.pesos_json), ejes: g.ejes, grafico: g.grafico, escala: g.escala }
    m.set(salaId, c)
  }
  return c
}

/** Descarta el contenido cacheado de la sala (después de cambiarlo en contenido_sala). */
export function olvidarContenido(db: Db, salaId: string) {
  mapaDe(cacheContenido, db).delete(salaId)
}

export function proyectos(db: Db, salaId: string): ProyectoFila[] {
  const m = mapaDe(cacheProyectos, db)
  let p = m.get(salaId)
  if (!p) {
    p = todos<ProyectoFila>(db, 'SELECT * FROM proyectos WHERE sala_id = ? ORDER BY orden', salaId)
    m.set(salaId, p)
  }
  return p
}

export const vivos = (db: Db, salaId: string) => proyectos(db, salaId).filter((p) => p.modo === 'vivo')

// --- Rondas -----------------------------------------------------------------

export const rondaAbierta = (s: Pick<SalaFila, 'estado'>): 1 | 2 | null => (s.estado === 'r1_abierta' ? 1 : s.estado === 'r2_abierta' ? 2 : null)

export function rondaCerrada(s: Pick<SalaFila, 'estado' | 'ronda_actual'>, r: number): boolean {
  if (r === 1) return ['r1_cerrada', 'r2_abierta', 'r2_cerrada'].includes(s.estado) || (s.estado === 'cerrada' && s.ronda_actual >= 1)
  if (r === 2) return s.estado === 'r2_cerrada' || (s.estado === 'cerrada' && s.ronda_actual >= 2)
  return false
}

/** Ronda de referencia para progreso: la actual, o 1 si aún no empieza. */
export const rondaReferencia = (s: Pick<SalaFila, 'ronda_actual'>) => Math.max(1, s.ronda_actual)

// --- Progreso y precierre (§4) ------------------------------------------------

export interface ProgresoMesa {
  mesa_id: string
  nombre: string
  inscritos: number
  completos: number
  precierre: boolean
}
export interface Progreso {
  ronda: number
  inscritos: number
  completos: number
  precierre: boolean
  por_mesa: ProgresoMesa[]
}

export function progreso(db: Db, sala: SalaFila, mesas: MesaFila[] = mesasDeSala(db, sala.id)): Progreso {
  const ronda = rondaReferencia(sala)
  const nVivos = vivos(db, sala.id).length
  const filas = todos<{ mesa_id: string; inscritos: number; completos: number }>(
    db,
    `SELECT p.mesa_id,
            COUNT(*) AS inscritos,
            SUM(CASE WHEN (SELECT COUNT(*) FROM votos v JOIN proyectos pr ON pr.sala_id = v.sala_id AND pr.id = v.proyecto_id AND pr.modo = 'vivo'
                           WHERE v.participante_id = p.id AND v.ronda = ?) >= ? THEN 1 ELSE 0 END) AS completos
       FROM participantes p
      WHERE p.sala_id = ? AND p.activo = 1
      GROUP BY p.mesa_id`,
    ronda,
    nVivos,
    sala.id,
  )
  const porId = new Map(filas.map((f) => [f.mesa_id, f]))
  const abierta = rondaAbierta(sala) !== null
  const por_mesa = mesas.map((m) => {
    const f = porId.get(m.id)
    const inscritos = Number(f?.inscritos ?? 0)
    const completos = Number(f?.completos ?? 0)
    return { mesa_id: m.id, nombre: m.nombre, inscritos, completos, precierre: abierta && inscritos > 0 && completos === inscritos }
  })
  const conGente = por_mesa.filter((m) => m.inscritos > 0)
  return {
    ronda,
    inscritos: por_mesa.reduce((a, m) => a + m.inscritos, 0),
    completos: por_mesa.reduce((a, m) => a + m.completos, 0),
    precierre: abierta && conGente.length > 0 && conGente.every((m) => m.precierre),
    por_mesa,
  }
}

// --- Tablero / resultados (§7) --------------------------------------------------

export type Alcance = { tipo: 'sala' } | { tipo: 'mesa'; mesa: MesaFila }

/**
 * Votos mínimos de un proyecto en un alcance y ronda para mostrar promedios, distribución, punto y total (privacidad).
 * 3 y no 2: con 2 votos, quien votó despeja la respuesta del otro (acta del 16-oct P6).
 */
export const MINIMO_VOTOS = 3

function votosPorProyecto(db: Db, salaId: string, ronda: number, mesaId?: string): Map<string, Entradas[]> {
  const columnas = CRITERIOS.map((c) => `v.${c}`).join(', ')
  const filtroMesa = mesaId ? 'AND p.mesa_id = ?' : ''
  const params: unknown[] = mesaId ? [salaId, ronda, mesaId] : [salaId, ronda]
  const filas = todos<Entradas & { proyecto_id: string }>(
    db,
    `SELECT v.proyecto_id, ${columnas}
       FROM votos v JOIN participantes p ON p.id = v.participante_id
      WHERE v.sala_id = ? AND v.ronda = ? AND p.activo = 1 ${filtroMesa}`,
    ...params,
  )
  const m = new Map<string, Entradas[]>()
  for (const f of filas) {
    const { proyecto_id, ...e } = f
    if (!m.has(proyecto_id)) m.set(proyecto_id, [])
    m.get(proyecto_id)!.push(e as Entradas)
  }
  return m
}

export interface OpcionesTablero {
  alcance: Alcance
  /** Rondas a incluir en proyectos_vivos[].rondas (las demás no se envían). */
  rondas: number[]
  preliminar: boolean
  sufijoVersion?: string
}

// Caché de tableros por (sala, version, alcance, rondas, preliminar): con 40 celulares y el proyector
// haciendo polling, la mayoría de lecturas caen entre dos escrituras. `version` sube con cada escritura.
const cacheTablero = new WeakMap<Db, Map<string, ReturnType<typeof calcularTablero>>>()

export function construirTablero(db: Db, sala: SalaFila, op: OpcionesTablero) {
  const alcance = op.alcance.tipo === 'mesa' ? op.alcance.mesa.id : 'sala'
  const clave = `${sala.id}|${sala.version}|${alcance}|${op.rondas.join(',')}|${op.preliminar}|${op.sufijoVersion ?? ''}`
  const m = mapaDe(cacheTablero, db)
  let t = m.get(clave)
  if (!t) {
    if (m.size > 500) m.clear()
    t = calcularTablero(db, sala, op)
    m.set(clave, t)
  }
  return t
}

function calcularTablero(db: Db, sala: SalaFila, op: OpcionesTablero) {
  const c = contenido(db, sala.id)
  const prs = proyectos(db, sala.id)
  const mesas = mesasDeSala(db, sala.id)
  const prog = progreso(db, sala, mesas)
  const mesaId = op.alcance.tipo === 'mesa' ? op.alcance.mesa.id : undefined
  const porRonda = new Map(op.rondas.map((r) => [r, votosPorProyecto(db, sala.id, r, mesaId)]))

  return {
    version: `v-${sala.version}${op.sufijoVersion ?? ''}`,
    sala: { id: sala.id, nombre: sala.nombre, estado: sala.estado, ronda_actual: sala.ronda_actual },
    alcance:
      op.alcance.tipo === 'mesa'
        ? { tipo: 'mesa', mesa_id: op.alcance.mesa.id, mesa_nombre: op.alcance.mesa.nombre }
        : { tipo: 'sala', mesa_id: null, mesa_nombre: null },
    config: configPublica(sala),
    progreso: { inscritos: prog.inscritos, completos: prog.completos, precierre: prog.precierre, por_mesa: prog.por_mesa },
    ejes: c.ejes,
    grafico: c.grafico,
    criterios: c.criterios.map((k) => ({ id: k.id, nombre: k.nombre })),
    proyectos_fijos: prs
      .filter((p) => p.modo === 'fijo')
      .map((p) => {
        const e = JSON.parse(p.inputs_json ?? '{}') as Entradas
        return { id: p.id, nombre: p.nombre, sector: p.sector, modo: 'fijo', tam: p.tam, ...calcularPunto(e, c.pesos) }
      }),
    proyectos_vivos: prs
      .filter((p) => p.modo === 'vivo')
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        sector: p.sector,
        modo: 'vivo',
        tam: p.tam,
        rondas: op.rondas.map((r) => {
          const a = agregar(porRonda.get(r)?.get(p.id) ?? [], c.pesos)
          if (!a) return { ronda: r, n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null }
          // SPEC §7: nunca respuestas individuales. Con pocos votos en el alcance, el promedio delata cada respuesta.
          if (a.n_votos < MINIMO_VOTOS) {
            return { ronda: r, n_votos: a.n_votos, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null, bajo_minimo: true }
          }
          return { ronda: r, n_votos: a.n_votos, promedios: a.promedios, distribucion: a.distribucion, t2m: a.t2m, eje_x: a.eje_x, eje_y: a.eje_y, total: a.total }
        }),
      })),
    preliminar: op.preliminar,
    minimo_votos: MINIMO_VOTOS,
  }
}

export function configPublica(s: SalaFila) {
  return {
    alcance_resultados: s.alcance_resultados,
    vista_participante: s.vista_participante,
    revelar_hojas: Boolean(s.revelar_hojas),
    cierre_programado_ronda_at: isoEnZona(s.cierre_programado_ronda_at, s.zona_horaria),
    cierre_programado_sala_at: isoEnZona(s.cierre_programado_sala_at, s.zona_horaria),
    pais: s.pais,
    zona_horaria: s.zona_horaria,
  }
}
