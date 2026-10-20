// Máquina de estados de la sala (SPEC §3), configuración (§6) y aperturas y cierres programados (§5, cambios del 19-oct).
// preparada → inscripcion → r1_abierta → r1_cerrada → r2_abierta → r2_cerrada → cerrada
import { type Db, ejecutar, todos, transaccion } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { CRITERIOS } from '../../shared/motor/motor.js'
import { borrarFotos, fijarFotosExactas } from './fotos.js'
import { contenido, preguntaGuiada, rondaAbierta, rondaDelAlias, vivos } from './resultados.js'
import { type EstadoSala, type SalaFila, cargarSala, mesasDeSala, registrarEvento, tocar } from './salas.js'
import { DESFASES, PAISES, type ZonaHoraria, ZONA_POR_PAIS, isoEnZona, isoUtc } from './util.js'

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

/**
 * Aperturas y cierres programables, en el orden en que ocurren en un taller. Cada uno aplica su acción a su hora,
 * solo si la transición es válida en ese momento. Una transición (manual o programada) consume lo programado para ella.
 */
export const PROGRAMACION = [
  { col: 'apertura_programada_sala_at', accion: 'abrir_inscripcion', etapa: 'sala', apertura: true, nombre: 'la apertura de la sala' },
  { col: 'apertura_programada_r1_at', accion: 'abrir_ronda_1', etapa: 'r1', apertura: true, nombre: 'la apertura de la ronda 1' },
  { col: 'cierre_programado_r1_at', accion: 'cerrar_ronda_1', etapa: 'r1', apertura: false, nombre: 'el cierre de la ronda 1' },
  { col: 'apertura_programada_r2_at', accion: 'abrir_ronda_2', etapa: 'r2', apertura: true, nombre: 'la apertura de la ronda 2' },
  { col: 'cierre_programado_r2_at', accion: 'cerrar_ronda_2', etapa: 'r2', apertura: false, nombre: 'el cierre de la ronda 2' },
  { col: 'cierre_programado_sala_at', accion: 'cerrar_sala', etapa: 'sala', apertura: false, nombre: 'el cierre de la sala' },
] as const
type ColumnaProgramada = (typeof PROGRAMACION)[number]['col']

/** Lo programado que consume cada acción: la suya y las que salta (abrir la ronda 1 sin inscripción, cerrar la sala). */
const CONSUME: Partial<Record<Accion, ColumnaProgramada[]>> = {
  abrir_inscripcion: ['apertura_programada_sala_at'],
  abrir_ronda_1: ['apertura_programada_sala_at', 'apertura_programada_r1_at'],
  cerrar_ronda_1: ['cierre_programado_r1_at'],
  abrir_ronda_2: ['apertura_programada_r2_at'],
  cerrar_ronda_2: ['cierre_programado_r2_at'],
  cerrar_sala: PROGRAMACION.map((p) => p.col),
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
  /** Solo para reiniciar_ronda: qué ronda reiniciar (por defecto la actual). Llega del cuerpo sin validar. */
  ronda?: unknown
}

/** Aplica una acción del admin (o del programador). 409 TRANSICION_INVALIDA si no aplica. */
export function aplicarAccion(db: Db, salaId: string, accion: string, ahora: number, por: string, op: OpcionesAccion = {}): SalaFila {
  if (!(ACCIONES as readonly string[]).includes(accion)) {
    throw new ErrorApi(422, 'ACCION_INVALIDA', `La acción "${accion}" no existe.`)
  }
  return transaccion(db, () => {
    const s = cargarSala(db, salaId)
    if (accion === 'reiniciar_ronda') {
      if (op.ronda !== undefined && op.ronda !== 1 && op.ronda !== 2) {
        throw new ErrorApi(422, 'RONDA_INVALIDA', 'La ronda a reiniciar debe ser 1 o 2.')
      }
      const ronda = op.ronda ?? s.ronda_actual
      if (s.estado === 'cerrada' || ronda < 1 || ronda > s.ronda_actual) {
        throw new ErrorApi(409, 'TRANSICION_INVALIDA', 'No hay votos de esa ronda para reiniciar en el estado actual de la sala.')
      }
      const borrados = ejecutar(db, 'DELETE FROM votos WHERE sala_id = ? AND ronda = ?', s.id, ronda).changes
      borrarFotos(db, s.id, ronda)
      registrarEvento(db, s.id, ahora, 'reinicio', por, { ronda, votos_borrados: Number(borrados) })
      tocar(db, s.id)
      return cargarSala(db, s.id)
    }
    const t = TRANSICIONES[accion as Exclude<Accion, 'reiniciar_ronda'>]
    if (!t.desde.includes(s.estado)) {
      throw new ErrorApi(409, 'TRANSICION_INVALIDA', `No se puede ${accion.replace(/_/g, ' ')}: la sala está ${NOMBRE_ESTADO[s.estado]}.`)
    }
    const hacia = typeof t.hacia === 'function' ? t.hacia(s) : t.hacia
    // D2: al reabrir una ronda, la foto de partida es el resultado exacto que se mostró con la ronda cerrada; si no,
    // la primera foto nueva podría diferir del exacto en un solo voto.
    if (accion === 'reabrir_ronda') {
      fijarFotosExactas(
        db,
        s.id,
        s.ronda_actual,
        s.version,
        contenido(db, s.id).pesos,
        vivos(db, s.id).map((p) => p.id),
        mesasDeSala(db, s.id).map((m) => m.id),
      )
    }
    const sets: string[] = ['estado = ?']
    const params: unknown[] = [hacia]
    if (t.ronda) {
      sets.push('ronda_actual = ?')
      params.push(t.ronda)
    }
    // Al abrir R2 se revelan las 6 hojas (el admin puede apagarlo después).
    if (accion === 'abrir_ronda_2') sets.push('revelar_hojas = 1')
    for (const col of CONSUME[accion as Accion] ?? []) sets.push(`${col} = NULL`)
    // La pregunta guiada es de la ronda abierta: cualquier cambio de estado la quita.
    sets.push('pregunta_guiada_proyecto_id = NULL', 'pregunta_guiada_criterio_id = NULL')
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
  apertura_programada_sala_at?: unknown
  apertura_programada_r1_at?: unknown
  cierre_programado_r1_at?: unknown
  apertura_programada_r2_at?: unknown
  cierre_programado_r2_at?: unknown
  modo_preguntas?: unknown
  pais?: unknown
  zona_horaria?: unknown
}

/**
 * ISO-8601 con fecha, hora y zona, y año de 4 dígitos (S-7, S-8): `2026-10-20T15:00:00-05:00`, `…:00.000Z` o sin segundos.
 * Sin zona dependería del huso del proceso; en texto libre («October 21, 2026») o con año extendido (`+020266-…`)
 * Date.parse acepta cosas que luego se comparaban mal.
 */
const RE_ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Valida una hora de apertura o cierre programado. Manda la hora del servidor, no la del navegador del admin:
 * una hora que ya pasó se rechaza (si se aceptara, la ronda se cerraría de golpe en la siguiente petición).
 */
function fechaOpcional(campo: string, v: unknown, ahora: number, zona: ZonaHoraria): string | null {
  if (v === null || v === '') return null
  const ms = typeof v === 'string' && RE_ISO_CON_ZONA.test(v) ? Date.parse(v) : Number.NaN
  if (Number.isNaN(ms)) {
    throw new ErrorApi(422, 'CONFIG_INVALIDA', `${campo} debe ser una fecha ISO-8601 con zona (por ejemplo 2026-10-20T15:00:00-05:00) o null.`)
  }
  if (ms <= ahora) {
    const hora = (isoEnZona(ahora, zona) ?? '').slice(11, 19)
    throw new ErrorApi(422, 'HORA_PASADA', `Esa hora ya pasó. En el servidor son las ${hora}; elige una hora posterior.`)
  }
  return isoUtc(ms)
}

/** Milisegundos de una hora guardada (NaN si no es una fecha). Se compara en milisegundos, no como texto (S-7). */
const msDe = (v: string | null) => (v ? Date.parse(v) : Number.NaN)

/**
 * Orden de la programación: cada hora no antes que la anterior del taller y cada apertura antes de su cierre
 * (sala, ronda 1, ronda 2). Solo cuentan las horas definidas. 422 ORDEN_INVALIDO.
 */
function validarOrden(prog: Partial<Record<ColumnaProgramada, string | null>>) {
  const definidas = PROGRAMACION.filter((p) => prog[p.col])
  for (let i = 0; i < definidas.length; i++) {
    for (let j = i + 1; j < definidas.length; j++) {
      const a = definidas[i]
      const b = definidas[j]
      const ta = Date.parse(prog[a.col]!)
      const tb = Date.parse(prog[b.col]!)
      if (ta > tb || (ta === tb && a.etapa === b.etapa)) {
        throw new ErrorApi(422, 'ORDEN_INVALIDO', `${mayuscula(a.nombre)} debe ser antes que ${b.nombre}.`)
      }
    }
  }
}
const mayuscula = (t: string) => t[0].toUpperCase() + t.slice(1)

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
  // Cambiar el país sin zona pone la zona del país.
  let zona = cargarSala(db, salaId).zona_horaria
  if (cambios.pais !== undefined) {
    if (!(PAISES as readonly unknown[]).includes(cambios.pais)) throw new ErrorApi(422, 'CONFIG_INVALIDA', 'pais debe ser "CO", "PE" o "GT".')
    poner('pais', cambios.pais)
    if (cambios.zona_horaria === undefined) poner('zona_horaria', (zona = ZONA_POR_PAIS[cambios.pais as keyof typeof ZONA_POR_PAIS]))
  }
  if (cambios.zona_horaria !== undefined) {
    if (typeof cambios.zona_horaria !== 'string' || !Object.hasOwn(DESFASES, cambios.zona_horaria)) {
      throw new ErrorApi(422, 'CONFIG_INVALIDA', `zona_horaria debe ser una de: ${Object.keys(DESFASES).join(', ')}.`)
    }
    poner('zona_horaria', (zona = cambios.zona_horaria as ZonaHoraria))
  }
  if (cambios.modo_preguntas !== undefined) {
    if (!['automatico', 'guiado'].includes(cambios.modo_preguntas as string)) throw new ErrorApi(422, 'CONFIG_INVALIDA', 'modo_preguntas debe ser "automatico" o "guiado".')
    poner('modo_preguntas', cambios.modo_preguntas)
  }
  // Programación: el alias de ronda escribe en la ronda abierta (o la siguiente); el campo propio de la ronda, si llega, manda.
  const actual = cargarSala(db, salaId)
  const programada: Partial<Record<ColumnaProgramada, string | null>> = {}
  if (cambios.cierre_programado_ronda_at !== undefined) {
    programada[`cierre_programado_r${rondaDelAlias(actual)}_at` as const] = fechaOpcional('cierre_programado_ronda_at', cambios.cierre_programado_ronda_at, ahora, zona)
  }
  for (const { col } of PROGRAMACION) {
    if (cambios[col] !== undefined) programada[col] = fechaOpcional(col, cambios[col], ahora, zona)
  }
  for (const [col, v] of Object.entries(programada)) poner(col, v)
  if (Object.keys(programada).length) validarOrden({ ...actual, ...programada })
  if (sets.length === 0) throw new ErrorApi(422, 'CONFIG_INVALIDA', 'No llegó ningún cambio de configuración.')

  return transaccion(db, () => {
    const s = cargarSala(db, salaId)
    // Cambiar de modo quita la pregunta guiada: el celular no debe quedar en una pregunta de otro modo.
    if (cambios.modo_preguntas !== undefined && cambios.modo_preguntas !== s.modo_preguntas) {
      sets.push('pregunta_guiada_proyecto_id = NULL', 'pregunta_guiada_criterio_id = NULL')
    }
    ejecutar(db, `UPDATE salas SET ${sets.join(', ')} WHERE id = ?`, ...params, s.id)
    registrarEvento(db, s.id, ahora, 'config', por, detalle)
    tocar(db, s.id)
    return cargarSala(db, s.id)
  })
}

// --- Pregunta guiada (cambios del 19-oct, S4) ------------------------------------------

/**
 * Fija la pregunta que ven los celulares y el tablero en modo guiado (`null` la quita). Solo con una ronda abierta.
 * El voto se sigue guardando completo: el celular acumula las respuestas y envía al completar el proyecto.
 */
export function fijarPreguntaGuiada(db: Db, salaId: string, cuerpo: unknown, ahora: number, por: string) {
  let proyecto: string | null = null
  let criterio: string | null = null
  if (cuerpo !== null) {
    const c = (typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {}) as { proyecto_id?: unknown; criterio_id?: unknown }
    if (typeof c.proyecto_id !== 'string' || !vivos(db, salaId).some((p) => p.id === c.proyecto_id)) {
      throw new ErrorApi(422, 'PROYECTO_INVALIDO', 'La pregunta guiada debe ser de INSUMEX o NUTRIWHAT.')
    }
    if (typeof c.criterio_id !== 'string' || !(CRITERIOS as readonly string[]).includes(c.criterio_id)) {
      throw new ErrorApi(422, 'CRITERIO_NO_EXISTE', 'Ese criterio no existe.')
    }
    proyecto = c.proyecto_id
    criterio = c.criterio_id
  }
  return transaccion(db, () => {
    const s = cargarSala(db, salaId)
    const ronda = rondaAbierta(s)
    if (!ronda) throw new ErrorApi(409, 'RONDA_CERRADA', 'No hay una ronda abierta: abre una ronda para guiar las preguntas.')
    // En automático los celulares no la usan: fijarla dejaría una pregunta fantasma en el tablero (S-10). Quitarla sí se puede.
    if (proyecto && s.modo_preguntas !== 'guiado') {
      throw new ErrorApi(409, 'MODO_NO_GUIADO', 'La sala está en modo automático. Cambia a modo guiado para fijar la pregunta.')
    }
    ejecutar(db, 'UPDATE salas SET pregunta_guiada_proyecto_id = ?, pregunta_guiada_criterio_id = ? WHERE id = ?', proyecto, criterio, s.id)
    registrarEvento(db, s.id, ahora, 'pregunta_guiada', por, { ronda, proyecto_id: proyecto, criterio_id: criterio })
    tocar(db, s.id)
    const n = cargarSala(db, s.id)
    return { pregunta_guiada: preguntaGuiada(n), version: `v-${n.version}` }
  })
}

// --- Aperturas y cierres programados (§5, cambios del 19-oct) -----------------------------

/**
 * Aplica las aperturas y los cierres programados vencidos de todas las salas, en orden de hora (y del taller si
 * coinciden). Se llama antes de cada petición (chequeo perezoso) y cada 15 s. Cada uno se aplica solo si su
 * transición es válida en ese momento; si no, se descarta y queda en la bitácora. Devuelve cuántos aplicó, qué
 * salas quedaron cerradas y cuáles arrancaron (salieron de `preparada`).
 */
export function aplicarCierresProgramados(db: Db, ahora: number): { aplicados: number; salasCerradas: string[]; salasIniciadas: string[] } {
  const vence = (v: string | null) => msDe(v) <= ahora
  const vencidas = todos<SalaFila>(db, `SELECT * FROM salas WHERE ${PROGRAMACION.map((p) => `${p.col} IS NOT NULL`).join(' OR ')}`).filter((s) =>
    PROGRAMACION.some((p) => vence(s[p.col])),
  )
  let aplicados = 0
  const salasCerradas: string[] = []
  const salasIniciadas: string[] = []
  for (const { id } of vencidas) {
    transaccion(db, () => {
      // Uno a la vez: cada paso cambia el estado y consume su hora, así el siguiente se evalúa sobre la sala al día.
      for (;;) {
        const s = cargarSala(db, id)
        const p = PROGRAMACION.filter((x) => vence(s[x.col])).sort((a, b) => msDe(s[a.col]) - msDe(s[b.col]))[0]
        if (!p) break
        const programado_at = s[p.col]
        if (TRANSICIONES[p.accion].desde.includes(s.estado)) {
          aplicarAccion(db, s.id, p.accion, ahora, 'programado') // consume su hora (CONSUME)
          registrarEvento(db, s.id, ahora, p.apertura ? 'apertura_programada' : 'cierre_programado', 'programado', { accion: p.accion, programado_at })
          aplicados++
          if (p.accion === 'cerrar_sala') salasCerradas.push(s.id)
          if (p.apertura && s.estado === 'preparada') salasIniciadas.push(s.id)
        } else {
          // No aplica en el estado actual: se descarta para que no se aplique de golpe más adelante.
          ejecutar(db, `UPDATE salas SET ${p.col} = NULL WHERE id = ?`, s.id)
          registrarEvento(db, s.id, ahora, p.apertura ? 'apertura_programada_descartada' : 'cierre_programado_descartado', 'programado', {
            accion: p.accion,
            programado_at,
            estado: s.estado,
          })
          tocar(db, s.id)
        }
      }
    })
  }
  return { aplicados, salasCerradas, salasIniciadas }
}
