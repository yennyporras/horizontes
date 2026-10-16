// Lógica de presentación del tablero. Solo lee lo que entrega el servidor: nunca recalcula el motor.
import type { DatosTablero, EstadoSala, ProyectoVivo, RondaVivo, Vista } from './tipos'

export const INTERVALO_POLLING_MS = 2500

/** Vista por defecto: la ronda actual; tras cerrar la ronda 2, la comparación. */
export function vistaPorDefecto(estado: EstadoSala | undefined, rondaActual?: number | null): Vista {
  if (estado === 'r2_cerrada' || estado === 'cerrada') return 'comparacion'
  if (estado === 'r2_abierta' || rondaActual === 2) return 2
  return 1
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

/** Texto del estado vacío para la vista elegida, o null si hay algo que dibujar. */
export function mensajeVacio(datos: DatosTablero | null | undefined, vista: Vista): string | null {
  const r1 = hayVotosEnRonda(datos, 1)
  const r2 = hayVotosEnRonda(datos, 2)
  if (vista === 1) return r1 ? null : 'Aún no hay votos en la ronda 1'
  if (vista === 2) return r2 ? null : 'Aún no hay votos en la ronda 2'
  if (!r1 && !r2) return 'Aún no hay votos en la ronda 1'
  if (!r2) return 'Aún no hay votos en la ronda 2. La comparación muestra solo la ronda 1.'
  return null
}

/** Ronda cuya distribución se muestra en el panel según la vista. */
export function rondaEnFoco(datos: DatosTablero | null | undefined, vista: Vista): 1 | 2 {
  if (vista === 1) return 1
  if (vista === 2) return 2
  return hayVotosEnRonda(datos, 2) ? 2 : 1
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

/** Insignia del encabezado: "Preliminar" en precierre, "En vivo" con la ronda abierta, nada al cerrar. */
export function insigniaResultado(datos: DatosTablero | null | undefined): 'preliminar' | 'en_vivo' | null {
  if (esPreliminar(datos)) return 'preliminar'
  return rondaAbierta(datos?.sala?.estado) ? 'en_vivo' : null
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

/** Nombre corto del criterio para el proyector; el nombre completo va en el title. */
const CORTOS: Record<string, string> = {
  alistamiento_tecnico: 'Alistamiento técnico',
  conocimiento_cliente: 'Conocimiento del cliente',
  regulacion: 'Regulación',
  capacidades_organizacionales: 'Capacidades organizacionales',
  alineacion_core: 'Alineación con el core',
  inversion_requerida: 'Inversión requerida',
}

export function nombreCorto(id: string, nombre: string): string {
  return CORTOS[id] ?? nombre
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

const MENSAJES_STATUS: Record<number, string> = {
  401: 'Este enlace del tablero no tiene permiso. Pide al facilitador el enlace completo con su token.',
  403: 'Este enlace del tablero no tiene permiso. Pide al facilitador el enlace completo con su token.',
  404: 'No encontramos esta sala. Revisa el enlace del tablero.',
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
