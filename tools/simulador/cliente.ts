// Cliente HTTP del simulador: mide cada petición por ruta y cuenta como error todo status inesperado.
export interface Respuesta {
  status: number
  json: any
  headers: Headers
}

export class Cliente {
  readonly tiempos = new Map<string, number[]>()
  readonly errores: string[] = []
  constructor(readonly base: string) {}

  async pedir(
    metodo: string,
    ruta: string,
    op: { cuerpo?: unknown; headers?: Record<string, string>; esperados?: number[] } = {},
  ): Promise<Respuesta> {
    const t0 = performance.now()
    let r: Response
    let texto: string
    try {
      r = await fetch(this.base + ruta, {
        method: metodo,
        headers: { ...(op.cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...op.headers },
        body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo),
      })
      texto = await r.text()
    } catch (e) {
      this.errores.push(`${metodo} ${ruta} → sin respuesta (${(e as Error).message})`)
      return { status: 0, json: null, headers: new Headers() }
    }
    const ms = performance.now() - t0
    const clave = `${metodo} ${etiquetaRuta(ruta)}`
    if (!this.tiempos.has(clave)) this.tiempos.set(clave, [])
    this.tiempos.get(clave)!.push(ms)
    const ok = r.status < 400 || (op.esperados ?? []).includes(r.status)
    if (!ok) this.errores.push(`${metodo} ${ruta} → ${r.status} ${texto.slice(0, 200)}`)
    let json: unknown = null
    if (texto && (r.headers.get('content-type') ?? '').includes('json')) json = JSON.parse(texto)
    else if (texto) json = texto
    return { status: r.status, json, headers: r.headers }
  }
}

/** /api/tablero/s_ab12cd?t=... → /api/tablero/:id (agrupa ids y códigos para el informe). */
export function etiquetaRuta(ruta: string) {
  return ruta
    .split('?')[0]
    .replace(/\/(s|m|p)_[A-Za-z0-9]+/g, '/:id')
    .replace(/\/mesas\/[A-Z0-9]+-\d+/g, '/mesas/:codigo')
}

export function percentil(xs: number[], p: number) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(s.length * p) - 1))]
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
