// Lógica de presentación del tablero. Solo lee lo que entrega el servidor: nunca recalcula el motor.
import type { CriterioTablero, DatosTablero, EstadoSala, ProyectoVivo, RondaVivo, Vista } from './tipos'
import type { Rubrica } from '../shared/api/contrato'
import { nombreCortoCriterio } from '../shared/criterios'

export const INTERVALO_POLLING_MS = 2500

/**
 * Vista por defecto: la ronda actual; tras cerrar la ronda 2, la comparación. Con la ronda 2 abierta y todavía sin
 * resultados que dibujar, la ronda 1 (QA por roles, Nicolai: abrir la ronda 2 dejaba el proyector con una matriz vacía).
 */
export function vistaPorDefecto(estado: EstadoSala | undefined, rondaActual?: number | null, datos?: DatosTablero | null): Vista {
  if (estado === 'r2_cerrada' || estado === 'cerrada') return 'comparacion'
  if (estado === 'r2_abierta' || rondaActual === 2) return datos && !hayVotosEnRonda(datos, 2) ? 1 : 2
  return 1
}

/** Orden de las vistas para el control de presentaciones: → y Página siguiente avanzan, ← y Página anterior retroceden. */
export const ORDEN_VISTAS: Vista[] = [1, 2, 'comparacion']
export function vistaVecina(vista: Vista, paso: 1 | -1): Vista {
  const i = ORDEN_VISTAS.indexOf(vista)
  return ORDEN_VISTAS[Math.min(ORDEN_VISTAS.length - 1, Math.max(0, i + paso))]
}

export function rondaDe(vivo: ProyectoVivo, n: number): RondaVivo | null {
  return vivo.rondas?.find((r) => r.ronda === n) ?? null
}

export function tieneVotos(r: RondaVivo | null | undefined): boolean {
  return !!r && (r.n_votos ?? 0) > 0 && typeof r.eje_x === 'number' && typeof r.eje_y === 'number'
}

export function hayVotosEnRonda(datos: DatosTablero | null | undefined, n: number): boolean {
  return (datos?.proyectos_vivos ?? []).some((v) => tieneVotos(rondaDe(v, n)))
}

/** Votos mínimos por proyecto, ronda y alcance si el servidor no manda `minimo_votos` (acta del 16-oct, C3). */
export const MINIMO_VOTOS = 3

/**
 * Ronda 1 oculta (decisión de Paola del 20-oct): con la ronda 1 abierta el tablero público no muestra promedios,
 * distribución ni burbujas hasta que el alcance completo vote (precierre) o se cierre la ronda. Lo dice el servidor.
 */
export function rondaOculta(datos: DatosTablero | null | undefined, n: number): boolean {
  return (datos?.proyectos_vivos ?? []).some((v) => !!rondaDe(v, n)?.oculta)
}

/** Texto de la cortina de la ronda 1. */
export const TEXTO_OCULTA = 'Los resultados de la ronda 1 se muestran cuando todos voten o al cerrar la ronda.'

/**
 * Avance de la ronda en curso por mesa para la cortina: «Mesa 1», 4 de 6. En el alcance de una mesa, solo esa; sin el
 * detalle por mesa (enlace público), el total del alcance. Las mesas sin inscritos no se listan.
 */
export function avanceCortina(datos: DatosTablero | null | undefined): { id: string; nombre: string; votaron: number; inscritos: number }[] {
  const p = datos?.progreso
  if (!p) return []
  const fila = (id: string, nombre: string, m: { completos: number; inscritos: number }) => ({ id, nombre, votaron: Math.min(m.completos, m.inscritos), inscritos: m.inscritos })
  const mesas = (p.por_mesa ?? []).filter((m) => m.inscritos > 0)
  if (datos.alcance?.tipo === 'mesa') {
    const m = mesas.find((x) => x.mesa_id === datos.alcance.mesa_id)
    return [fila(datos.alcance.mesa_id ?? 'mesa', datos.alcance.mesa_nombre ?? m?.nombre ?? 'Mesa', m ?? p)]
  }
  if (mesas.length) return mesas.map((m) => fila(m.mesa_id, m.nombre, m))
  return [fila('sala', 'Toda la sala', p)]
}

/** La ronda tiene votos, pero menos que el mínimo: el servidor no entrega sus promedios (anonimato). */
export function bajoMinimoEnRonda(datos: DatosTablero | null | undefined, n: number): boolean {
  return (datos?.proyectos_vivos ?? []).some((v) => !!rondaDe(v, n)?.bajo_minimo)
}

/** «Hacen falta al menos 3 votos» (F-12: concordancia; con 1, «Hace falta al menos 1 voto»). */
export function faltanVotos(minimo: number): string {
  return minimo === 1 ? 'Hace falta al menos 1 voto' : `Hacen falta al menos ${minimo} votos`
}

/** «Hacen falta al menos 3 votos para mostrar esta mesa» (alcance mesa) o «… estos resultados» (sala). */
export function mensajeMinimo(datos: DatosTablero | null | undefined): string {
  const que = datos?.alcance?.tipo === 'mesa' ? 'esta mesa' : 'estos resultados'
  return `${faltanVotos(datos?.minimo_votos ?? MINIMO_VOTOS)} para mostrar ${que}`
}

/**
 * D2 (20-oct): con la ronda abierta el servidor publica una foto del consolidado que se renueva cuando hay
 * 3 o más votos nuevos; al cerrar la ronda, el resultado exacto. El tablero lo dice así, sin prometer cada voto.
 */
export const VOTOS_POR_FOTO = 3

/** Ronda abierta en este momento (1 o 2), o null. */
export function rondaEnCurso(estado: EstadoSala | undefined): 1 | 2 | null {
  return estado === 'r1_abierta' ? 1 : estado === 'r2_abierta' ? 2 : null
}

/**
 * Modo de proyección, en la URL como `?modo=grafica|detallado` (nombres de Paola, 20-oct): «Gráfica» es solo la
 * matriz (por defecto) y «Detallado» la matriz con el progreso, los promedios por criterio y «Cómo votó».
 * Los valores anteriores `vivo` y `tabla` siguen sirviendo (enlaces ya compartidos). Cualquier otro valor, Gráfica.
 */
export type ModoTablero = 'grafica' | 'detallado'
export const PARAMETRO_MODO = 'modo'
export function modoDeUrl(valor: string | null | undefined): ModoTablero {
  return valor === 'detallado' || valor === 'tabla' ? 'detallado' : 'grafica'
}

/**
 * Indicador discreto de votos recibidos: «14 de 20 votaron» en la ronda en curso (o la última), del progreso
 * en vivo; en el alcance de una mesa, el de esa mesa. null sin ronda o sin inscritos.
 */
export function votosRecibidos(datos: DatosTablero | null | undefined): string | null {
  const p = datos?.progreso
  if (!p || !datos?.sala?.ronda_actual) return null
  const m = datos.alcance?.tipo === 'mesa' ? p.por_mesa?.find((x) => x.mesa_id === datos.alcance.mesa_id) : null
  const { inscritos, completos } = m ?? p
  if (!inscritos) return null
  return `${Math.min(completos, inscritos)} de ${inscritos} votaron`
}

/**
 * Texto visible de la insignia de la ronda abierta y su explicación (title). Es un estado de la ronda, no un modo
 * de proyección: por eso va como insignia neutra junto al estado y no como botón.
 */
export const EN_VIVO = {
  texto: `En vivo: se actualiza cada ${VOTOS_POR_FOTO} votos`,
  titulo: `La ronda sigue abierta: el resultado se actualiza cada ${VOTOS_POR_FOTO} votos nuevos. Al cerrar la ronda se muestra el resultado final.`,
}

/** Texto del estado vacío para la vista elegida, o null si hay algo que dibujar. */
export function mensajeVacio(datos: DatosTablero | null | undefined, vista: Vista): string | null {
  const r1 = hayVotosEnRonda(datos, 1)
  const r2 = hayVotosEnRonda(datos, 2)
  // Con la ronda abierta lo que llega es la última foto (D2): puede haber votos que aún no se ven.
  const sinRonda = (n: 1 | 2) =>
    bajoMinimoEnRonda(datos, n)
      ? mensajeMinimo(datos)
      : rondaEnCurso(datos?.sala?.estado) === n
        ? `Aún no hay resultados en la ronda ${n}. Se actualizan cada ${VOTOS_POR_FOTO} votos nuevos`
        : `Aún no hay votos en la ronda ${n}`
  // La ronda 1 oculta la explica la cortina (avance por mesa en grande), no un aviso.
  const oculta = rondaOculta(datos, 1)
  if (vista === 1) return r1 || oculta ? null : sinRonda(1)
  if (vista === 2) return r2 ? null : sinRonda(2)
  if (!r1 && !r2) return oculta ? null : sinRonda(1)
  if (!r2) return `${sinRonda(2)}. La comparación muestra solo la ronda 1.`
  return null
}

/** La columna R2 de las tablas: solo desde la ronda 2 (antes solo diría «Sin votos» en cada fila). */
export function mostrarR2(datos: DatosTablero): boolean {
  return hayVotosEnRonda(datos, 2) || (datos.sala?.ronda_actual ?? 0) >= 2
}

/** Celda de una tabla de resultados: la cifra del servidor, «Faltan votos» bajo el mínimo o «Sin votos». */
export function cifraRonda(r: RondaVivo | null, valor: number | null | undefined): string {
  return r?.bajo_minimo ? 'Faltan votos' : numero(valor)
}

/**
 * Clase de esa celda: la cifra de la ronda que se ve va resaltada (`hz-foco`); «Sin votos» y «Faltan votos» van
 * en texto secundario y sin negrita, para que una tabla vacía no grite (`hz-sin-dato`).
 */
export function claseCifra(r: RondaVivo | null, valor: number | null | undefined, foco: boolean, extra?: string): string | undefined {
  const hayCifra = !r?.bajo_minimo && typeof valor === 'number' && Number.isFinite(valor)
  return [extra, hayCifra ? foco && 'hz-foco' : 'hz-sin-dato'].filter(Boolean).join(' ') || undefined
}

const fmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Número con coma decimal. Sin dato: "Sin votos". */
export function numero(v: number | null | undefined, decimales: 1 | 2 = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'Sin votos'
  return (decimales === 1 ? fmt1 : fmt).format(v)
}

/** Diferencia R2 menos R1 con signo, para lectura rápida. null si falta alguna. */
export function delta(r1: number | null | undefined, r2: number | null | undefined): string | null {
  if (typeof r1 !== 'number' || typeof r2 !== 'number') return null
  const d = Math.round((r2 - r1) * 100) / 100
  if (d === 0) return '='
  return `${d > 0 ? '+' : '−'}${fmt.format(Math.abs(d))}`
}

export function rondaAbierta(estado: EstadoSala | undefined): boolean {
  return estado === 'r1_abierta' || estado === 'r2_abierta'
}

/**
 * Conteo de una mesa para la ronda que se ve (QA-T-04): «R1: 2 de 2» o, en Comparación, «R1: 2 de 2 · R2: 0 de 2».
 * La ronda en curso usa el progreso (en vivo); una ronda cerrada, cuántos votaron los dos proyectos (n_votos
 * mínimo entre los vivos, exacto tras el cierre). Sin la respuesta de la mesa, el progreso de la ronda en curso.
 */
export function conteoMesa(datos: DatosTablero | null | undefined, mesa: { inscritos: number; completos: number }, vista: Vista): string {
  const enCurso = rondaEnCurso(datos?.sala?.estado)
  const rondas: (1 | 2)[] = vista === 'comparacion' ? (mostrarR2Datos(datos) ? [1, 2] : [1]) : [vista]
  if (!datos) return `${mesa.completos} de ${mesa.inscritos}`
  return rondas
    .map((n) => {
      const votaron = enCurso === n ? mesa.completos : Math.min(...datos.proyectos_vivos.map((v) => rondaDe(v, n)?.n_votos ?? 0))
      return `R${n}: ${Number.isFinite(votaron) ? votaron : 0} de ${mesa.inscritos}`
    })
    .join(' · ')
}
const mostrarR2Datos = (d: DatosTablero | null | undefined) => !!d && mostrarR2(d)

/** Avisos de precierre visibles en el tablero ("Mesa 2: todos votaron"). */
export function avisosPrecierre(datos: DatosTablero | null | undefined): { id: string; texto: string }[] {
  if (!datos || !rondaAbierta(datos.sala?.estado)) return []
  const p = datos.progreso
  if (!p) return []
  const mesas = (p.por_mesa ?? []).filter((m) => m.precierre).map((m) => ({ id: m.mesa_id, texto: `${m.nombre}: todos votaron` }))
  if (p.precierre) return [{ id: '_sala', texto: 'Toda la sala votó' }, ...mesas]
  return mesas
}

/**
 * "Preliminar" solo cuando el alcance mostrado está en precierre con la ronda todavía abierta.
 * La API real manda `preliminar: true` durante toda la ronda abierta (todo resultado es provisional
 * hasta el cierre); por eso el tablero no usa ese flag y deriva el precierre de `progreso`.
 */
export function esPreliminar(datos: DatosTablero | null | undefined): boolean {
  if (!datos) return false
  if (!rondaAbierta(datos.sala?.estado)) return false
  const p = datos.progreso
  if (!p) return false
  if (datos.alcance?.tipo === 'mesa') return !!p.por_mesa?.find((m) => m.mesa_id === datos.alcance.mesa_id)?.precierre
  return !!p.precierre
}

/** Insignia del encabezado: «Preliminar» en precierre, «En vivo, cada 3 votos» con la ronda abierta, nada al cerrar. */
export function insigniaResultado(datos: DatosTablero | null | undefined): 'preliminar' | 'en_vivo' | null {
  if (esPreliminar(datos)) return 'preliminar'
  // Con la ronda 1 oculta no hay nada en vivo: la cortina dice cuándo se ve el resultado.
  const enCurso = rondaEnCurso(datos?.sala?.estado)
  if (enCurso && rondaOculta(datos, enCurso)) return null
  return enCurso ? 'en_vivo' : null
}

const NOMBRES_ESTADO: Record<EstadoSala, string> = {
  preparada: 'Sala preparada',
  inscripcion: 'Inscripción abierta',
  r1_abierta: 'Ronda 1 abierta',
  r1_cerrada: 'Ronda 1 cerrada',
  r2_abierta: 'Ronda 2 abierta',
  r2_cerrada: 'Ronda 2 cerrada',
  cerrada: 'Sala cerrada',
}

export function nombreEstado(estado: EstadoSala | undefined): string {
  return (estado && NOMBRES_ESTADO[estado]) || 'Estado desconocido'
}

/** Nombre corto del criterio para el proyector (fuente única en web/shared/criterios.ts); el completo va en el title. */
export function nombreCorto(id: string, nombre: string): string {
  return nombreCortoCriterio(id, nombre)
}

export interface ParamsTablero {
  mesa?: string | null
  t?: string | null
}

/** URL de la API según la URL de la página: con ?mesa= el alcance es la mesa; sin ella, la sala. */
export function urlApiTablero(salaId: string, p: ParamsTablero): string {
  const q = new URLSearchParams()
  if (p.mesa) {
    q.set('alcance', 'mesa')
    q.set('mesa', p.mesa)
  } else {
    q.set('alcance', 'sala')
  }
  if (p.t) q.set('t', p.t)
  return `/api/tablero/${encodeURIComponent(salaId)}?${q.toString()}`
}

export type ResultadoPeticion =
  | { tipo: 'nuevo'; datos: DatosTablero; etag: string | null }
  | { tipo: 'igual' }
  | { tipo: 'error'; status: number; codigo: string; mensaje: string }

const SIN_PERMISO = 'Este enlace del tablero no tiene permiso. Pídele al facilitador el enlace completo del tablero.'
const MENSAJES_STATUS: Record<number, string> = {
  401: SIN_PERMISO,
  403: SIN_PERMISO,
  404: 'No encontramos esta sala. Revisa el enlace del tablero.',
}
/** QA-T-05: la sala existe pero la mesa del enlace no (404 `MESA_NO_EXISTE`). */
const MESA_NO_EXISTE = 'No encontramos esta mesa en la sala. Revisa el enlace del tablero.'

/** 401 o 403: el enlace no tiene permiso y reintentar no lo arregla, así que se deja de consultar. */
export function esSinPermiso(status: number): boolean {
  return status === 401 || status === 403
}

/** Una petición del polling con ETag. 304 = sin cambios. */
export async function pedirTablero(
  url: string,
  etag: string | null,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ResultadoPeticion> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      headers: etag ? { 'If-None-Match': etag, Accept: 'application/json' } : { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    return { tipo: 'error', status: 0, codigo: 'SIN_CONEXION', mensaje: 'Sin conexión con el servidor. Reintentamos solos cada pocos segundos.' }
  }
  if (res.status === 304) return { tipo: 'igual' }
  if (!res.ok) {
    let codigo = `HTTP_${res.status}`
    let mensaje = MENSAJES_STATUS[res.status] ?? 'El servidor no respondió bien. Reintentamos solos cada pocos segundos.'
    try {
      const cuerpo = await res.json()
      if (cuerpo?.error?.codigo) codigo = cuerpo.error.codigo
      if (cuerpo?.error?.mensaje && !MENSAJES_STATUS[res.status]) mensaje = cuerpo.error.mensaje
    } catch {
      /* cuerpo vacío o no JSON */
    }
    if (res.status === 404 && codigo === 'MESA_NO_EXISTE') mensaje = MESA_NO_EXISTE
    return { tipo: 'error', status: res.status, codigo, mensaje }
  }
  let datos: DatosTablero
  try {
    datos = (await res.json()) as DatosTablero
  } catch {
    return { tipo: 'error', status: res.status, codigo: 'RESPUESTA_INVALIDA', mensaje: 'El servidor respondió algo que no es el tablero. Reintentamos solos cada pocos segundos.' }
  }
  if (!datos || typeof datos !== 'object' || !datos.sala) {
    return { tipo: 'error', status: res.status, codigo: 'RESPUESTA_INVALIDA', mensaje: 'El servidor respondió algo que no es el tablero. Reintentamos solos cada pocos segundos.' }
  }
  return { tipo: 'nuevo', datos, etag: res.headers.get('ETag') ?? (datos.version != null ? `"${datos.version}"` : null) }
}

/** Pregunta que el facilitador proyecta en modo guiado (C19-5), o null si no aplica. */
export interface VistaPregunta {
  proyecto: string
  numero: number
  total: number
  nombre: string
  pregunta: string | null
  rubrica: Rubrica[]
}

export function preguntaGuiadaActual(datos: DatosTablero | null | undefined): VistaPregunta | null {
  if (!datos || !rondaAbierta(datos.sala?.estado)) return null
  const pg = datos.sala.pregunta_guiada
  if (datos.config?.modo_preguntas !== 'guiado' || !pg) return null
  const criterios: CriterioTablero[] = datos.criterios ?? []
  const i = criterios.findIndex((c) => c.id === pg.criterio_id)
  if (i < 0) return null
  const c = criterios[i]
  return {
    proyecto: datos.proyectos_vivos.find((p) => p.id === pg.proyecto_id)?.nombre ?? pg.proyecto_id,
    numero: i + 1,
    total: criterios.length,
    nombre: c.nombre,
    pregunta: c.pregunta ?? null,
    rubrica: c.rubrica ?? [],
  }
}

// ── Convergencia R1 → R2 (QA por roles, 20-oct). La calcula el servidor; aquí solo se pone en palabras. ──

/** Hay convergencia que mostrar: algún vivo la trae (solo llega con R1 y R2 visibles). */
export function hayConvergencia(datos: DatosTablero | null | undefined): boolean {
  return (datos?.proyectos_vivos ?? []).some((v) => !!v.convergencia)
}

/** «La discusión redujo la dispersión un 35 %» (o la aumentó, o no la cambió). */
export function titularConvergencia(pct: number): string {
  if (pct > 0) return `La discusión redujo la dispersión un ${pct} %`
  if (pct < 0) return `La discusión aumentó la dispersión un ${Math.abs(pct)} %`
  return 'La discusión no cambió la dispersión'
}

/** Cambio con signo y coma decimal: «+0,40», «−0,85», «0,00». */
export function conSigno(d: number): string {
  const r = Math.round(d * 100) / 100
  if (r === 0) return fmt.format(0)
  return `${r > 0 ? '+' : '−'}${fmt.format(Math.abs(r))}`
}

/** El movimiento en un eje, en palabras: los dos ejes miden distancia (al mercado y al core); bajar es acercarse. */
export function movimientoEje(eje: 'x' | 'y', d: number): string {
  const lugar = eje === 'x' ? 'mercado' : 'core'
  if (Math.round(d * 100) === 0) return `no cambió su distancia al ${lugar}`
  return d < 0 ? `se acercó al ${lugar}` : `se alejó del ${lugar}`
}

/** Proyectos cuyo criterio de mayor cambio R1 → R2 es este (para la marca «Mayor cambio» del Detallado). */
export function mayorCambioEn(datos: DatosTablero | null | undefined, criterio: string): string[] {
  return (datos?.proyectos_vivos ?? []).filter((v) => v.convergencia?.criterio_mayor_cambio === criterio).map((v) => v.nombre)
}
