import { responderMock } from './mock/servidor'
import { borrar, guardar, leer } from './memoria'

export class ApiError extends Error {
  constructor(public status: number, public codigo: string, mensaje: string) {
    super(mensaje)
  }
}

/** `invalida`: el servidor respondió algo que no es JSON (por ejemplo, una página HTML de un proxy o del despliegue). */
export interface Respuesta { status: number; body: unknown; etag?: string; invalida?: boolean }
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
  const etagRespuesta = r.headers.get('ETag') ?? undefined
  if (!texto) return { status: r.status, body: null, etag: etagRespuesta }
  try {
    return { status: r.status, body: JSON.parse(texto), etag: etagRespuesta }
  } catch {
    return { status: r.status, body: null, etag: etagRespuesta, invalida: true }
  }
}

// API real por defecto. Modo simulado (servidor en memoria del navegador) con VITE_ADMIN_MOCK=1
// o abriendo /admin?mock=1 (queda guardado en este navegador; ?mock=0 lo apaga).
const LLAVE_MODO = 'hz_admin_modo'

function modoInicial(): Transporte {
  if (typeof window === 'undefined') return transporteReal
  const q = new URLSearchParams(window.location.search).get('mock')
  if (q === '1') guardar(LLAVE_MODO, 'mock')
  if (q === '0') borrar(LLAVE_MODO)
  const mock = import.meta.env.VITE_ADMIN_MOCK === '1' || leer(LLAVE_MODO) === 'mock'
  return mock ? responderMock : transporteReal
}

let transporte: Transporte = modoInicial()

export function usarTransporte(t: Transporte) {
  transporte = t
}

export const usaMocks = () => transporte === responderMock

/**
 * F-5: la sesión del panel venció o se cerró (401 en una ruta del panel). La sesión se suscribe y manda al login.
 * El login y el cambio de clave no cuentan: ahí un 401 es una clave equivocada.
 */
const sesionPerdida = new Set<() => void>()
export function alPerderSesion(fn: () => void): () => void {
  sesionPerdida.add(fn)
  return () => {
    sesionPerdida.delete(fn)
  }
}
function revisarSesion(ruta: string, status: number) {
  if (status !== 401 || !ruta.startsWith('/api/admin/')) return
  if (ruta.startsWith('/api/admin/login') || ruta.startsWith('/api/admin/cambiar-clave')) return
  for (const fn of sesionPerdida) fn()
}

export const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.'

/** Últimas peticiones del panel (para /admin/salud). Solo en memoria de esta pestaña. */
export interface Medicion { metodo: string; ruta: string; status: number; ms: number; at: number }
export const salud = { mediciones: [] as Medicion[], ultimoError: null as (Medicion & { mensaje: string }) | null }

async function medir(metodo: string, ruta: string, cuerpo?: unknown, etag?: string): Promise<Respuesta> {
  const inicio = performance.now()
  const anotar = (status: number, mensaje?: string) => {
    const m = { metodo, ruta: ruta.split('?')[0], status, ms: Math.round(performance.now() - inicio), at: Date.now() }
    salud.mediciones.unshift(m)
    salud.mediciones.length = Math.min(salud.mediciones.length, 100)
    if (status === 0 || status >= 500) salud.ultimoError = { ...m, mensaje: mensaje ?? 'El servidor tuvo un problema.' }
  }
  try {
    const r = await transporte(metodo, ruta, cuerpo, etag)
    const e = (r.body as { error?: { mensaje?: string } } | null)?.error
    anotar(r.status, e?.mensaje)
    return r
  } catch {
    // F-9: «Failed to fetch» y similares nunca llegan a la pantalla.
    anotar(0, 'Sin conexión con el servidor.')
    throw new ApiError(0, 'SIN_CONEXION', MENSAJE_SIN_CONEXION)
  }
}

/**
 * F-9: si el servidor no manda su propio mensaje (o manda una página HTML en vez de JSON), se explica en lenguaje
 * claro según el código. Nunca «Unexpected token '<'».
 */
function errorDe(r: Respuesta, porDefecto: string): ApiError {
  const e = (r.body as { error?: { codigo?: string; mensaje?: string } } | null)?.error
  if (e?.mensaje) return new ApiError(r.status, e.codigo ?? 'ERROR', e.mensaje)
  if (r.status === 401) return new ApiError(401, 'SESION_REQUERIDA', 'Tu sesión terminó. Vuelve a iniciar sesión.')
  if (r.status === 404) return new ApiError(404, 'NO_ENCONTRADO', 'No encontramos lo que pediste. Recarga la página.')
  if (r.status === 429) return new ApiError(429, 'DEMASIADAS_PETICIONES', 'Hay demasiadas peticiones seguidas. Espera un minuto e intenta de nuevo.')
  if (r.status >= 500) return new ApiError(r.status, 'ERROR_SERVIDOR', 'El servidor tuvo un problema. Intenta de nuevo en unos segundos; si sigue, revisa Salud.')
  if (r.invalida) return new ApiError(r.status, 'RESPUESTA_INVALIDA', 'El servidor respondió algo que el panel no entiende. Recarga la página; si sigue, revisa Salud.')
  return new ApiError(r.status, 'ERROR', porDefecto)
}

/** Algunas listas llegan como arreglo o envueltas ({salas:[...]}, {admins:[...]}). */
export function lista<T>(cuerpo: unknown, llave: string): T[] {
  if (Array.isArray(cuerpo)) return cuerpo as T[]
  const v = (cuerpo as Record<string, unknown> | null)?.[llave]
  return Array.isArray(v) ? (v as T[]) : []
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await medir(metodo, ruta, cuerpo)
  revisarSesion(ruta, r.status)
  if (r.status >= 400 || r.invalida) throw errorDe(r, 'Algo falló en el servidor. Intenta de nuevo.')
  return r.body as T
}

/** GET con ETag: devuelve null si no hubo cambios (304). */
export async function consultar<T>(ruta: string, etag?: string): Promise<{ datos: T; etag?: string } | null> {
  const r = await medir('GET', ruta, undefined, etag)
  revisarSesion(ruta, r.status)
  if (r.status === 304) return null
  if (r.status >= 400 || r.invalida) throw errorDe(r, 'No se pudo cargar la información.')
  return { datos: r.body as T, etag: r.etag }
}

export const api = {
  get: <T>(ruta: string) => pedir<T>('GET', ruta),
  post: <T>(ruta: string, cuerpo?: unknown) => pedir<T>('POST', ruta, cuerpo ?? {}),
  patch: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PATCH', ruta, cuerpo),
  put: <T>(ruta: string, cuerpo: unknown) => pedir<T>('PUT', ruta, cuerpo),
  delete: <T>(ruta: string) => pedir<T>('DELETE', ruta),
}
