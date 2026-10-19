import { responderMock } from './mock/servidor'

export class ApiError extends Error {
  constructor(public status: number, public codigo: string, mensaje: string) {
    super(mensaje)
  }
}

export interface Respuesta { status: number; body: unknown; etag?: string }
export type Transporte = (metodo: string, ruta: string, cuerpo?: unknown, etag?: string) => Promise<Respuesta>

const transporteReal: Transporte = async (metodo, ruta, cuerpo, etag) => {
  const headers: Record<string, string> = {}
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (etag) headers['If-None-Match'] = etag
  const r = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const texto = r.status === 304 ? '' : await r.text()
  return { status: r.status, body: texto ? JSON.parse(texto) : null, etag: r.headers.get('ETag') ?? undefined }
}

// API real por defecto. Modo simulado (servidor en memoria del navegador) con VITE_ADMIN_MOCK=1
// o abriendo /admin?mock=1 (queda guardado en este navegador; ?mock=0 lo apaga).
const LLAVE_MODO = 'hz_admin_modo'

function modoInicial(): Transporte {
  if (typeof window === 'undefined') return transporteReal
  const q = new URLSearchParams(window.location.search).get('mock')
  if (q === '1') localStorage.setItem(LLAVE_MODO, 'mock')
  if (q === '0') localStorage.removeItem(LLAVE_MODO)
  const mock = import.meta.env.VITE_ADMIN_MOCK === '1' || localStorage.getItem(LLAVE_MODO) === 'mock'
  return mock ? responderMock : transporteReal
}

let transporte: Transporte = modoInicial()

export function usarTransporte(t: Transporte) {
  transporte = t
}

export const usaMocks = () => transporte === responderMock

/** Últimas peticiones del panel (para /admin/salud). Solo en memoria de esta pestaña. */
export interface Medicion { metodo: string; ruta: string; status: number; ms: number; at: number }
export const salud = { mediciones: [] as Medicion[], ultimoError: null as (Medicion & { mensaje: string }) | null }

async function medir(metodo: string, ruta: string, cuerpo?: unknown, etag?: string): Promise<Respuesta> {
  const inicio = performance.now()
  const anotar = (status: number, mensaje?: string) => {
    const m = { metodo, ruta: ruta.split('?')[0], status, ms: Math.round(performance.now() - inicio), at: Date.now() }
    salud.mediciones.unshift(m)
    salud.mediciones.length = Math.min(salud.mediciones.length, 100)
    if (status === 0 || status >= 500) salud.ultimoError = { ...m, mensaje: mensaje ?? `HTTP ${status}` }
  }
  try {
    const r = await transporte(metodo, ruta, cuerpo, etag)
    const e = (r.body as { error?: { mensaje?: string } } | null)?.error
    anotar(r.status, e?.mensaje)
    return r
  } catch (e) {
    anotar(0, e instanceof Error ? e.message : 'Sin conexión')
    throw e
  }
}

/** Algunas listas llegan como arreglo o envueltas ({salas:[...]}, {admins:[...]}). */
export function lista<T>(cuerpo: unknown, llave: string): T[] {
  if (Array.isArray(cuerpo)) return cuerpo as T[]
  const v = (cuerpo as Record<string, unknown> | null)?.[llave]
  return Array.isArray(v) ? (v as T[]) : []
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let r: Respuesta
  try {
    r = await medir(metodo, ruta, cuerpo)
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.')
  }
  if (r.status >= 400) {
    const e = (r.body as { error?: { codigo: string; mensaje: string } } | null)?.error
    throw new ApiError(r.status, e?.codigo ?? 'ERROR', e?.mensaje ?? 'Algo falló en el servidor. Intenta de nuevo.')
  }
  return r.body as T
}

/** GET con ETag: devuelve null si no hubo cambios (304). */
export async function consultar<T>(ruta: string, etag?: string): Promise<{ datos: T; etag?: string } | null> {
  const r = await medir('GET', ruta, undefined, etag)
  if (r.status === 304) return null
  if (r.status >= 400) {
    const e = (r.body as { error?: { codigo: string; mensaje: string } } | null)?.error
    throw new ApiError(r.status, e?.codigo ?? 'ERROR', e?.mensaje ?? 'No se pudo cargar la información.')
  }
  return { datos: r.body as T, etag: r.etag }
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>('POST', ruta, cuerpo ?? {}),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PUT', ruta, cuerpo),
}
