import { type Db, todos } from '../db/index.js'
import { CRITERIOS, type CriterioId, type Distribucion, type Entradas, type Pesos, calcularPunto } from '../../shared/motor/motor.js'
import { VOTOS_POR_ACTUALIZACION, agregadoPublicado, votosDelAlcance } from './fotos.js'
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

/** Ronda a la que apunta el alias `cierre_programado_ronda_at`: la abierta o, si no hay, la siguiente. */
export const rondaDelAlias = (s: Pick<SalaFila, 'estado' | 'ronda_actual'>): 1 | 2 => (s.estado === 'r1_abierta' || s.ronda_actual === 0 ? 1 : 2)

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

export interface OpcionesTablero {
  alcance: Alcance
  /** Rondas a incluir en proyectos_vivos[].rondas (las demás no se envían). */
  rondas: number[]
  preliminar: boolean
  /** `progreso.por_mesa`: solo en el tablero; las vistas del participante no lo llevan (D2). Por defecto true. */
  porMesa?: boolean
  sufijoVersion?: string
  /**
   * R1 oculta (decisión 1 de Paola, 20-oct): con la ronda 1 abierta, el tablero público y el celular no muestran sus
   * valores hasta que el alcance completo votó (precierre) o se cierra la ronda. Solo el panel del admin la ve antes.
   */
  verR1Abierta?: boolean
}

// Caché por sala y alcance: la vista de un alcance es la misma para el proyector y para cada celular que la consulta;
// solo cambia `version` (la ETag lleva el sufijo de quien pregunta). Al subir la versión de la sala se descarta todo lo
// de esa sala, así la caché no crece con los participantes ni se vacía de golpe.
const cacheTablero = new WeakMap<Db, Map<string, { version: number; vistas: Map<string, ReturnType<typeof calcularTablero>> }>>()

export function construirTablero(db: Db, sala: SalaFila, op: OpcionesTablero) {
  const alcance = op.alcance.tipo === 'mesa' ? op.alcance.mesa.id : 'sala'
  const clave = `${alcance}|${op.rondas.join(',')}|${op.preliminar}|${op.porMesa !== false}`
  const porSala = mapaDe(cacheTablero, db)
  let c = porSala.get(sala.id)
  if (!c || c.version !== sala.version) porSala.set(sala.id, (c = { version: sala.version, vistas: new Map() }))
  let t = c.vistas.get(clave)
  if (!t) {
    t = calcularTablero(db, sala, op)
    c.vistas.set(clave, t)
  }
  // La caché guarda la vista completa; la máscara de R1 depende de quién pide y se aplica al responder.
  const ocultar = sala.estado === 'r1_abierta' && !op.verR1Abierta && !t.precierreAlcance
  return { version: `v-${sala.version}${op.sufijoVersion ?? ''}`, ...(ocultar ? ocultarR1(t.vista) : t.vista) }
}

type VistaTablero = ReturnType<typeof calcularTablero>['vista']

/**
 * La vista con la ronda 1 oculta: `oculta: true`, `n_votos` y nada más (promedios, distribución, punto y total en null).
 * Sin convergencia: con R1 oculta no hay con qué comparar.
 */
function ocultarR1(v: VistaTablero): VistaTablero {
  return {
    ...v,
    convergencia_alcance: undefined,
    proyectos_vivos: v.proyectos_vivos.map(({ convergencia: _sin, ...p }) => ({
      ...p,
      rondas: p.rondas.map((r) => (r.ronda === 1 ? { ...rondaVacia(1), n_votos: r.n_votos, ...(r.bajo_minimo ? { bajo_minimo: true } : {}), oculta: true as const } : r)),
    })),
  }
}

/** Vistas en caché de una sala (pruebas: la caché es por alcance, no por participante). */
export const vistasEnCache = (db: Db, salaId: string) => mapaDe(cacheTablero, db).get(salaId)?.vistas.size ?? 0

function calcularTablero(db: Db, sala: SalaFila, op: OpcionesTablero) {
  const c = contenido(db, sala.id)
  const prs = proyectos(db, sala.id)
  const mesas = mesasDeSala(db, sala.id)
  const prog = progreso(db, sala, mesas)
  const mesaId = op.alcance.tipo === 'mesa' ? op.alcance.mesa.id : undefined
  const porRonda = new Map(op.rondas.map((r) => [r, votosDelAlcance(db, sala.id, r, mesaId)]))
  const vacia = rondaVacia
  const precierreAlcance = mesaId ? (prog.por_mesa.find((m) => m.mesa_id === mesaId)?.precierre ?? false) : prog.precierre

  const vivosConRondas: VivoPublicado[] = prs
    .filter((p) => p.modo === 'vivo')
    .map((p) => {
      const rondas: RondaPublicada[] = op.rondas.map((r) => {
        // D2: con la ronda abierta, la última foto del alcance (se renueva de 3 en 3); con la ronda cerrada, el exacto.
        const { agregado: a, n_votos } = agregadoPublicado(
          db,
          { salaId: sala.id, alcance: mesaId ?? 'sala', ronda: r, proyectoId: p.id, versionSala: sala.version },
          porRonda.get(r)?.get(p.id) ?? [],
          c.pesos,
          rondaCerrada(sala, r),
        )
        if (n_votos === 0) return vacia(r)
        // SPEC §7: nunca respuestas individuales. Con pocos votos en el alcance, el promedio delata cada respuesta.
        if (!a || a.n_votos < MINIMO_VOTOS) return { ...vacia(r), n_votos, bajo_minimo: true }
        return { ronda: r, n_votos: a.n_votos, promedios: a.promedios, distribucion: a.distribucion, t2m: a.t2m, eje_x: a.eje_x, eje_y: a.eje_y, total: a.total }
      })
      const conv = convergencia(rondas.find((r) => r.ronda === 1), rondas.find((r) => r.ronda === 2))
      return { id: p.id, nombre: p.nombre, sector: p.sector, modo: 'vivo' as const, tam: p.tam, rondas, ...(conv ? { convergencia: conv } : {}) }
    })
  const reducciones = vivosConRondas.flatMap((p) => (p.convergencia ? [p.convergencia.reduccion_pct] : []))

  const vista = {
    sala: { id: sala.id, nombre: sala.nombre, estado: sala.estado, ronda_actual: sala.ronda_actual, pregunta_guiada: preguntaGuiada(sala) },
    alcance:
      op.alcance.tipo === 'mesa'
        ? { tipo: 'mesa', mesa_id: op.alcance.mesa.id, mesa_nombre: op.alcance.mesa.nombre }
        : { tipo: 'sala', mesa_id: null, mesa_nombre: null },
    config: configPublica(sala),
    progreso: { inscritos: prog.inscritos, completos: prog.completos, precierre: prog.precierre, ...(op.porMesa === false ? {} : { por_mesa: prog.por_mesa }) },
    ejes: c.ejes,
    grafico: c.grafico,
    // Pregunta y rúbrica solo en modo guiado (el tablero muestra la pregunta en grande): en automático el payload
    // que se consulta cada 2,5 s no crece. Cambiar de modo sube la versión, así la caché y la ETag se renuevan.
    criterios: c.criterios.map((k) => (sala.modo_preguntas === 'guiado' ? { id: k.id, nombre: k.nombre, pregunta: k.pregunta, rubrica: k.rubrica } : { id: k.id, nombre: k.nombre })),
    proyectos_fijos: prs
      .filter((p) => p.modo === 'fijo')
      .map((p) => {
        const e = JSON.parse(p.inputs_json ?? '{}') as Entradas
        return { id: p.id, nombre: p.nombre, sector: p.sector, modo: 'fijo', tam: p.tam, ...calcularPunto(e, c.pesos) }
      }),
    proyectos_vivos: vivosConRondas,
    preliminar: op.preliminar,
    minimo_votos: MINIMO_VOTOS,
    votos_por_actualizacion: VOTOS_POR_ACTUALIZACION,
    convergencia_alcance: (reducciones.length ? { reduccion_pct: Math.round(reducciones.reduce((a, b) => a + b, 0) / reducciones.length) } : undefined) as { reduccion_pct: number } | undefined,
  }
  return { vista, precierreAlcance }
}

// --- Convergencia R1 → R2 (QA por roles, 20-oct) ----------------------------------------

export interface RondaPublicada {
  ronda: number
  n_votos: number
  promedios: Entradas | null
  distribucion: Distribucion | null
  t2m: number | null
  eje_x: number | null
  eje_y: number | null
  total: number | null
  bajo_minimo?: boolean
  /** R1 oculta: hay votos pero todavía no se muestran (ronda 1 abierta y el alcance sin precierre). */
  oculta?: true
}

interface VivoPublicado {
  id: string
  nombre: string
  sector: string
  modo: 'vivo'
  tam: number
  rondas: RondaPublicada[]
  convergencia?: Convergencia
}

const rondaVacia = (r: number): RondaPublicada => ({ ronda: r, n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null })

export interface Convergencia {
  dispersion_r1: number
  dispersion_r2: number
  reduccion_pct: number
  criterio_mayor_cambio: CriterioId
  delta_x: number
  delta_y: number
}

const dosDecimales = (n: number) => Math.round(n * 100) / 100

/**
 * Dispersión de una ronda: promedio de las desviaciones estándar (poblacionales) de los 6 criterios, calculadas sobre
 * la distribución publicada. Sale de lo publicado y no de los votos al día: con la ronda abierta no despeja un voto
 * entre dos fotos.
 */
export function dispersion(d: Distribucion): number {
  let suma = 0
  for (const c of CRITERIOS) {
    const pares = Object.entries(d[c]).map(([v, n]) => [Number(v), n] as const)
    const n = pares.reduce((a, [, k]) => a + k, 0)
    if (n === 0) continue
    const media = pares.reduce((a, [v, k]) => a + v * k, 0) / n
    suma += Math.sqrt(pares.reduce((a, [v, k]) => a + k * (v - media) ** 2, 0) / n)
  }
  return suma / CRITERIOS.length
}

/**
 * Cuánto se juntó la mesa o la sala de R1 a R2 en un proyecto. Solo si las dos rondas tienen resultados visibles (con
 * valores: ni ocultas ni bajo el mínimo). `reduccion_pct` puede ser negativa si la dispersión creció. Empate en el mayor
 * cambio: el primero en el orden de los criterios.
 */
export function convergencia(r1: RondaPublicada | undefined, r2: RondaPublicada | undefined): Convergencia | null {
  if (!r1?.promedios || !r1.distribucion || !r2?.promedios || !r2.distribucion) return null
  if (r1.eje_x === null || r1.eje_y === null || r2.eje_x === null || r2.eje_y === null) return null
  const d1 = dispersion(r1.distribucion)
  const d2 = dispersion(r2.distribucion)
  const cambio = (c: CriterioId) => Math.abs(r2.promedios![c] - r1.promedios![c])
  let mayor: CriterioId = CRITERIOS[0]
  for (const c of CRITERIOS) if (cambio(c) > cambio(mayor) + 1e-9) mayor = c
  return {
    dispersion_r1: dosDecimales(d1),
    dispersion_r2: dosDecimales(d2),
    reduccion_pct: d1 === 0 ? 0 : Math.round(((d1 - d2) / d1) * 100),
    criterio_mayor_cambio: mayor,
    delta_x: dosDecimales(r2.eje_x - r1.eje_x),
    delta_y: dosDecimales(r2.eje_y - r1.eje_y),
  }
}

export function configPublica(s: SalaFila) {
  const z = s.zona_horaria
  return {
    alcance_resultados: s.alcance_resultados,
    vista_participante: s.vista_participante,
    revelar_hojas: Boolean(s.revelar_hojas),
    // Alias para clientes anteriores al 19-oct: el cierre de la ronda abierta (o de la siguiente).
    cierre_programado_ronda_at: isoEnZona(rondaDelAlias(s) === 1 ? s.cierre_programado_r1_at : s.cierre_programado_r2_at, z),
    cierre_programado_sala_at: isoEnZona(s.cierre_programado_sala_at, z),
    pais: s.pais,
    zona_horaria: z,
    apertura_programada_sala_at: isoEnZona(s.apertura_programada_sala_at, z),
    apertura_programada_r1_at: isoEnZona(s.apertura_programada_r1_at, z),
    cierre_programado_r1_at: isoEnZona(s.cierre_programado_r1_at, z),
    apertura_programada_r2_at: isoEnZona(s.apertura_programada_r2_at, z),
    cierre_programado_r2_at: isoEnZona(s.cierre_programado_r2_at, z),
    modo_preguntas: s.modo_preguntas,
  }
}

/** Pregunta que el admin fijó en modo guiado, o null. */
export const preguntaGuiada = (s: SalaFila) =>
  s.pregunta_guiada_proyecto_id && s.pregunta_guiada_criterio_id ? { proyecto_id: s.pregunta_guiada_proyecto_id, criterio_id: s.pregunta_guiada_criterio_id } : null
