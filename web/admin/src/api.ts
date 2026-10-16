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

// Mocks por defecto hasta que T1 publique la API real (VITE_API_REAL=1).
let transporte: Transporte = import.meta.env.VITE_API_REAL === '1' ? transporteReal : responderMock

export function usarTransporte(t: Transporte) {
  transporte = t
}

export const usaMocks = () => transporte === responderMock

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let r: Respuesta
  try {
    r = await transporte(metodo, ruta, cuerpo)
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
  const r = await transporte('GET', ruta, undefined, etag)
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
}
