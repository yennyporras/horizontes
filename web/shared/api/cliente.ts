// Cliente mínimo del contrato para la landing (código de mesa). Cada área tiene su propio transporte: el celular en
// web/participante/api.ts, el tablero en web/tablero/logica.ts y el panel en web/admin/api.ts. Maneja errores con
// forma de contrato y ETag/304.
import type { InfoMesa } from './contrato'

export * from './contrato'

export class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public cuerpo?: unknown,
  ) {
    super(mensaje)
  }
}

interface Opciones {
  metodo?: string
  cuerpo?: unknown
  etag?: string
}

/** `null` cuando el servidor responde 304 (sin cambios desde `etag`). */
export async function pedir<T>(ruta: string, op: Opciones = {}): Promise<{ datos: T | null; etag?: string; status: number }> {
  const headers: Record<string, string> = {}
  if (op.cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (op.etag) headers['If-None-Match'] = op.etag
  let r: Response
  try {
    r = await fetch(ruta, { method: op.metodo ?? 'GET', headers, credentials: 'same-origin', body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo) })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión. Revisa tu señal; seguimos intentando.')
  }
  if (r.status === 304) return { datos: null, etag: op.etag, status: 304 }
  const texto = await r.text()
  const cuerpo = texto && (r.headers.get('content-type') ?? '').includes('json') ? JSON.parse(texto) : texto
  if (!r.ok) {
    const e = cuerpo?.error ?? { codigo: 'ERROR_HTTP', mensaje: 'Algo falló. Intenta de nuevo.' }
    throw new ErrorApi(r.status, e.codigo, e.mensaje, cuerpo)
  }
  return { datos: cuerpo as T, etag: r.headers.get('ETag') ?? undefined, status: r.status }
}

const datos = async <T>(p: Promise<{ datos: T | null }>) => (await p).datos as T

export const api = {
  mesa: (codigo: string) => datos(pedir<InfoMesa>(`/api/mesas/${encodeURIComponent(codigo)}`)),
}
